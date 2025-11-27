import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

async function checkFilterAccuracy() {
  console.log('=== FILTER ACCURACY CHECK ===\n');

  // Get recent imports (PASSED filter)
  const recentImports = await db.collection('zillow_imports')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  console.log('📗 PASSED FILTER (saved to zillow_imports):\n');

  for (const doc of recentImports.docs) {
    const d = doc.data();
    console.log(`✅ ${d.address || 'No address'}`);
    console.log(`   Price: $${d.price?.toLocaleString() || '?'}`);

    // Check what keywords matched
    const desc = d.description || '';
    const result = hasStrictOwnerFinancing(desc);
    console.log(`   Keywords matched: ${result.matchedKeywords?.join(', ') || 'none'}`);

    // Show snippet of description with keywords
    const snippet = desc.substring(0, 200).replace(/\n/g, ' ');
    console.log(`   Description: "${snippet}..."`);
    console.log('');
  }

  // Get completed queue items that weren't saved (FAILED validation)
  console.log('\n\n📕 FAILED VALIDATION (completed but not saved):\n');

  // Check scraper_queue for completed items and cross-reference with zillow_imports
  const completedQueue = await db.collection('scraper_queue')
    .where('status', '==', 'completed')
    .orderBy('addedAt', 'desc')
    .limit(50)
    .get();

  // Get their URLs
  const completedUrls = completedQueue.docs.map(d => d.data().url);

  // Check which ones are NOT in zillow_imports
  const importedUrls = new Set<string>();
  for (let i = 0; i < completedUrls.length; i += 10) {
    const batch = completedUrls.slice(i, i + 10).filter(Boolean);
    if (batch.length === 0) continue;

    const snapshot = await db.collection('zillow_imports')
      .where('url', 'in', batch)
      .get();

    snapshot.docs.forEach(doc => {
      importedUrls.add(doc.data().url);
    });
  }

  // Show ones that failed
  let failedCount = 0;
  for (const doc of completedQueue.docs) {
    const d = doc.data();
    if (!importedUrls.has(d.url)) {
      failedCount++;
      if (failedCount <= 5) {
        console.log(`❌ ${d.address || d.url?.substring(0, 50) || 'Unknown'}`);
        console.log(`   Price: ${d.price || '?'}`);
        console.log(`   (Failed validation - likely missing owner finance keywords in description)`);
        console.log('');
      }
    }
  }

  console.log(`\nTotal checked: ${completedQueue.size}`);
  console.log(`Failed validation: ${failedCount}`);
  console.log(`Passed validation: ${completedQueue.size - failedCount}`);
  console.log(`Pass rate: ${(((completedQueue.size - failedCount) / completedQueue.size) * 100).toFixed(1)}%`);
}

checkFilterAccuracy();
