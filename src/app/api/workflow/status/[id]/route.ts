import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowById } from '@/lib/feed-store-firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    // Try both brands to find the workflow
    let result = await getWorkflowById(id);

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
