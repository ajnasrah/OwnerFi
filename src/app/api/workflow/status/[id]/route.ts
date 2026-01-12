import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { getWorkflowById } from '@/lib/feed-store-firestore';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Verify admin authentication
    // Workflows are internal operations - only admins should access
    const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]) as ExtendedSession;
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    // Try both brands to find the workflow
    const result = await getWorkflowById(id);

    if (!result) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id,
      brand: result.brand,
      workflow: result.workflow
    });

  } catch (error) {
    console.error('Error getting workflow status:', error);
    return NextResponse.json(
      { error: 'Failed to get workflow status' },
      { status: 500 }
    );
  }
}
