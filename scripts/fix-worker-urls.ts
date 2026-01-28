/**
 * Fix Broken Worker URLs in Firestore
 *
 * Finds all workflow documents with the broken Cloudflare Worker URL
 * and replaces them with the working R2 public URL.
 *
 * Usage: npx ts-node scripts/fix-worker-urls.ts
 *
 * Add --dry-run flag to preview changes without updating:
 *   npx ts-node scripts/fix-worker-urls.ts --dry-run
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// URLs
const BROKEN_WORKER_URL = 'ownerfi-videos.abdullahaj.workers.dev';
const CORRECT_R2_URL = 'pub-2476f0809ce64c369348d90eb220788e.r2.dev';

// Initialize Firebase Admin
function initFirebase() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase credentials not configured');
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  return getFirestore();
}

interface WorkflowDoc {
  id: string;
  brand?: string;
  status?: string;
  finalVideoUrl?: string;
  heygenVideoUrl?: string;
  heygenVideoR2Url?: string;
  createdAt?: any;
}

async function findAndFixBrokenUrls(dryRun: boolean = false) {
  const db = initFirebase();

  console.log('🔍 Searching for workflows with broken Worker URL...');
  console.log(`   Broken URL pattern: ${BROKEN_WORKER_URL}`);
  console.log(`   Will replace with: ${CORRECT_R2_URL}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update documents)'}\n`);

  // Collections to check
  const collections = [
    'viralVideoWorkflows',
    'abdullahVideoWorkflows',
    'benefitVideoWorkflows',
    'carzVideoWorkflows',
    'gazaVideoWorkflows',
    'propertyVideoWorkflows',
  ];

  let totalFound = 0;
  let totalFixed = 0;
  const affectedWorkflows: { collection: string; id: string; field: string; oldUrl: string }[] = [];

  for (const collectionName of collections) {
    console.log(`\n📂 Checking ${collectionName}...`);

    try {
      const snapshot = await db.collection(collectionName).get();
      let collectionCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data() as WorkflowDoc;
        const updates: Record<string, string> = {};

        // Check all URL fields
        const urlFields = ['finalVideoUrl', 'heygenVideoUrl', 'heygenVideoR2Url'];

        for (const field of urlFields) {
          const value = data[field as keyof WorkflowDoc] as string | undefined;
          if (value && typeof value === 'string' && value.includes(BROKEN_WORKER_URL)) {
            const newUrl = value.replace(BROKEN_WORKER_URL, CORRECT_R2_URL);
            updates[field] = newUrl;

            affectedWorkflows.push({
              collection: collectionName,
              id: doc.id,
              field,
              oldUrl: value,
            });

            console.log(`   ❌ Found broken URL in ${doc.id}`);
            console.log(`      Field: ${field}`);
            console.log(`      Old: ${value.substring(0, 60)}...`);
            console.log(`      New: ${newUrl.substring(0, 60)}...`);

            collectionCount++;
          }
        }

        // Apply updates if not dry run
        if (Object.keys(updates).length > 0 && !dryRun) {
          await db.collection(collectionName).doc(doc.id).update(updates);
          totalFixed++;
          console.log(`      ✅ Fixed!`);
        }
      }

      if (collectionCount > 0) {
        console.log(`   Found ${collectionCount} broken URL(s) in ${collectionName}`);
        totalFound += collectionCount;
      } else {
        console.log(`   ✅ No broken URLs found`);
      }
    } catch (error) {
      console.error(`   ⚠️  Error checking ${collectionName}:`, error);
    }
  }

  // Also check Late post failures collection
  console.log(`\n📂 Checking latePostFailures...`);
  try {
    const failuresSnapshot = await db.collection('latePostFailures').get();
    let failuresCount = 0;

    for (const doc of failuresSnapshot.docs) {
      const data = doc.data();
      if (data.videoUrl && typeof data.videoUrl === 'string' && data.videoUrl.includes(BROKEN_WORKER_URL)) {
        const newUrl = data.videoUrl.replace(BROKEN_WORKER_URL, CORRECT_R2_URL);

        affectedWorkflows.push({
          collection: 'latePostFailures',
          id: doc.id,
          field: 'videoUrl',
          oldUrl: data.videoUrl,
        });

        console.log(`   ❌ Found broken URL in failure record ${doc.id}`);
        console.log(`      Brand: ${data.brand || 'unknown'}`);
        console.log(`      Old: ${data.videoUrl.substring(0, 60)}...`);

        if (!dryRun) {
          await db.collection('latePostFailures').doc(doc.id).update({ videoUrl: newUrl });
          totalFixed++;
          console.log(`      ✅ Fixed!`);
        }

        failuresCount++;
      }
    }

    if (failuresCount > 0) {
      console.log(`   Found ${failuresCount} broken URL(s) in latePostFailures`);
      totalFound += failuresCount;
    } else {
      console.log(`   ✅ No broken URLs found`);
    }
  } catch (error) {
    console.error(`   ⚠️  Error checking latePostFailures:`, error);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total broken URLs found: ${totalFound}`);

  if (dryRun) {
    console.log(`\n⚠️  DRY RUN - No changes were made.`);
    console.log(`Run without --dry-run flag to fix these URLs.`);
  } else {
    console.log(`Total URLs fixed: ${totalFixed}`);
  }

  if (affectedWorkflows.length > 0) {
    console.log('\n📋 Affected workflows:');
    affectedWorkflows.forEach(w => {
      console.log(`   - ${w.collection}/${w.id} (${w.field})`);
    });
  }

  return { totalFound, totalFixed, affectedWorkflows };
}

// Run the script
const isDryRun = process.argv.includes('--dry-run');
findAndFixBrokenUrls(isDryRun)
  .then(result => {
    console.log('\n✅ Script completed');
    process.exit(result.totalFound > 0 && isDryRun ? 1 : 0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
