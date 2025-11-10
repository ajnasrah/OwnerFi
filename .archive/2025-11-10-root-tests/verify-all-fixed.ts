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

async function verifyAllFixed() {
  console.log('🔍 VERIFICATION REPORT - All Workflows Status\n');
  console.log('='.repeat(60));

  const brands = [
    { name: 'OwnerFi', collection: 'ownerfi_workflow_queue' },
    { name: 'Carz', collection: 'carz_workflow_queue' },
    { name: 'VassDistro', collection: 'vassdistro_workflow_queue' },
    { name: 'Podcast', collection: 'podcast_workflow_queue' },
    { name: 'Benefit', collection: 'benefit_workflow_queue' },
    { name: 'Abdullah', collection: 'abdullah_content_queue' },
    { name: 'Buyer', collection: 'buyer' },
  ];

  const cutoff48h = Date.now() - (48 * 60 * 60 * 1000);
  const cutoff24h = Date.now() - (24 * 60 * 60 * 1000);

  let totalFailed48h = 0;
  let totalFailed24h = 0;
  let totalProcessing = 0;
  let totalCompleted24h = 0;

  for (const brand of brands) {
    console.log(`\n📊 ${brand.name.toUpperCase()}`);
    console.log('-'.repeat(60));

    try {
      const snapshot = await db.collection(brand.collection).get();

      const all = snapshot.docs.map(doc => {
        const data = doc.data();
        const created = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
        return { id: doc.id, created, ...data };
      });

      const recent48h = all.filter(w => w.created && w.created.getTime() > cutoff48h);
      const recent24h = all.filter(w => w.created && w.created.getTime() > cutoff24h);

      // Status breakdown
      const statusBreakdown = recent48h.reduce((acc, w) => {
        acc[w.status] = (acc[w.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log(`📈 Last 48 hours: ${recent48h.length} workflows`);
      console.log(`   Status:`, statusBreakdown);

      // Failed workflows
      const failed48h = recent48h.filter(w => w.status === 'failed');
      const failed24h = recent24h.filter(w => w.status === 'failed');

      totalFailed48h += failed48h.length;
      totalFailed24h += failed24h.length;

      if (failed48h.length > 0) {
        console.log(`\n   ❌ ${failed48h.length} FAILED (48h):`);
        failed48h.slice(0, 3).forEach(w => {
          const hoursAgo = Math.round((Date.now() - w.created.getTime()) / (1000 * 60 * 60));
          console.log(`      • ${w.title || w.id} (${hoursAgo}h ago)`);
          console.log(`        ${w.error || 'No error message'}`);
        });
      } else {
        console.log(`   ✅ No failed workflows in last 48h`);
      }

      // Processing workflows
      const processing = recent48h.filter(w =>
        w.status && (
          w.status.includes('processing') ||
          w.status === 'pending' ||
          w.status === 'posting'
        )
      );

      totalProcessing += processing.length;

      if (processing.length > 0) {
        console.log(`\n   ⏳ ${processing.length} PROCESSING:`);
        processing.slice(0, 3).forEach(w => {
          const hoursAgo = Math.round((Date.now() - w.created.getTime()) / (1000 * 60 * 60));
          console.log(`      • ${w.title || w.id}`);
          console.log(`        Status: ${w.status} (${hoursAgo}h ago)`);
        });
      }

      // Completed workflows
      const completed24h = recent24h.filter(w => w.status === 'completed');
      totalCompleted24h += completed24h.length;

      if (completed24h.length > 0) {
        const latest = completed24h[0];
        const completedTime = latest.completedAt?.toDate ? latest.completedAt.toDate() : null;
        const hoursAgo = completedTime ? Math.round((Date.now() - completedTime.getTime()) / (1000 * 60 * 60)) : 'unknown';
        console.log(`\n   ✅ ${completed24h.length} completed in last 24h`);
        console.log(`      Latest: ${latest.title || latest.id} (${hoursAgo}h ago)`);
      } else {
        console.log(`\n   ⚠️  No completions in last 24h`);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 OVERALL SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n🔴 Failed (48h):     ${totalFailed48h}`);
  console.log(`🔴 Failed (24h):     ${totalFailed24h}`);
  console.log(`⏳ Processing:       ${totalProcessing}`);
  console.log(`✅ Completed (24h):  ${totalCompleted24h}`);

  if (totalFailed24h === 0 && totalCompleted24h > 0) {
    console.log('\n🎉 ALL SYSTEMS OPERATIONAL!');
    console.log('   - No failures in last 24 hours');
    console.log('   - Workflows completing successfully');
  } else if (totalFailed24h === 0) {
    console.log('\n✅ NO ACTIVE FAILURES');
    console.log('   - All workflows either completed or processing');
  } else {
    console.log('\n⚠️  ATTENTION NEEDED');
    console.log(`   - ${totalFailed24h} workflows failed in last 24h`);
  }

  console.log('\n' + '='.repeat(60));
}

verifyAllFixed().catch(console.error);
