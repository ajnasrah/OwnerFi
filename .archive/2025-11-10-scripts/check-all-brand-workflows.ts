import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

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

const brands = [
  { name: 'carz', collection: 'carz_workflow_queue' },
  { name: 'ownerfi', collection: 'ownerfi_workflow_queue' },
  { name: 'podcast', collection: 'podcast_workflow_queue' },
  { name: 'benefit', collection: 'benefit_workflow_queue' },
  { name: 'property', collection: 'property_workflow_queue' },
  { name: 'vassdistro', collection: 'vassdistro_workflow_queue' },
  { name: 'abdullah', collection: 'abdullah_workflow_queue' }
];

async function checkBrand(brandName: string, collectionName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🏷️  BRAND: ${brandName.toUpperCase()}`);
  console.log(`📂 Collection: ${collectionName}`);
  console.log('='.repeat(60));

  try {
    const snapshot = await db.collection(collectionName)
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .get();

    if (snapshot.empty) {
      console.log('⚠️  Collection is EMPTY\n');
      return;
    }

    console.log(`\n📊 Found ${snapshot.size} recent documents\n`);

    // Status breakdown
    const statuses: Record<string, number> = {};
    const stuckDocs: any[] = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const status = data.status || 'unknown';
      statuses[status] = (statuses[status] || 0) + 1;

      // Check if stuck (processing for > 1 hour)
      const isProcessing = status.includes('processing') || status === 'pending';
      if (isProcessing && data.updatedAt) {
        const hoursSince = (Date.now() - data.updatedAt) / (1000 * 60 * 60);
        if (hoursSince > 1) {
          stuckDocs.push({
            id: doc.id,
            status,
            hoursSince: hoursSince.toFixed(1),
            title: data.title || data.address || 'No title',
            heygenVideoId: data.heygenVideoId,
            submagicJobId: data.submagicJobId
          });
        }
      }
    });

    console.log('📈 Status Breakdown:');
    Object.entries(statuses)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });

    if (stuckDocs.length > 0) {
      console.log(`\n🚨 STUCK WORKFLOWS: ${stuckDocs.length}`);
      stuckDocs.forEach((doc, i) => {
        console.log(`\n   ${i + 1}. ID: ${doc.id}`);
        console.log(`      Status: ${doc.status}`);
        console.log(`      Stuck for: ${doc.hoursSince} hours`);
        console.log(`      Title: ${doc.title.substring(0, 50)}...`);
        if (doc.heygenVideoId) console.log(`      HeyGen ID: ${doc.heygenVideoId}`);
        if (doc.submagicJobId) console.log(`      Submagic ID: ${doc.submagicJobId}`);
      });
    } else {
      console.log('\n✅ No stuck workflows (all processing < 1 hour old)');
    }

  } catch (error: any) {
    if (error.code === 9) {
      console.log('⚠️  No index - trying without orderBy...\n');
      try {
        const snapshot = await db.collection(collectionName).limit(50).get();
        if (snapshot.empty) {
          console.log('⚠️  Collection is EMPTY\n');
        } else {
          console.log(`📊 Found ${snapshot.size} documents (unordered)\n`);
          const statuses: Record<string, number> = {};
          snapshot.docs.forEach(doc => {
            const status = doc.data().status || 'unknown';
            statuses[status] = (statuses[status] || 0) + 1;
          });
          console.log('📈 Status Breakdown:');
          Object.entries(statuses).forEach(([status, count]) => {
            console.log(`   ${status}: ${count}`);
          });
        }
      } catch (e) {
        console.log('❌ Error:', e);
      }
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

async function main() {
  console.log('🔍 CHECKING ALL 7 SUB BRANDS FOR STUCK WORKFLOWS\n');

  for (const brand of brands) {
    await checkBrand(brand.name, brand.collection);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ SCAN COMPLETE');
  console.log('='.repeat(60) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
