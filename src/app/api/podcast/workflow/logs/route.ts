// Podcast Workflow Logs API
// Returns active podcast generation workflows for status tracking

import { NextResponse } from 'next/server';
import { getPodcastWorkflows } from '@/lib/feed-store-firestore';

export async function GET() {
  try {
    const workflows = await getPodcastWorkflows(20);

    return NextResponse.json({
      success: true,
      workflows: workflows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching podcast workflows:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
