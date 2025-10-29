// API endpoint to check Submagic job status
import { NextRequest, NextResponse } from 'next/server';
import { checkSubmagicStatus, checkMultipleSubmagicJobs, getStuckSubmagicJobs } from '@/lib/submagic-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET - Check Submagic job status
 * Query params:
 *   - jobId: Single job ID to check
 *   - jobIds: Comma-separated list of job IDs
 *   - stuck: If true, get stuck Submagic jobs from Firestore
 *   - brands: Comma-separated list of brands to filter (when getting stuck jobs)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const jobIds = searchParams.get('jobIds');
    const stuck = searchParams.get('stuck') === 'true';
    const brands = searchParams.get('brands')?.split(',').filter(Boolean);

    // Get stuck jobs from Firestore
    if (stuck) {
      const stuckJobs = await getStuckSubmagicJobs(brands);

      // Extract Submagic job IDs
      const submagicJobIds = stuckJobs
        .map(w => w.submagicJobId)
        .filter(Boolean);

      // Check status of all stuck jobs
      const statuses = submagicJobIds.length > 0
        ? await checkMultipleSubmagicJobs(submagicJobIds)
        : {};

      // Combine workflow data with Submagic status
      const results = stuckJobs.map(workflow => {
        const submagicStatus = workflow.submagicJobId
          ? statuses[workflow.submagicJobId]
          : null;

        return {
          workflowId: workflow.id,
          brand: workflow.brand,
          submagicJobId: workflow.submagicJobId,
          currentStage: workflow.currentStage,
          lastUpdated: workflow.lastUpdated,
          submagicStatus: submagicStatus?.status || 'unknown',
          submagicError: submagicStatus?.error,
          videoUrl: submagicStatus?.video_url,
          stuckDuration: workflow.lastUpdated
            ? Math.floor((Date.now() - new Date(workflow.lastUpdated).getTime()) / 1000 / 60) // minutes
            : 0,
        };
      });

      return NextResponse.json({
        success: true,
        stuck: true,
        count: results.length,
        results,
      });
    }

    // Check multiple job IDs
    if (jobIds) {
      const ids = jobIds.split(',').filter(Boolean);
      const statuses = await checkMultipleSubmagicJobs(ids);

      return NextResponse.json({
        success: true,
        statuses,
      });
    }

    // Check single job ID
    if (jobId) {
      const status = await checkSubmagicStatus(jobId);

      return NextResponse.json({
        success: true,
        status,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Missing required parameter: jobId, jobIds, or stuck=true',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error checking Submagic status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check Submagic status',
      },
      { status: 500 }
    );
  }
}
