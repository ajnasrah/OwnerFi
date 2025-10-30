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

async function findAllStuckWorkflows() {
  console.log('🔍 Scanning ALL collections for stuck HeyGen workflows...\n');

  const collections = [
    'abdullah_queue',
    'viral_workflows',
    'carz_workflows',
    'ownerfi_workflows',
    'vassdistro_workflows',
    'benefit_workflows',
    'property_videos',
    'podcast_episodes'
  ];

  let totalStuck = 0;
  const stuckWorkflows: any[] = [];

  for (const collectionName of collections) {
    try {
      console.log(`📂 Checking ${collectionName}...`);

      // Get all documents ordered by updatedAt
      const snapshot = await db.collection(collectionName)
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get();

      if (snapshot.empty) {
        console.log(`   ⚠️  Empty collection\n`);
        continue;
      }

      console.log(`   Found ${snapshot.size} recent documents`);

      // Filter for heygen_processing status
      const stuck = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data.status === 'heygen_processing';
      });

      if (stuck.length > 0) {
        console.log(`   🚨 ${stuck.length} STUCK in heygen_processing`);

        stuck.forEach(doc => {
          const data = doc.data();
          const hoursSinceUpdated = data.updatedAt ?
            ((Date.now() - data.updatedAt) / (1000 * 60 * 60)).toFixed(1) :
            'Unknown';

          stuckWorkflows.push({
            collection: collectionName,
            id: doc.id,
            heygenVideoId: data.heygenVideoId,
            hoursSinceUpdated,
            updatedAt: data.updatedAt,
            title: data.title || data.address || 'No title'
          });
        });
      } else {
        console.log(`   ✅ No stuck workflows`);
      }

      // Also show status breakdown
      const statuses: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const status = doc.data().status || 'unknown';
        statuses[status] = (statuses[status] || 0) + 1;
      });

      console.log(`   Status breakdown:`, statuses);
      console.log('');

      totalStuck += stuck.length;

    } catch (error: any) {
      if (error.code === 9 && error.message.includes('index')) {
        console.log(`   ⚠️  No index for updatedAt - trying without orderBy...\n`);

        try {
          const snapshot = await db.collection(collectionName).limit(50).get();

          if (!snapshot.empty) {
            const stuck = snapshot.docs.filter(doc => doc.data().status === 'heygen_processing');

            if (stuck.length > 0) {
              console.log(`   🚨 ${stuck.length} STUCK in heygen_processing`);
              stuck.forEach(doc => {
                const data = doc.data();
                const hoursSinceUpdated = data.updatedAt ?
                  ((Date.now() - data.updatedAt) / (1000 * 60 * 60)).toFixed(1) :
                  'Unknown';

                stuckWorkflows.push({
                  collection: collectionName,
                  id: doc.id,
                  heygenVideoId: data.heygenVideoId,
                  hoursSinceUpdated,
                  updatedAt: data.updatedAt,
                  title: data.title || data.address || 'No title'
                });
              });
              totalStuck += stuck.length;
            }
          }
        } catch (retryError) {
          console.log(`   ❌ Error even without orderBy:`, retryError);
        }
        console.log('');
      } else {
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }
  }

  console.log('='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total stuck in heygen_processing: ${totalStuck}\n`);

  if (stuckWorkflows.length > 0) {
    console.log('🚨 STUCK WORKFLOWS:\n');

    // Sort by hours since updated (oldest first)
    stuckWorkflows.sort((a, b) => {
      const aHours = parseFloat(a.hoursSinceUpdated);
      const bHours = parseFloat(b.hoursSinceUpdated);
      return bHours - aHours;
    });

    stuckWorkflows.forEach((workflow, index) => {
      console.log(`${index + 1}. [${workflow.collection}] ${workflow.id}`);
      console.log(`   HeyGen Video ID: ${workflow.heygenVideoId || 'None'}`);
      console.log(`   Stuck for: ${workflow.hoursSinceUpdated} hours`);
      console.log(`   Title: ${workflow.title.substring(0, 60)}...`);
      console.log('');
    });

    console.log('💡 SOLUTIONS:');
    console.log('1. Run unstick script: npx tsx scripts/unstick-workflows.ts');
    console.log('2. Check HeyGen status for each video ID manually');
    console.log('3. Verify webhook endpoints are receiving callbacks');
  }
}

findAllStuckWorkflows()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
