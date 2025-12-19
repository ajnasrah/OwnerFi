import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore';

/**
 * API endpoint to check and complete stuck HeyGen video workflows
 *
 * GET /api/workflow/check-stuck
 *
 * This will:
 * 1. Find workflows stuck in "heygen_processing" status
 * 2. Check HeyGen API for actual video status
 * 3. Update workflow status accordingly
 */
export async function GET() {
  try {
    console.log('🔍 Checking for stuck HeyGen workflows...');

    // Get workflows stuck in heygen_processing (older than 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const q = query(
      collection(db, 'property_video_workflows'),
      where('status', '==', 'heygen_processing'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No stuck workflows found',
        checked: 0,
        completed: 0,
        failed: 0
      });
    }

    const results = {
      checked: 0,
      completed: 0,
      failed: 0,
      stillProcessing: 0,
      errors: [] as string[]
    };

    for (const workflowDoc of snapshot.docs) {
      const data = workflowDoc.data();
      const workflowId = workflowDoc.id;
      results.checked++;

      const createdAt = data.createdAt?.toDate();
      const ageMinutes = createdAt ? Math.round((Date.now() - createdAt.getTime()) / 60000) : 0;

      console.log(`\nChecking workflow ${workflowId} (age: ${ageMinutes}m)`);

      // Skip if no HeyGen video ID
      if (!data.heygenVideoId) {
        console.log('No HeyGen video ID - marking as failed');

        await updateDoc(doc(db, 'property_video_workflows', workflowId), {
          status: 'failed',
          error: 'No HeyGen video ID found',
          updatedAt: new Date()
        });

        results.failed++;
        continue;
      }

      // Check HeyGen video status
      try {
        const heygenStatus = await checkHeyGenVideoStatus(data.heygenVideoId);

        if (heygenStatus.data?.status === 'completed') {
          console.log(`✅ Video completed! Updating workflow...`);

          await updateDoc(doc(db, 'property_video_workflows', workflowId), {
            status: 'heygen_completed',
            heygenVideoUrl: heygenStatus.data.video_url,
            updatedAt: new Date()
          });

          results.completed++;

        } else if (heygenStatus.data?.status === 'failed') {
          console.log(`❌ Video failed`);

          await updateDoc(doc(db, 'property_video_workflows', workflowId), {
            status: 'failed',
            error: `HeyGen failed: ${heygenStatus.data?.error || 'unknown'}`,
            updatedAt: new Date()
          });

          results.failed++;

        } else if (heygenStatus.data?.status === 'processing') {
          if (ageMinutes > 60) {
            console.log(`⚠️  Still processing after ${ageMinutes}m - timing out`);

            await updateDoc(doc(db, 'property_video_workflows', workflowId), {
              status: 'failed',
              error: `Timeout after ${ageMinutes} minutes`,
              updatedAt: new Date()
            });

            results.failed++;
          } else {
            console.log(`⏳ Still processing (${ageMinutes}m) - this is normal`);
            results.stillProcessing++;
          }
        }

      } catch (error) {
        console.error(`Error checking workflow ${workflowId}:`, error.message);
        results.errors.push(`${workflowId}: ${error.message}`);

        // If very old (60+ min), mark as failed
        if (ageMinutes > 60) {
          await updateDoc(doc(db, 'property_video_workflows', workflowId), {
            status: 'failed',
            error: `Timeout after ${ageMinutes} minutes - couldn't check HeyGen status`,
            updatedAt: new Date()
          });

          results.failed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Stuck workflow check complete',
      ...results
    });

  } catch (error) {
    console.error('Error checking stuck workflows:', error);

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Check HeyGen video status
 */
async function checkHeyGenVideoStatus(videoId: string): Promise<any> {
  const apiKey = process.env.HEYGEN_API_KEY;

  if (!apiKey) {
    throw new Error('HEYGEN_API_KEY not configured');
  }

  const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    headers: {
      'accept': 'application/json',
      'x-api-key': apiKey
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HeyGen API error ${response.status}: ${errorText}`);
  }

  return await response.json();
}
