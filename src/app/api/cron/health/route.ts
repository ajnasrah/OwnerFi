import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    
    const crons = [
      { path: '/api/cron/run-agent-outreach-scraper', name: 'Agent Scraper', schedule: 'Every 2 hours' },
      { path: '/api/cron/process-agent-outreach-queue', name: 'Agent Queue', schedule: 'Every hour' },
      { path: '/api/cron/refresh-zillow-status-fixed', name: 'Zillow Refresh', schedule: 'Every 6 hours' },
      { path: '/api/v2/scraper/run', name: 'Property Scraper', schedule: 'Daily 6pm' },
      { path: '/api/cron/monthly-realtor-credits', name: 'Monthly Credits', schedule: 'Monthly 1st' },
      { path: '/api/cron/drain-tcpa-pending', name: 'TCPA Queue', schedule: 'Every 15 min' },
      { path: '/api/cron/sweep-abandoned-outreach', name: 'Sweep Abandoned', schedule: 'Daily 2pm' },
      { path: '/api/cron/refresh-agents', name: 'Refresh Agents', schedule: 'Every 6 hours' },
      { path: '/api/cron/recalculate-matches', name: 'Recalculate Matches', schedule: 'Daily 3am' },
      { path: '/api/cron/daily-video', name: 'Daily Video', schedule: 'Daily 12pm' },
      { path: '/api/cron/trending-video', name: 'Trending Video', schedule: 'Every 6 hours' },
      { path: '/api/cron/workflow-monitor', name: 'Workflow Monitor', schedule: 'Every 15 min' }
    ];
    
    // Get logs from last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const cronLogs = await db.collection('cron_logs')
      .where('timestamp', '>=', oneDayAgo)
      .orderBy('timestamp', 'desc')
      .limit(500)
      .get();
    
    // Group by endpoint
    const logsByEndpoint: Record<string, any[]> = {};
    cronLogs.docs.forEach(doc => {
      const data = doc.data();
      const endpoint = data.endpoint;
      if (!logsByEndpoint[endpoint]) {
        logsByEndpoint[endpoint] = [];
      }
      logsByEndpoint[endpoint].push({
        timestamp: data.timestamp?.toDate?.() || data.timestamp,
        success: data.success,
        error: data.error
      });
    });
    
    // Build health status
    const health = crons.map(cron => {
      const logs = logsByEndpoint[cron.path] || [];
      const lastRun = logs[0];
      const successCount = logs.filter((l: any) => l.success).length;
      const failCount = logs.filter((l: any) => !l.success).length;
      
      let status = 'unknown';
      let lastRunTime = null;
      let lastError = null;
      
      if (lastRun) {
        status = lastRun.success ? 'healthy' : 'error';
        lastRunTime = lastRun.timestamp;
        lastError = lastRun.error;
      }
      
      return {
        name: cron.name,
        path: cron.path,
        schedule: cron.schedule,
        status,
        lastRunTime,
        last24h: {
          success: successCount,
          failed: failCount,
          total: logs.length
        },
        lastError
      };
    });
    
    // Overall health
    const healthyCrons = health.filter(h => h.status === 'healthy').length;
    const errorCrons = health.filter(h => h.status === 'error').length;
    const unknownCrons = health.filter(h => h.status === 'unknown').length;
    
    const overallHealth = unknownCrons > 6 ? 'critical' :
                          errorCrons > 3 ? 'degraded' :
                          healthyCrons > 8 ? 'healthy' : 'warning';
    
    return NextResponse.json({
      status: overallHealth,
      timestamp: new Date().toISOString(),
      summary: {
        total: crons.length,
        healthy: healthyCrons,
        error: errorCrons,
        unknown: unknownCrons
      },
      crons: health
    });
    
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 });
  }
}