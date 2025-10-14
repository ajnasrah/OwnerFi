// Manually complete a stuck Submagic video
import { NextRequest, NextResponse } from 'next/server';

// GET: Auto-find and complete all stuck Submagic workflows
export async function GET(request: NextRequest) {
  try {
    const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
    if (!SUBMAGIC_API_KEY) {
      return NextResponse.json({ error: 'Submagic API key not configured' }, { status: 500 });
    }

    console.log('🔍 Finding stuck Submagic workflows...');

    // Get workflows in submagic_processing status
    const { db } = await import('@/lib/firebase');
    const { collection, query, where, getDocs } = await import('firebase/firestore');

    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    const results = [];

    // Check both Carz and OwnerFi collections
    for (const brand of ['carz', 'ownerfi']) {
      const collectionName = brand === 'carz' ? 'carz_workflow_queue' : 'ownerfi_workflow_queue';

      const q = query(
        collection(db, collectionName),
        where('status', '==', 'submagic_processing')
      );

      const snapshot = await getDocs(q);

      for (const doc of snapshot.docs) {
        const workflow = doc.data();
        const submagicProjectId = workflow.submagicVideoId;

        if (!submagicProjectId) continue;

        console.log(`\n🔍 Checking ${brand} workflow ${doc.id}...`);
        console.log(`   Submagic Project: ${submagicProjectId}`);

        // Check Submagic status
        const response = await fetch(`https://api.submagic.co/v1/projects/${submagicProjectId}`, {
          headers: { 'x-api-key': SUBMAGIC_API_KEY }
        });

        if (!response.ok) {
          console.log(`   ❌ API error: ${response.status}`);
          continue;
        }

        const projectData = await response.json();
        const status = projectData.status;
        const downloadUrl = projectData.media_url || projectData.video_url || projectData.downloadUrl;

        console.log(`   Status: ${status}`);

        if (status === 'completed' || status === 'done' || status === 'ready') {
          console.log(`   ✅ Video is complete! Triggering webhook...`);

          // Manually trigger webhook
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
          const webhookResponse = await fetch(`${baseUrl}/api/webhooks/submagic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: submagicProjectId,
              id: submagicProjectId,
              status: 'completed',
              downloadUrl: downloadUrl,
              media_url: downloadUrl,
              timestamp: new Date().toISOString()
            })
          });

          const webhookResult = await webhookResponse.json();

          results.push({
            workflowId: doc.id,
            brand,
            submagicProjectId,
            action: 'completed',
            webhookResult
          });
        } else {
          results.push({
            workflowId: doc.id,
            brand,
            submagicProjectId,
            status,
            action: 'still_processing'
          });
        }
      }
    }

    console.log(`\n✅ Processed ${results.length} workflows`);

    return NextResponse.json({
      success: true,
      processed: results.length,
      workflows: results
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

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
