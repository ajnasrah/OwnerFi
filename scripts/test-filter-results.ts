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

async function testFilterResults() {
  console.log('=== TESTING FILTER ACCURACY ===\n');

  // Get 5 most recent PASSED (saved to zillow_imports)
  const recentImports = await db.collection('zillow_imports')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  console.log('✅ PASSED PROPERTIES (should have owner finance keywords):\n');
  console.log('=' .repeat(80));

  for (const doc of recentImports.docs) {
    const d = doc.data();
    const desc = d.description || '';

    console.log(`\nAddress: ${d.address || 'No address'}`);
    console.log(`Price: $${d.price?.toLocaleString() || '?'}`);

    // Re-run filter
    const result = hasStrictOwnerFinancing(desc);
    console.log(`Filter Result: ${result.passes ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Keywords Found: ${result.matchedKeywords.join(', ') || 'none'}`);

    // Show relevant part of description
    const lowerDesc = desc.toLowerCase();
    const keywords = ['owner financ', 'seller financ', 'owner carry', 'seller carry', 'rent to own', 'lease option'];
    for (const kw of keywords) {
      const idx = lowerDesc.indexOf(kw);
      if (idx !== -1) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(desc.length, idx + kw.length + 50);
        console.log(`Snippet: "...${desc.substring(start, end)}..."`);
        break;
      }
    }
    console.log('-'.repeat(80));
  }

  // Now check REJECTED - look at completed queue items not in imports
  console.log('\n\n❌ REJECTED PROPERTIES (should NOT have owner finance keywords):\n');
  console.log('='.repeat(80));

  // Get completed queue items and check which aren't in zillow_imports
  const completedQueue = await db.collection('scraper_queue')
    .where('status', '==', 'completed')
    .orderBy('addedAt', 'desc')
    .limit(100)
    .get();

  // Build set of imported URLs
  const completedUrls = completedQueue.docs.map(d => d.data().url).filter(Boolean);
  const importedUrls = new Set<string>();

  for (let i = 0; i < completedUrls.length; i += 10) {
    const batch = completedUrls.slice(i, i + 10);
    if (batch.length === 0) continue;
    const snapshot = await db.collection('zillow_imports')
      .where('url', 'in', batch)
      .get();
    snapshot.docs.forEach(doc => importedUrls.add(doc.data().url));
  }

  // Find rejected ones
  let shownRejected = 0;
  for (const doc of completedQueue.docs) {
    const d = doc.data();
    if (!importedUrls.has(d.url) && shownRejected < 5) {
      shownRejected++;

      console.log(`\nAddress: ${d.address || d.url?.substring(0, 50) || 'Unknown'}`);
      console.log(`Price: ${d.price || '?'}`);
      console.log(`Rejection Reason: No owner financing keywords found in description`);
      console.log(`(Description not stored in queue - only URL)`);
      console.log('-'.repeat(80));
    }
  }

  // Summary
  console.log('\n\n=== SUMMARY ===');
  const totalCompleted = completedQueue.size;
  const totalImported = importedUrls.size;
  const totalRejected = totalCompleted - totalImported;

  console.log(`Total completed: ${totalCompleted}`);
  console.log(`Passed filter: ${totalImported} (${((totalImported/totalCompleted)*100).toFixed(1)}%)`);
  console.log(`Rejected: ${totalRejected} (${((totalRejected/totalCompleted)*100).toFixed(1)}%)`);

  console.log('\n=== FILTER VALIDATION ===');
  console.log('The STRICT filter requires one of these exact phrases:');
  console.log('- "owner financing" / "owner finance"');
  console.log('- "seller financing" / "seller finance"');
  console.log('- "owner carry" / "seller carry"');
  console.log('- "rent to own"');
  console.log('- "lease option" / "lease purchase"');
  console.log('- "contract for deed" / "land contract"');
  console.log('- "assumable loan"');
  console.log('- "no bank needed"');
}

testFilterResults();
