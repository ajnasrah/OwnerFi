import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
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
 * Admin Endpoint: Agent Outreach Queue Statistics
 *
 * Returns real-time stats about the agent outreach queue
 */
export async function GET(request: NextRequest) {
  try {
    // Admin access control
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    console.log('📊 [ADMIN] Fetching agent outreach queue stats');

    // Get all queue items
    const queueSnapshot = await db.collection('agent_outreach_queue').get();

    // Calculate statistics
    const stats = {
      total: queueSnapshot.size,
      byStatus: {
        pending: 0,
        processing: 0,
        sent_to_ghl: 0,
        agent_yes: 0,
        agent_no: 0,
        failed: 0,
      },
      byDealType: {
        cash_deal: 0,
        potential_owner_finance: 0,
      },
      byRoutedTo: {
        zillow_imports: 0,
        cash_deals: 0,
        rejected: 0,
      },
      responseRate: {
        total_sent: 0,
        total_responded: 0,
        yes_responses: 0,
        no_responses: 0,
        percentage: 0,
        yes_percentage: 0,
      },
      errors: {
        total: 0,
        recent: [] as Array<{ address: string; error: string; timestamp: Date }>,
      },
      timing: {
        oldest_pending: null as Date | null,
        newest_pending: null as Date | null,
        avg_time_to_send: null as string | null,
      },
    };

    const pendingDates: Date[] = [];
    const sendTimes: number[] = [];

    queueSnapshot.docs.forEach(doc => {
      const data = doc.data();

      // Count by status
      const status = data.status || 'pending';
      if (status in stats.byStatus) {
        stats.byStatus[status as keyof typeof stats.byStatus]++;
      }

      // Count by deal type
      const dealType = data.dealType;
      if (dealType in stats.byDealType) {
        stats.byDealType[dealType as keyof typeof stats.byDealType]++;
      }

      // Count by routed destination
      if (data.routedTo && data.routedTo in stats.byRoutedTo) {
        stats.byRoutedTo[data.routedTo as keyof typeof stats.byRoutedTo]++;
      }

      // Response rate calculations
      if (status === 'sent_to_ghl' || status === 'agent_yes' || status === 'agent_no') {
        stats.responseRate.total_sent++;

        if (status === 'agent_yes' || status === 'agent_no') {
          stats.responseRate.total_responded++;

          if (status === 'agent_yes') {
            stats.responseRate.yes_responses++;
          } else {
            stats.responseRate.no_responses++;
          }
        }
      }

      // Error tracking
      if (status === 'failed') {
        stats.errors.total++;

        if (stats.errors.recent.length < 10) {
          stats.errors.recent.push({
            address: data.address || 'Unknown',
            error: data.errorMessage || 'Unknown error',
            timestamp: data.lastFailedAt?.toDate?.() || new Date(),
          });
        }
      }

      // Timing calculations
      if (status === 'pending') {
        const addedAt = data.addedAt?.toDate?.();
        if (addedAt) {
          pendingDates.push(addedAt);
        }
      }

      // Calculate time from added to sent
      if (data.sentToGHLAt && data.addedAt) {
        const addedAt = data.addedAt.toDate();
        const sentAt = data.sentToGHLAt.toDate();
        const timeDiff = sentAt.getTime() - addedAt.getTime();
        sendTimes.push(timeDiff);
      }
    });

    // Calculate response rate percentages
    if (stats.responseRate.total_sent > 0) {
      stats.responseRate.percentage = Math.round(
        (stats.responseRate.total_responded / stats.responseRate.total_sent) * 100
      );
      stats.responseRate.yes_percentage = Math.round(
        (stats.responseRate.yes_responses / stats.responseRate.total_sent) * 100
      );
    }

    // Calculate timing stats
    if (pendingDates.length > 0) {
      stats.timing.oldest_pending = new Date(Math.min(...pendingDates.map(d => d.getTime())));
      stats.timing.newest_pending = new Date(Math.max(...pendingDates.map(d => d.getTime())));
    }

    if (sendTimes.length > 0) {
      const avgMs = sendTimes.reduce((a, b) => a + b, 0) / sendTimes.length;
      const avgHours = Math.round(avgMs / 1000 / 60 / 60);
      stats.timing.avg_time_to_send = `${avgHours} hours`;
    }

    // Get sample pending properties
    const pendingPropertiesSnapshot = await db
      .collection('agent_outreach_queue')
      .where('status', '==', 'pending')
      .orderBy('addedAt', 'asc')
      .limit(10)
      .get();

    const samplePending = pendingPropertiesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        address: data.address,
        dealType: data.dealType,
        price: data.price,
        discountPercent: data.dealType === 'cash_deal' && data.priceToZestimateRatio
          ? Math.round((1 - data.priceToZestimateRatio) * 100)
          : null,
        addedAt: data.addedAt?.toDate?.() || null,
      };
    });

    // Get recent successes
    const recentSuccessesSnapshot = await db
      .collection('agent_outreach_queue')
      .where('status', '==', 'agent_yes')
      .orderBy('agentResponseAt', 'desc')
      .limit(10)
      .get();

    const recentSuccesses = recentSuccessesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        address: data.address,
        dealType: data.dealType,
        routedTo: data.routedTo,
        agentResponseAt: data.agentResponseAt?.toDate?.() || null,
        agentNote: data.agentNote || null,
      };
    });

    console.log('✅ [ADMIN] Stats calculated successfully');

    return NextResponse.json({
      success: true,
      stats,
      samplePending,
      recentSuccesses,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ [ADMIN] Error fetching stats:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch queue stats',
        message: error.message
      },
      { status: 500 }
    );
  }
}
