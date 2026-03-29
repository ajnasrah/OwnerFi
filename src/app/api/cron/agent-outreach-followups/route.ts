import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { withCronLock } from '@/lib/scraper-v2/cron-lock';
import { sendSMS } from '@/lib/agent-outreach/twilio-sms';
import {
  formatFollowUp,
  formatAskingSellerFollowUp,
} from '@/lib/agent-outreach/sms-templates';
import {
  addMessage,
  isOptedOut,
} from '@/lib/agent-outreach/conversation-manager';
import { isWithinBusinessHours, getBusinessHoursStatus } from '@/lib/agent-outreach/business-hours';

export const maxDuration = 300;

const BATCH_SIZE = 50;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * CRON: Agent Outreach Follow-ups
 *
 * Runs hourly. Handles:
 * 1. Follow-up SMS for items in "sent" stage with no response after 3 days (max 2 follow-ups)
 * 2. Follow-up SMS for items in "asking_seller" stage after 3 days
 * 3. Mark items as "no_response" after 2 follow-ups + 3 more days
 *
 * Schedule: Every hour
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { db } = getFirebaseAdmin();

  console.log('🔄 [FOLLOW-UPS] Starting follow-up check');

  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLock('agent-outreach-followups', async () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - THREE_DAYS_MS);
    const withinBusinessHours = isWithinBusinessHours();

    let followUpsSent = 0;
    let markedNoResponse = 0;
    let askingSellerFollowUps = 0;
    let skippedOptOut = 0;

    // === 1. Mark no_response: sent items with 2 follow-ups and last follow-up > 3 days ago ===
    // (Housekeeping — no SMS sent, runs regardless of business hours)
    const noResponseItems = await db
      .collection('agent_outreach_queue')
      .where('status', '==', 'sent')
      .where('followUpCount', '==', 2)
      .limit(BATCH_SIZE)
      .get();

    const noResponseBatch = db.batch();
    for (const doc of noResponseItems.docs) {
      const data = doc.data();
      const lastFollowUp = data.lastFollowUpAt?.toDate?.();
      if (lastFollowUp && lastFollowUp < threeDaysAgo) {
        noResponseBatch.update(doc.ref, {
          status: 'no_response',
          updatedAt: now,
        });
        markedNoResponse++;
      }
    }
    if (markedNoResponse > 0) {
      await noResponseBatch.commit();
      console.log(`   ⏰ Marked ${markedNoResponse} items as no_response`);
    }

    // === 2. Send follow-ups for "sent" items (no response after 3 days) ===
    // (Sends SMS — only during business hours)
    if (!withinBusinessHours) {
      const status = getBusinessHoursStatus();
      console.log(`   🕐 Skipping follow-up sends: ${status.reason}`);
    }

    const sentItems = !withinBusinessHours ? { docs: [] } : await db
      .collection('agent_outreach_queue')
      .where('status', '==', 'sent')
      .limit(BATCH_SIZE)
      .get();

    for (const doc of sentItems.docs) {
      const data = doc.data();
      const followUpCount = data.followUpCount || 0;

      // Skip if already at max follow-ups
      if (followUpCount >= 2) continue;

      // Determine the last contact time
      const lastContact = followUpCount === 0
        ? data.sentAt?.toDate?.()
        : data.lastFollowUpAt?.toDate?.();

      if (!lastContact || lastContact >= threeDaysAgo) continue;

      // Check opt-out
      if (await isOptedOut(data.agentPhone)) {
        skippedOptOut++;
        await doc.ref.update({ status: 'opted_out', updatedAt: now });
        continue;
      }

      // Send follow-up
      const followUpNumber = (followUpCount + 1) as 1 | 2;
      const smsBody = formatFollowUp(
        { agentName: data.agentName, address: data.address, city: data.city },
        followUpNumber
      );

      const smsResult = await sendSMS(data.agentPhone, smsBody);

      // Log to conversation
      if (data.conversationId) {
        await addMessage(data.conversationId, {
          role: 'outbound',
          body: smsBody,
          timestamp: now,
          twilioSid: smsResult.sid,
          source: 'sms',
        });
      }

      // Update queue item
      await doc.ref.update({
        followUpCount: followUpCount + 1,
        lastFollowUpAt: now,
        updatedAt: now,
      });

      followUpsSent++;
      console.log(`   📤 Follow-up ${followUpNumber} sent: ${data.address}`);
    }

    // === 3. Follow up on "asking_seller" items after 3 days ===
    // (Sends SMS — only during business hours)
    const askingSellerItems = !withinBusinessHours ? { docs: [] } : await db
      .collection('agent_outreach_queue')
      .where('status', '==', 'asking_seller')
      .limit(BATCH_SIZE)
      .get();

    for (const doc of askingSellerItems.docs) {
      const data = doc.data();
      const askingSellerAt = data.askingSellerAt?.toDate?.() || data.updatedAt?.toDate?.();

      if (!askingSellerAt || askingSellerAt >= threeDaysAgo) continue;

      if (await isOptedOut(data.agentPhone)) {
        skippedOptOut++;
        await doc.ref.update({ status: 'opted_out', updatedAt: now });
        continue;
      }

      const smsBody = formatAskingSellerFollowUp({
        agentName: data.agentName,
        address: data.address,
        city: data.city,
      });

      const smsResult = await sendSMS(data.agentPhone, smsBody);

      // Move back to "sent" with followUpCount=1 so it follows the normal flow
      await doc.ref.update({
        status: 'sent',
        followUpCount: 1,
        lastFollowUpAt: now,
        updatedAt: now,
      });

      if (data.conversationId) {
        await addMessage(data.conversationId, {
          role: 'outbound',
          body: smsBody,
          timestamp: now,
          twilioSid: smsResult.sid,
          source: 'sms',
        });
      }

      askingSellerFollowUps++;
      console.log(`   📤 Asking-seller follow-up: ${data.address}`);
    }

    // === 4. Timeout stale "in_conversation" items (no reply for 3 days) ===
    let staleConversations = 0;
    const inConversationItems = await db
      .collection('agent_outreach_queue')
      .where('status', '==', 'in_conversation')
      .limit(BATCH_SIZE)
      .get();

    const staleConvoBatch = db.batch();
    for (const doc of inConversationItems.docs) {
      const data = doc.data();
      const lastUpdate = data.updatedAt?.toDate?.() || data.sentAt?.toDate?.();
      if (lastUpdate && lastUpdate < threeDaysAgo) {
        staleConvoBatch.update(doc.ref, {
          status: 'no_response',
          updatedAt: now,
        });
        staleConversations++;
      }
    }
    if (staleConversations > 0) {
      await staleConvoBatch.commit();
      console.log(`   💤 Timed out ${staleConversations} stale in_conversation items`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ [FOLLOW-UPS] Complete in ${duration}s:`);
    console.log(`   📤 Follow-ups sent: ${followUpsSent}`);
    console.log(`   🔄 Asking-seller follow-ups: ${askingSellerFollowUps}`);
    console.log(`   ⏰ Marked no_response: ${markedNoResponse}`);
    console.log(`   💤 Stale conversations timed out: ${staleConversations}`);
    console.log(`   🚫 Skipped (opted out): ${skippedOptOut}`);

    await db.collection('cron_logs').add({
      cron: 'agent-outreach-followups',
      status: 'completed',
      duration: `${duration}s`,
      followUpsSent,
      askingSellerFollowUps,
      markedNoResponse,
      staleConversations,
      skippedOptOut,
      timestamp: now,
    });

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      followUpsSent,
      askingSellerFollowUps,
      markedNoResponse,
      staleConversations,
      skippedOptOut,
    });
  });

  if (result === null) {
    return NextResponse.json({
      success: false,
      message: 'Another instance is already running',
      skipped: true,
    });
  }

  return result;
}
