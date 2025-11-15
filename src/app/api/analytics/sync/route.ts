import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * POST /api/analytics/sync
 *
 * Collects analytics from Firebase workflows and saves to workflow_analytics collection
 *
 * Body:
 * - brand: carz|ownerfi|podcast|vassdistro|abdullah (optional)
 * - days: number of days to sync (default: 7)
 */

function getWorkflowCollection(brand: string) {
  if (brand === 'podcast') return 'podcast_workflows';
  if (brand === 'property' || brand === 'property-spanish') return 'propertyShowcaseWorkflows';
  if (brand === 'benefit') return 'benefit_workflow_queue';
  return 'workflows';
}

function getContentType(brand: string, workflow: any) {
  if (brand === 'podcast') return 'podcast';
  if (brand === 'abdullah') return 'abdullah';
  if (workflow.contentType === 'benefit') return 'benefit';
  if (workflow.address) return 'property';
  return 'viral';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brand, days = 7 } = body;

    console.log(`📊 Starting analytics sync...`);
    console.log(`   Brand: ${brand || 'ALL'}`);
    console.log(`   Days: ${days}`);

    const adminDb = await getAdminDb();
    if (!adminDb) {
      return NextResponse.json({
        success: false,
        error: 'Firebase Admin not initialized'
      }, { status: 500 });
    }

    const brands = brand ? [brand] : ['carz', 'ownerfi', 'podcast', 'vassdistro', 'abdullah'];
    let totalSynced = 0;

    for (const currentBrand of brands) {
      console.log(`📊 Syncing ${currentBrand} workflows...`);

      const collection = getWorkflowCollection(currentBrand);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Query workflows
      const workflowsSnap = await (adminDb as any).collection(collection)
        .where('status', '==', 'completed')
        .where('scheduledTime', '>=', cutoffDate.toISOString())
        .get();

      console.log(`   Found ${workflowsSnap.size} workflows`);

      for (const doc of workflowsSnap.docs) {
        const workflow = doc.data();

        // Skip if no Late post ID
        if (!workflow.latePostId) continue;

        // Fetch analytics from Late.dev Analytics API
        let lateAnalytics: any = null;
        try {
          const response = await fetch(`https://getlate.dev/api/v1/analytics?postId=${workflow.latePostId}`, {
            headers: {
              'Authorization': `Bearer ${process.env.LATE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            // Analytics API returns posts array
            lateAnalytics = data.posts && data.posts.length > 0 ? data.posts[0] : null;
          }
        } catch (error) {
          console.log(`   ⚠️  Failed to fetch analytics for ${workflow.latePostId}`);
        }

        // Calculate metrics from Late.dev analytics data
        let totalViews = 0;
        let totalLikes = 0;
        let totalComments = 0;
        let totalShares = 0;
        let totalSaves = 0;
        const platformMetrics: any = {};

        // Use analytics from the analytics endpoint
        if (lateAnalytics?.analytics) {
          totalViews = lateAnalytics.analytics.views || 0;
          totalLikes = lateAnalytics.analytics.likes || 0;
          totalComments = lateAnalytics.analytics.comments || 0;
          totalShares = lateAnalytics.analytics.shares || 0;
          totalSaves = lateAnalytics.analytics.saves || 0;
        }

        // Per-platform analytics
        if (lateAnalytics?.platforms) {
          lateAnalytics.platforms.forEach((p: any) => {
            const stats = p.analytics || {};
            platformMetrics[p.platform] = stats;
          });
        }

        const totalEngagement = totalLikes + totalComments + totalShares;
        const overallEngagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

        // Create analytics document
        const analyticsData = {
          workflowId: doc.id,
          brand: currentBrand,
          latePostId: workflow.latePostId,
          contentType: getContentType(currentBrand, workflow),
          variant: workflow.variant || '30sec',
          scheduledTime: workflow.scheduledTime,
          postedAt: workflow.postedAt || workflow.completedAt,

          // Platform metrics
          platformMetrics,

          // Calculate totals
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalSaves,
          overallEngagementRate,

          // Time slot data
          timeSlot: workflow.timeSlot || extractTimeSlot(workflow.scheduledTime),
          dayOfWeek: workflow.dayOfWeek || extractDayOfWeek(workflow.scheduledTime),

          // Hook and content metadata
          hook: workflow.hook || workflow.script?.substring(0, 100) || '',
          hookType: workflow.hookType || 'unknown',

          lastUpdated: Date.now(),
          syncedAt: Date.now()
        };

        // Save to workflow_analytics collection
        await (adminDb as any).collection('workflow_analytics')
          .doc(doc.id)
          .set(analyticsData, { merge: true });

        totalSynced++;
      }

      console.log(`✅ Synced ${totalSynced} ${currentBrand} workflows`);
    }

    return NextResponse.json({
      success: true,
      message: `Analytics synced successfully`,
      totalSynced,
      brand: brand || 'all',
      days
    });

  } catch (error) {
    console.error('Error syncing analytics:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function extractTimeSlot(scheduledTime: string): string {
  const date = new Date(scheduledTime);
  const hour = date.getHours();
  const nextHour = (hour + 1) % 24;
  return `${hour.toString().padStart(2, '0')}:00-${nextHour.toString().padStart(2, '0')}:00`;
}

function extractDayOfWeek(scheduledTime: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const date = new Date(scheduledTime);
  return days[date.getDay()];
}
