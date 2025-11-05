/**
 * Manual script to fix properties stuck in Posting stage
 * This script will:
 * 1. Find properties stuck in Posting
 * 2. Check if they have Submagic video IDs
 * 3. Download videos from Submagic → Upload to R2 → Post to Late
 */

import { getAdminDb } from '../src/lib/firebase-admin';
import { postToLate } from '../src/lib/late-api';
import { uploadSubmagicVideo } from '../src/lib/video-storage';
import { getBrandPlatforms } from '../src/lib/brand-utils';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

async function fixStuckProperties() {
  try {
    console.log('🔍 Finding properties stuck in Posting stage...\n');

    const adminDb = await getAdminDb();
    if (!adminDb) {
      throw new Error('Failed to initialize Firebase Admin');
    }

    const snapshot = await (adminDb as any)
      .collection('properties')
      .where('workflowStatus.stage', '==', 'Posting')
      .orderBy('workflowStatus.lastUpdated', 'desc')
      .limit(20)
      .get();

    console.log(`Found ${snapshot.size} properties in Posting stage\n`);

    if (snapshot.empty) {
      console.log('✅ No stuck properties found!');
      return;
    }

    let fixed = 0;
    let failed = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const propertyId = doc.id;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📍 Property: ${data.address}, ${data.city}, ${data.state}`);
      console.log(`   ID: ${propertyId}`);
      console.log(`   Stage: ${data.workflowStatus?.stage}`);
      console.log(`   Last Updated: ${new Date(data.workflowStatus?.lastUpdated).toLocaleString()}`);
      console.log(`   HeyGen ID: ${data.workflowStatus?.heygenVideoId || 'N/A'}`);
      console.log(`   Submagic ID: ${data.workflowStatus?.submagicVideoId || 'N/A'}`);

      try {
        const submagicVideoId = data.workflowStatus?.submagicVideoId;

        if (!submagicVideoId) {
          console.log('   ❌ No Submagic video ID found - skipping');
          failed++;
          continue;
        }

        // Step 1: Get fresh video URL from Submagic
        console.log(`\n   🔄 Fetching video from Submagic API...`);
        const submagicUrl = await fetchSubmagicVideo(submagicVideoId);
        console.log(`   ✅ Got Submagic video URL`);

        // Step 2: Upload to R2
        console.log(`   ☁️  Uploading to R2...`);
        const storagePath = `property/submagic-videos/${propertyId}.mp4`;
        const publicVideoUrl = await uploadSubmagicVideo(submagicUrl, storagePath);
        console.log(`   ✅ Uploaded to R2: ${publicVideoUrl}`);

        // Step 3: Post to Late
        const platforms = getBrandPlatforms('property', false);
        const caption = `${data.address}, ${data.city}, ${data.state} • Down: $${data.downPayment?.toLocaleString()} • Monthly: $${data.monthlyPayment?.toLocaleString()} 🏡`;
        const title = `${data.address} - Owner Finance Property`;

        console.log(`   📱 Posting to Late (${platforms.join(', ')})...`);

        const postResult = await postToLate({
          videoUrl: publicVideoUrl,
          caption,
          title,
          platforms: platforms as any[],
          useQueue: true,
          brand: 'property',
        });

        if (postResult.success) {
          console.log(`   ✅ Posted successfully! Post ID: ${postResult.postId}`);

          // Update property status to Completed
          await (adminDb as any).collection('properties').doc(propertyId).update({
            'workflowStatus.stage': 'Completed',
            'workflowStatus.finalVideoUrl': publicVideoUrl,
            'workflowStatus.latePostId': postResult.postId,
            'workflowStatus.completedAt': Date.now(),
            'workflowStatus.lastUpdated': Date.now(),
          });

          console.log(`   ✅ Property marked as Completed`);
          fixed++;
        } else {
          throw new Error(`Late posting failed: ${postResult.error}`);
        }

      } catch (error) {
        console.error(`   ❌ Error processing property:`, error);
        failed++;

        // Update with error
        await (adminDb as any).collection('properties').doc(propertyId).update({
          'workflowStatus.error': error instanceof Error ? error.message : 'Unknown error',
          'workflowStatus.lastUpdated': Date.now(),
        });
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`\n✅ Script complete!`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${snapshot.size}`);

  } catch (error) {
    console.error('❌ Script error:', error);
    process.exit(1);
  }
}

async function fetchSubmagicVideo(projectId: string): Promise<string> {
  const response = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
    headers: { 'x-api-key': SUBMAGIC_API_KEY! }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Submagic API error ${response.status}: ${errorText}`);
  }

  const projectData = await response.json();

  const videoUrl = projectData.media_url ||
                   projectData.video_url ||
                   projectData.downloadUrl ||
                   projectData.download_url ||
                   projectData.export_url;

  if (!videoUrl) {
    throw new Error(`No video URL found in Submagic project (status: ${projectData.status})`);
  }

  return videoUrl;
}

// Run the script
fixStuckProperties()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
