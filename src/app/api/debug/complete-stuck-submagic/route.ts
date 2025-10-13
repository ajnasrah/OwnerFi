// Manually complete a stuck Submagic video
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

    if (!SUBMAGIC_API_KEY) {
      return NextResponse.json({ error: 'Submagic API key not configured' }, { status: 500 });
    }

    console.log(`🔍 Fetching Submagic project: ${projectId}`);

    // Get project details from Submagic
    const response = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
      headers: {
        'x-api-key': SUBMAGIC_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Submagic API error:', errorText);
      return NextResponse.json({
        error: `Submagic API error: ${response.status}`,
        details: errorText
      }, { status: response.status });
    }

    const projectData = await response.json();
    console.log('✅ Project data:', JSON.stringify(projectData, null, 2));

    // Extract download URL
    const downloadUrl = projectData.media_url || projectData.video_url || projectData.downloadUrl;

    if (!downloadUrl) {
      return NextResponse.json({
        error: 'No download URL found in project',
        projectData
      }, { status: 400 });
    }

    console.log(`📥 Download URL: ${downloadUrl}`);

    // Now manually trigger the webhook handler
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
    const webhookResponse = await fetch(`${baseUrl}/api/webhooks/submagic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectId: projectId,
        id: projectId,
        status: 'completed',
        downloadUrl: downloadUrl,
        media_url: downloadUrl,
        timestamp: new Date().toISOString()
      })
    });

    const webhookResult = await webhookResponse.json();

    console.log('✅ Webhook triggered:', JSON.stringify(webhookResult, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Manually triggered webhook completion',
      projectData: {
        id: projectData.id,
        status: projectData.status,
        downloadUrl: downloadUrl
      },
      webhookResult
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
