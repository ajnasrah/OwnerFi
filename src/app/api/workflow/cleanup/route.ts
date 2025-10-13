// Cleanup stuck workflows
// Marks workflows as failed if they've been processing for too long

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

const COLLECTIONS = {
  CARZ: 'carz_workflow_queue',
  OWNERFI: 'ownerfi_workflow_queue',
};

const TIMEOUT_MINUTES = 20; // Mark as failed if stuck for more than 20 minutes (10 min HeyGen + 10 min Submagic)

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    const now = Date.now();
    const timeoutMs = TIMEOUT_MINUTES * 60 * 1000;
    const cutoffTime = now - timeoutMs;

    const results = {
      carz: { checked: 0, cleaned: 0, workflows: [] as string[] },
      ownerfi: { checked: 0, cleaned: 0, workflows: [] as string[] }
    };

    // Check both collections
    for (const [brand, collectionName] of Object.entries(COLLECTIONS)) {
      const brandKey = brand.toLowerCase() as 'carz' | 'ownerfi';

      // Query for workflows stuck in processing states
      const processingQuery = query(
        collection(db, collectionName),
        where('status', 'in', ['heygen_processing', 'submagic_processing', 'posting'])
      );

      const snapshot = await getDocs(processingQuery);
      results[brandKey].checked = snapshot.size;

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const workflowId = docSnapshot.id;

        // Check if workflow has been stuck for too long
        if (data.updatedAt && data.updatedAt < cutoffTime) {
          // Mark as failed
          await updateDoc(doc(db, collectionName, workflowId), {
            status: 'failed',
            error: `Workflow timeout - stuck in ${data.status} for more than ${TIMEOUT_MINUTES} minutes`,
            updatedAt: now
          });

          results[brandKey].cleaned++;
          results[brandKey].workflows.push(workflowId);

          console.log(`✅ Cleaned up stuck workflow: ${workflowId} (${data.status} for ${Math.floor((now - data.updatedAt) / 60000)} minutes)`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
