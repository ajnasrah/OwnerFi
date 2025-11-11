// Retry workflows that failed due to LinkedIn visibility error
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }
    console.log('🔍 Finding workflows that failed due to LinkedIn visibility error...');

    // Import Firebase Admin for direct Firestore access
    const { getFirestore } = await import('firebase-admin/firestore');
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');

    // Initialize Firebase Admin if needed
    if (getApps().length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        return NextResponse.json({ error: 'Firebase Admin credentials not configured' }, { status: 500 });
      }

      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey })
      });
    }

    const db = getFirestore();
    const results = [];

    // Check both Carz and OwnerFi collections
    for (const brand of ['carz', 'ownerfi']) {
      const collectionName = brand === 'carz' ? 'carz_workflow_queue' : 'ownerfi_workflow_queue';

      const snapshot = await db.collection(collectionName)
        .where('status', '==', 'failed')
        .get();

      for (const doc of snapshot.docs) {
        const workflow = doc.data();

        // Check if error contains LinkedIn visibility issue
        if (workflow.error &&
            workflow.error.includes('linkedinData') &&
            workflow.error.includes('visibility')) {

          const submagicProjectId = workflow.submagicVideoId;

          if (!submagicProjectId) {
            console.log(`⚠️  Workflow ${doc.id} has LinkedIn error but no Submagic ID`);
            results.push({
              workflowId: doc.id,
              brand,
              articleTitle: workflow.articleTitle,
              action: 'skipped',
              reason: 'no_submagic_id'
            });
            continue;
          }

          console.log(`\n🔄 Retrying ${brand} workflow: ${workflow.articleTitle}`);
          console.log(`   Submagic ID: ${submagicProjectId}`);

          // Manually trigger the Submagic webhook to retry posting
          // The new code has the LinkedIn fix, so it should work now
          const baseUrl = 'https://ownerfi.ai'; // Use production URL directly
          const webhookResponse = await fetch(`${baseUrl}/api/webhooks/submagic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: submagicProjectId,
              status: 'completed',
              timestamp: new Date().toISOString()
            })
          });

          const webhookResult = await webhookResponse.json();

          console.log(`   ✅ Webhook triggered:`, webhookResult);

          results.push({
            workflowId: doc.id,
            brand,
            articleTitle: workflow.articleTitle,
            submagicProjectId,
            action: 'retried',
            webhookResult
          });
        }
      }
    }

    console.log(`\n✅ Processed ${results.length} LinkedIn failures`);

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
  return GET(request);
}
