import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

/**
 * Diagnostic endpoint for Agent Outreach Queue
 *
 * GET /api/admin/agent-outreach-queue/diagnose
 *
 * Returns:
 * - Queue stats (pending, sent, failed counts)
 * - Properties added in last 24h, 7d
 * - Recent cron logs
 * - Sample pending items
 */
export async function GET(request: NextRequest) {
  // Simple admin auth
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET_KEY || process.env.CRON_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Get queue stats by status
    const [pendingSnap, processingSnap, sentSnap, failedSnap] = await Promise.all([
      db.collection('agent_outreach_queue').where('status', '==', 'pending').count().get(),
      db.collection('agent_outreach_queue').where('status', '==', 'processing').count().get(),
      db.collection('agent_outreach_queue').where('status', '==', 'sent_to_ghl').count().get(),
      db.collection('agent_outreach_queue').where('status', '==', 'failed').count().get(),
    ]);

    const queueStats = {
      pending: pendingSnap.data().count,
      processing: processingSnap.data().count,
      sent_to_ghl: sentSnap.data().count,
      failed: failedSnap.data().count,
      total: pendingSnap.data().count + processingSnap.data().count + sentSnap.data().count + failedSnap.data().count,
    };

    // 2. Properties added in last 24h
    const added24hSnap = await db.collection('agent_outreach_queue')
      .where('addedAt', '>=', last24h)
      .count()
      .get();

    // 3. Properties added in last 7d
    const added7dSnap = await db.collection('agent_outreach_queue')
      .where('addedAt', '>=', last7d)
      .count()
      .get();

    // 4. Recent cron logs for both scrapers
    const [scraperLogs, queueLogs] = await Promise.all([
      db.collection('cron_logs')
        .where('cron', '==', 'run-agent-outreach-scraper')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get(),
      db.collection('cron_logs')
        .where('cron', '==', 'process-agent-outreach-queue')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get(),
    ]);

    const recentScraperLogs = scraperLogs.docs.map(doc => {
      const data = doc.data();
      return {
        status: data.status,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
        duration: data.duration,
        propertiesFromSearch: data.propertiesFromSearch,
        addedToQueue: data.addedToQueue,
        skipped: data.skipped,
        error: data.error,
      };
    });

    const recentQueueLogs = queueLogs.docs.map(doc => {
      const data = doc.data();
      return {
        status: data.status,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
        duration: data.duration,
        batchSize: data.batchSize,
        sent: data.sent,
        errors: data.errors,
        errorDetails: data.errorDetails,
      };
    });

    // 5. Sample pending items (first 5)
    const pendingSample = await db.collection('agent_outreach_queue')
      .where('status', '==', 'pending')
      .orderBy('addedAt', 'asc')
      .limit(5)
      .get();

    const samplePending = pendingSample.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        address: data.address,
        city: data.city,
        state: data.state,
        price: data.price,
        dealType: data.dealType,
        agentPhone: data.agentPhone ? '***' + data.agentPhone.slice(-4) : null,
        addedAt: data.addedAt?.toDate?.()?.toISOString() || data.addedAt,
      };
    });

    // 6. Sample failed items (first 5)
    const failedSample = await db.collection('agent_outreach_queue')
      .where('status', '==', 'failed')
      .limit(5)
      .get();

    const sampleFailed = failedSample.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        address: data.address,
        errorMessage: data.errorMessage,
        retryCount: data.retryCount,
        lastFailedAt: data.lastFailedAt?.toDate?.()?.toISOString() || data.lastFailedAt,
      };
    });

    // 7. Check failed_filter_properties (last 24h)
    const filteredOut24h = await db.collection('failed_filter_properties')
      .where('createdAt', '>=', last24h)
      .count()
      .get();

    // 8. Get breakdown of why properties were filtered
    const [hasOFSnap, negativeSnap] = await Promise.all([
      db.collection('failed_filter_properties')
        .where('createdAt', '>=', last24h)
        .where('filterResult', '==', 'has_owner_financing')
        .count()
        .get(),
      db.collection('failed_filter_properties')
        .where('createdAt', '>=', last24h)
        .where('filterResult', '==', 'negative_keywords')
        .count()
        .get(),
    ]);

    return NextResponse.json({
      timestamp: now.toISOString(),
      queueStats,
      imports: {
        last24h: added24hSnap.data().count,
        last7d: added7dSnap.data().count,
      },
      filteredOut: {
        last24h: filteredOut24h.data().count,
        breakdown: {
          hasOwnerFinancing: hasOFSnap.data().count,
          negativeKeywords: negativeSnap.data().count,
        },
      },
      recentScraperLogs,
      recentQueueLogs,
      samplePending,
      sampleFailed,
      webhookUrl: process.env.GHL_AGENT_OUTREACH_WEBHOOK_URL || 'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/f13ea8d2-a22c-4365-9156-759d18147d4a',
    });

  } catch (error: any) {
    console.error('Diagnose error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
