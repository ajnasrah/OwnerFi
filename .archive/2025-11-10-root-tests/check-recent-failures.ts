import admin from 'firebase-admin';
import { config } from 'dotenv';

config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function checkRecentFailures() {
  console.log('🔍 Checking for recent failures (last 48 hours)...\n');

  const brands = ['ownerfi', 'carz', 'vassdistro', 'abdullah_content'];
  const cutoffTime = Date.now() - (48 * 60 * 60 * 1000);

  for (const brand of brands) {
    const collectionName = brand === 'abdullah_content' ? 'abdullah_content_queue' : `${brand}_workflow_queue`;
    console.log(`\n📰 Checking ${collectionName}...`);

    try {
      const snapshot = await db.collection(collectionName).get();

      const recent = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(data => {
          const created = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
          return created && created.getTime() > cutoffTime;
        })
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return bTime.getTime() - aTime.getTime();
        });

      console.log(`   Total recent workflows: ${recent.length}`);

      const byStatus = recent.reduce((acc, w) => {
        acc[w.status] = (acc[w.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log(`   Status breakdown:`, byStatus);

      const failed = recent.filter(w => w.status === 'failed');
      if (failed.length > 0) {
        console.log(`\n   ❌ ${failed.length} FAILED WORKFLOWS:`);
        failed.slice(0, 5).forEach(w => {
          const created = w.createdAt?.toDate ? w.createdAt.toDate() : new Date(w.createdAt);
          const hoursAgo = Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60));
          console.log(`      • ${w.title || w.id} (${hoursAgo}h ago)`);
          console.log(`        Error: ${w.error || 'No error message'}`);
        });
      }

      const completed = recent.filter(w => w.status === 'completed');
      if (completed.length > 0) {
        console.log(`\n   ✅ Last completed: ${completed[0].title || completed[0].id}`);
        const completedTime = completed[0].completedAt?.toDate ? completed[0].completedAt.toDate() : null;
        if (completedTime) {
          const hoursAgo = Math.round((Date.now() - completedTime.getTime()) / (1000 * 60 * 60));
          console.log(`      Completed ${hoursAgo}h ago`);
        }
      }
    } catch (error) {
      console.log(`   ⚠️ Error: ${error}`);
    }
  }

  console.log('\n✅ Done!');
}

checkRecentFailures().catch(console.error);
