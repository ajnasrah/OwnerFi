/**
 * Find ALL video URLs in Firestore to locate the broken Worker URL
 *
 * Usage: npx ts-node scripts/find-all-video-urls.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BROKEN_PATTERN = 'workers.dev';

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

function findUrlsInObject(obj: any, path: string = ''): { path: string; url: string }[] {
  const urls: { path: string; url: string }[] = [];

  if (!obj || typeof obj !== 'object') return urls;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof value === 'string' && (value.includes('http') || value.includes('.dev') || value.includes('.com'))) {
      if (value.includes('video') || value.includes('mp4') || value.includes('r2') || value.includes('workers')) {
        urls.push({ path: currentPath, url: value });
      }
    } else if (typeof value === 'object' && value !== null) {
      urls.push(...findUrlsInObject(value, currentPath));
    }
  }

  return urls;
}

async function findAllVideoUrls() {
  const db = initFirebase();

  console.log('🔍 Searching ALL collections for video URLs...\n');

  // Get all collections
  const collections = await db.listCollections();

  let totalUrls = 0;
  let brokenUrls = 0;
  const brokenRecords: { collection: string; docId: string; path: string; url: string }[] = [];

  for (const collectionRef of collections) {
    const collectionName = collectionRef.id;

    // Skip system collections
    if (collectionName.startsWith('_')) continue;

    try {
      const snapshot = await collectionRef.limit(500).get(); // Limit to avoid timeout

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const urls = findUrlsInObject(data);

        for (const { path, url } of urls) {
          totalUrls++;

          if (url.includes(BROKEN_PATTERN)) {
            brokenUrls++;
            brokenRecords.push({
              collection: collectionName,
              docId: doc.id,
              path,
              url
            });

            console.log(`❌ BROKEN URL FOUND!`);
            console.log(`   Collection: ${collectionName}`);
            console.log(`   Document: ${doc.id}`);
            console.log(`   Field: ${path}`);
            console.log(`   URL: ${url}\n`);
          }
        }
      }
    } catch (error) {
      // Skip collections with permission issues
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total video-related URLs scanned: ${totalUrls}`);
  console.log(`Broken URLs found (workers.dev): ${brokenUrls}`);

  if (brokenRecords.length > 0) {
    console.log('\n📋 Broken URL locations:');
    brokenRecords.forEach(r => {
      console.log(`   - ${r.collection}/${r.docId} → ${r.path}`);
    });
  } else {
    console.log('\n✅ No broken workers.dev URLs found in Firestore!');
    console.log('\nThe broken URL must be stored in Late.dev itself, not in your database.');
    console.log('You\'ll need to manually delete/recreate those failed posts in Late.');
  }

  return brokenRecords;
}

findAllVideoUrls()
  .then(() => {
    console.log('\n✅ Search completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Search failed:', error);
    process.exit(1);
  });
