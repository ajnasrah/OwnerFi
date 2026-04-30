import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { SocialMediaAnalytics } from '@/lib/social-media-analytics';

/**
 * Social Media Metrics Dashboard API
 * 
 * Provides comprehensive analytics for social media performance
 */

export async function GET(req: NextRequest) {
  try {
    // Verify admin access
    const session = await getServerSession(authOptions as any);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const timeframe = searchParams.get('timeframe') || '7d'; // 1d, 7d, 30d, 90d
    const brand = searchParams.get('brand'); // optional brand filter

    console.log(`[Social Metrics] Generating report for timeframe: ${timeframe}, brand: ${brand || 'all'}`);

    const analytics = new SocialMediaAnalytics();
    const report = await analytics.generateReport(timeframe, brand);

    return NextResponse.json({
      success: true,
      report,
      generated: new Date().toISOString(),
      timeframe,
      brand: brand || 'all'
    });

  } catch (error) {
    console.error('[Social Metrics] Error generating report:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate metrics report'
    }, { status: 500 });
  }
}

/**
 * Real-time workflow status endpoint
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, workflowId, brand } = await req.json();

    const analytics = new SocialMediaAnalytics();

    switch (action) {
      case 'retry_workflow':
        const retryResult = await analytics.retryWorkflow(workflowId, brand);
        return NextResponse.json({ success: true, result: retryResult });

      case 'cancel_workflow':
        const cancelResult = await analytics.cancelWorkflow(workflowId, brand);
        return NextResponse.json({ success: true, result: cancelResult });

      case 'get_workflow_details':
        const details = await analytics.getWorkflowDetails(workflowId, brand);
        return NextResponse.json({ success: true, details });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('[Social Metrics] Action error:', error);
    return NextResponse.json({
      success: false,
      error: 'Action failed'
    }, { status: 500 });
  }
}