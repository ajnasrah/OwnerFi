import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function checkHeyGenStatus(videoId: string) {
  const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    method: 'GET',
    headers: {
      'X-Api-Key': HEYGEN_API_KEY!,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HeyGen API error: ${response.status}`);
  }

  return await response.json();
}

async function fixAllStuckHeyGen() {
  console.log('🔧 FIXING ALL STUCK HEYGEN WORKFLOWS\n');

  const collections = [
    { name: 'property_videos', idField: 'id' },
    { name: 'carz_workflows', idField: 'id' },
    { name: 'ownerfi_workflows', idField: 'id' },
    { name: 'vassdistro_workflows', idField: 'id' },
    { name: 'podcast_episodes', idField: 'id' },
    { name: 'benefit_workflows', idField: 'id' }
  ];

  let totalFixed = 0;
  let totalFailed = 0;

  for (const collection of collections) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📂 Checking ${collection.name}...`);
    console.log('='.repeat(80));

    try {
      // Get all stuck workflows
      const snapshot = await db.collection(collection.name)
        .where('status', '==', 'heygen_processing')
        .get();

      if (snapshot.empty) {
        console.log('✅ No stuck workflows\n');
        continue;
      }

      console.log(`🚨 Found ${snapshot.size} stuck workflow(s)\n`);

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const workflowId = doc.id;
        const heygenVideoId = data.heygenVideoId;

        console.log(`\n🔍 Checking: ${workflowId}`);
        console.log(`   HeyGen Video ID: ${heygenVideoId || 'NONE!'}`);

        if (!heygenVideoId) {
          console.log('   ❌ No HeyGen video ID - marking as failed');
          await doc.ref.update({
            status: 'failed',
            error: 'No HeyGen video ID found',
            updatedAt: Date.now()
          });
          totalFailed++;
          continue;
        }

        try {
          // Check actual status from HeyGen
          console.log('   📞 Checking HeyGen API...');
          const heygenStatus = await checkHeyGenStatus(heygenVideoId);

          const status = heygenStatus.data?.status;
          const videoUrl = heygenStatus.data?.video_url;

          console.log(`   HeyGen Status: ${status}`);

          if (status === 'completed' && videoUrl) {
            console.log('   ✅ COMPLETED - Updating workflow...');

            await doc.ref.update({
              status: 'completed',
              heygenVideoUrl: videoUrl,
              gifUrl: heygenStatus.data.gif_url,
              thumbnailUrl: heygenStatus.data.thumbnail_url,
              duration: heygenStatus.data.duration,
              updatedAt: Date.now()
            });

            console.log('   ✅ Fixed!');
            totalFixed++;

          } else if (status === 'processing') {
            console.log('   ⏳ Still processing - leaving as is');

          } else if (status === 'failed') {
            console.log(`   ❌ Failed in HeyGen: ${heygenStatus.data?.error || 'Unknown error'}`);

            await doc.ref.update({
              status: 'failed',
              error: heygenStatus.data?.error || 'HeyGen video generation failed',
              updatedAt: Date.now()
            });

            console.log('   ✅ Marked as failed');
            totalFailed++;

          } else {
            console.log(`   ⚠️  Unknown status: ${status}`);
          }

        } catch (error) {
          console.log(`   ❌ Error checking HeyGen: ${error instanceof Error ? error.message : 'Unknown'}`);
        }

        // Rate limit - wait 500ms between checks
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error: any) {
      console.log(`❌ Error processing collection: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Fixed (completed): ${totalFixed}`);
  console.log(`❌ Fixed (failed): ${totalFailed}`);
  console.log(`📊 Total fixed: ${totalFixed + totalFailed}`);
  console.log('');

  if (totalFixed > 0) {
    console.log('💡 Next steps:');
    console.log('   - Completed videos will now proceed to Submagic for captions');
    console.log('   - Check your automation to ensure next steps trigger');
  }
}

fixAllStuckHeyGen()
  .then(() => {
    console.log('\n✅ ALL DONE!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
