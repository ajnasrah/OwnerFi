// Retry Failed Workflows Endpoint
// Auto-retry workflows that failed due to transient errors

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getRetryableWorkflows, retryWorkflow } from '@/lib/feed-store-firestore';

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_RETRIES = 3;

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const session = await getServerSession(authOptions as any);
    const isAdmin = session?.user && (session.user as any).role === 'admin';

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('♻️  Checking for retryable workflows...');

    // Get failed workflows for both brands
    const carzRetryable = await getRetryableWorkflows('carz', MAX_RETRIES);
    const ownerfiRetryable = await getRetryableWorkflows('ownerfi', MAX_RETRIES);

    console.log(`   Found ${carzRetryable.length} Carz + ${ownerfiRetryable.length} OwnerFi retryable workflows`);

    const retried = [];
    const errors = [];

    // Retry Carz workflows
    for (const workflow of carzRetryable) {
      try {
        await retryWorkflow(workflow.id, 'carz');
        retried.push({ id: workflow.id, brand: 'carz' });
      } catch (error) {
        console.error(`Failed to retry ${workflow.id}:`, error);
        errors.push({ id: workflow.id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // Retry OwnerFi workflows
    for (const workflow of ownerfiRetryable) {
      try {
        await retryWorkflow(workflow.id, 'ownerfi');
        retried.push({ id: workflow.id, brand: 'ownerfi' });
      } catch (error) {
        console.error(`Failed to retry ${workflow.id}:`, error);
        errors.push({ id: workflow.id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // Trigger workflows (fire and forget)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                    'https://ownerfi.ai';

    if (carzRetryable.length > 0) {
      fetch(`${baseUrl}/api/workflow/complete-viral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: 'carz',
          platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
          schedule: 'immediate'
        })
      }).catch(err => console.error('Carz retry trigger error:', err));
    }

    if (ownerfiRetryable.length > 0) {
      fetch(`${baseUrl}/api/workflow/complete-viral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: 'ownerfi',
          platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
          schedule: 'immediate'
        })
      }).catch(err => console.error('OwnerFi retry trigger error:', err));
    }

    console.log(`✅ Retried ${retried.length} workflows, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      message: `Retried ${retried.length} workflows`,
      retried,
      errors,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Retry failed workflows error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
