/**
 * Diagnose social media posting system
 * Checks workflow queues across all brands to find where things are stuck
 *
 * Usage: npx tsx scripts/diagnose-social.ts
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

const BRANDS = ['ownerfi', 'carz', 'abdullah', 'benefit', 'gaza', 'realtors', 'personal'];

async function main() {
  console.log('=== Social Media System Diagnosis ===');
  console.log(`Time: ${new Date().toISOString()}\n`);

  // 1. Check env vars
  console.log('--- Environment Variables ---');
  const envVars = [
    'LATE_API_KEY',
    'LATE_OWNERFI_PROFILE_ID',
    'LATE_CARZ_PROFILE_ID',
    'LATE_ABDULLAH_PROFILE_ID',
    'LATE_GAZA_PROFILE_ID',
    'LATE_BENEFIT_PROFILE_ID',
    'VIDEO_PROVIDER',
    'HEYGEN_API_KEY',
    'SYNTHESIA_API_KEY',
    'SUBMAGIC_API_KEY',
    'SUBMAGIC_WEBHOOK_SECRET',
    'CRON_SECRET',
    'OPENAI_API_KEY',
  ];
  envVars.forEach(v => {
    const val = process.env[v];
    const status = val ? `SET (${val.substring(0, 8)}...)` : 'MISSING';
    console.log(`  ${v}: ${status}`);
  });

  console.log(`\n  VIDEO_PROVIDER = ${process.env.VIDEO_PROVIDER || 'NOT SET (defaults to synthesia)'}`);
  console.log(`  LATE_BYPASS_QUEUE = ${process.env.LATE_BYPASS_QUEUE || 'NOT SET (defaults to false)'}`);

  // 2. Check workflow queues for each brand
  console.log('\n--- Workflow Queue Status (Last 7 Days) ---');

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const brand of BRANDS) {
    const collectionName = `${brand}_workflow_queue`;

    try {
      // Get recent workflows
      const recentSnap = await db.collection(collectionName)
        .where('createdAt', '>=', sevenDaysAgo)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      if (recentSnap.empty) {
        console.log(`\n  [${brand.toUpperCase()}] No workflows in last 7 days`);
        continue;
      }

      // Count by status
      const statusCounts: Record<string, number> = {};
      const stuckWorkflows: any[] = [];
      const failedWorkflows: any[] = [];

      recentSnap.docs.forEach((doc: any) => {
        const d = doc.data();
        const status = d.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        // Check for stuck workflows (not completed/failed and older than 2 hours)
        const age = Date.now() - (d.createdAt || 0);
        const twoHours = 2 * 60 * 60 * 1000;
        if (!['completed', 'failed', 'budget_exceeded'].includes(status) && age > twoHours) {
          stuckWorkflows.push({
            id: doc.id,
            status,
            age: Math.round(age / 3600000) + 'h',
            title: (d.articleTitle || d.title || '').substring(0, 40),
            error: d.error,
            videoProvider: d.videoProvider,
          });
        }

        if (status === 'failed') {
          failedWorkflows.push({
            id: doc.id,
            error: (d.error || 'unknown').substring(0, 80),
            age: Math.round(age / 3600000) + 'h ago',
            title: (d.articleTitle || d.title || '').substring(0, 40),
          });
        }
      });

      console.log(`\n  [${brand.toUpperCase()}] ${recentSnap.size} workflows (last 7 days)`);
      Object.entries(statusCounts).sort().forEach(([status, count]) => {
        const icon = status === 'completed' ? 'OK' : status === 'failed' ? 'FAIL' : 'WARN';
        console.log(`    ${icon} ${status}: ${count}`);
      });

      if (stuckWorkflows.length > 0) {
        console.log(`    STUCK WORKFLOWS (${stuckWorkflows.length}):`);
        stuckWorkflows.forEach(w => {
          console.log(`      - ${w.id} | status: ${w.status} | age: ${w.age} | ${w.title}`);
          if (w.error) console.log(`        error: ${w.error}`);
        });
      }

      if (failedWorkflows.length > 0) {
        console.log(`    RECENT FAILURES (${failedWorkflows.length}):`);
        failedWorkflows.slice(0, 5).forEach(w => {
          console.log(`      - ${w.id} | ${w.age} | ${w.title}`);
          console.log(`        error: ${w.error}`);
        });
      }

    } catch (err: any) {
      // If index doesn't exist, try without ordering
      if (err.code === 9) {
        try {
          const allSnap = await db.collection(collectionName).limit(5).get();
          console.log(`\n  [${brand.toUpperCase()}] ${allSnap.size} workflows (index missing, showing sample)`);
          allSnap.docs.forEach((doc: any) => {
            const d = doc.data();
            console.log(`    - ${doc.id} | status: ${d.status} | created: ${new Date(d.createdAt || 0).toISOString().split('T')[0]}`);
          });
        } catch {
          console.log(`\n  [${brand.toUpperCase()}] Collection not accessible`);
        }
      } else {
        console.log(`\n  [${brand.toUpperCase()}] Error: ${err.message}`);
      }
    }
  }

  // 3. Check Late failures collection
  console.log('\n--- Late Posting Failures (Last 7 Days) ---');
  try {
    const failSnap = await db.collection('late_failures')
      .where('timestamp', '>=', sevenDaysAgo)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    if (failSnap.empty) {
      console.log('  No Late posting failures recorded');
    } else {
      console.log(`  ${failSnap.size} failures:`);
      failSnap.docs.forEach((doc: any) => {
        const d = doc.data();
        console.log(`    - ${d.brand} | ${new Date(d.timestamp).toISOString().split('T')[0]} | ${(d.error || '').substring(0, 60)}`);
      });
    }
  } catch (err: any) {
    if (err.code === 9) {
      console.log('  (Index not available - checking without time filter)');
      try {
        const failSnap = await db.collection('late_failures').limit(5).get();
        if (failSnap.empty) {
          console.log('  No Late posting failures at all');
        } else {
          failSnap.docs.forEach((doc: any) => {
            const d = doc.data();
            console.log(`    - ${d.brand} | ${(d.error || '').substring(0, 60)}`);
          });
        }
      } catch {
        console.log('  Collection does not exist');
      }
    }
  }

  // 4. Check articles pipeline
  console.log('\n--- Article Pipeline Status ---');
  for (const brand of ['ownerfi', 'carz']) {
    try {
      // Check unprocessed articles
      const unprocessed = await db.collection(`${brand}_articles`)
        .where('processed', '==', false)
        .limit(10)
        .get();

      const articles = unprocessed.docs.map((d: any) => d.data());
      const quality = articles.filter((a: any) => typeof a.qualityScore === 'number' && a.qualityScore >= 30);

      console.log(`  [${brand.toUpperCase()}] Unprocessed: ${unprocessed.size}, Quality (score>=30): ${quality.length}`);
      if (quality.length > 0) {
        const top = quality.sort((a: any, b: any) => (b.qualityScore || 0) - (a.qualityScore || 0))[0];
        console.log(`    Top: "${(top.title || '').substring(0, 50)}" (score: ${top.qualityScore})`);
      } else {
        console.log(`    ** NO QUALITY ARTICLES - cron will skip this brand **`);
      }
    } catch (err: any) {
      console.log(`  [${brand.toUpperCase()}] Error checking articles: ${err.message}`);
    }
  }

  // 5. Check DLQ (dead letter queue)
  console.log('\n--- Webhook Dead Letter Queue ---');
  try {
    const dlqSnap = await db.collection('webhook_dlq')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();

    if (dlqSnap.empty) {
      console.log('  No DLQ entries');
    } else {
      console.log(`  ${dlqSnap.size} recent DLQ entries:`);
      dlqSnap.docs.forEach((doc: any) => {
        const d = doc.data();
        console.log(`    - ${d.service}/${d.brand} | ${new Date(d.timestamp).toISOString()} | ${(d.error || '').substring(0, 60)}`);
      });
    }
  } catch {
    console.log('  DLQ collection not accessible');
  }

  // 6. Summary
  console.log('\n========================================');
  console.log('DIAGNOSIS SUMMARY');
  console.log('========================================');

  const missingEnv = envVars.filter(v => !process.env[v]);
  if (missingEnv.length > 0) {
    console.log(`\nMISSING ENV VARS: ${missingEnv.join(', ')}`);
  }

  console.log('\nPipeline flow:');
  console.log('  Cron → Article → Video Gen (Synthesia/HeyGen) → Synthesia Webhook');
  console.log('  → R2 Upload → Submagic Captions → Submagic Webhook');
  console.log('  → Cloud Task → R2 Upload → Late.dev Posting → Social Media');
  console.log('\nCheck Vercel function logs for runtime errors at each stage.');

  process.exit(0);
}

main().catch((e: any) => { console.error('FATAL:', e.message); process.exit(1); });
