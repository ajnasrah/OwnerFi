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
 * GET /api/admin/agent-outreach-queue/diagnose
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET_KEY || process.env.CRON_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    errors: [],
  };

  // 1. Queue stats by status (simple queries, no index needed)
  try {
    const [pendingSnap, processingSnap, sentSnap, failedSnap] = await Promise.all([
      db.collection('agent_outreach_queue').where('status', '==', 'pending').count().get(),
      db.collection('agent_outreach_queue').where('status', '==', 'processing').count().get(),
      db.collection('agent_outreach_queue').where('status', '==', 'sent_to_ghl').count().get(),
      db.collection('agent_outreach_queue').where('status', '==', 'failed').count().get(),
    ]);

    results.queueStats = {
      pending: pendingSnap.data().count,
      processing: processingSnap.data().count,
      sent_to_ghl: sentSnap.data().count,
      failed: failedSnap.data().count,
    };
    results.queueStats.total = results.queueStats.pending + results.queueStats.processing +
      results.queueStats.sent_to_ghl + results.queueStats.failed;
  } catch (e: any) {
    results.errors.push({ query: 'queueStats', error: e.message });
  }

  // 2. Recent items added (last 24h count)
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const added24h = await db.collection('agent_outreach_queue')
      .where('addedAt', '>=', last24h)
      .count()
      .get();
    results.imports = { last24h: added24h.data().count };
  } catch (e: any) {
    results.errors.push({ query: 'imports24h', error: e.message });
  }

  // 3. Sample pending items (needs index but exists)
  try {
    const pendingSample = await db.collection('agent_outreach_queue')
      .where('status', '==', 'pending')
      .orderBy('addedAt', 'asc')
      .limit(5)
      .get();

    results.samplePending = pendingSample.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        address: data.address,
        city: data.city,
        state: data.state,
        price: data.price,
        dealType: data.dealType,
        addedAt: data.addedAt?.toDate?.()?.toISOString(),
      };
    });
  } catch (e: any) {
    results.errors.push({ query: 'samplePending', error: e.message });
  }

  // 4. Sample failed items
  try {
    const failedSample = await db.collection('agent_outreach_queue')
      .where('status', '==', 'failed')
      .limit(5)
      .get();

    results.sampleFailed = failedSample.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        address: data.address,
        errorMessage: data.errorMessage,
        retryCount: data.retryCount,
      };
    });
  } catch (e: any) {
    results.errors.push({ query: 'sampleFailed', error: e.message });
  }

  // 5. Recent cron logs (no index, just fetch all and filter in memory)
  try {
    const allCronLogs = await db.collection('cron_logs').limit(100).get();

    const scraperLogs = allCronLogs.docs
      .filter(doc => doc.data().cron === 'run-agent-outreach-scraper')
      .map(doc => {
        const data = doc.data();
        return {
          status: data.status,
          timestamp: data.timestamp?.toDate?.()?.toISOString(),
          duration: data.duration,
          propertiesFromSearch: data.propertiesFromSearch,
          addedToQueue: data.addedToQueue,
          error: data.error,
        };
      })
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, 5);

    const queueLogs = allCronLogs.docs
      .filter(doc => doc.data().cron === 'process-agent-outreach-queue')
      .map(doc => {
        const data = doc.data();
        return {
          status: data.status,
          timestamp: data.timestamp?.toDate?.()?.toISOString(),
          sent: data.sent,
          errors: data.errors,
        };
      })
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, 5);

    results.recentScraperLogs = scraperLogs;
    results.recentQueueLogs = queueLogs;
  } catch (e: any) {
    results.errors.push({ query: 'cronLogs', error: e.message });
  }

  // 6. Check total properties collection count
  try {
    const totalProperties = await db.collection('properties').count().get();
    results.totalPropertiesInSystem = totalProperties.data().count;
  } catch (e: any) {
    results.errors.push({ query: 'totalProperties', error: e.message });
  }

  results.webhookUrl = process.env.GHL_AGENT_OUTREACH_WEBHOOK_URL ||
    'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/f13ea8d2-a22c-4365-9156-759d18147d4a';

  return NextResponse.json(results);
}
