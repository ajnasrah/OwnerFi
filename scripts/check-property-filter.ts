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

const URL_TO_CHECK = process.argv[2] || 'https://www.zillow.com/homedetails/5316-S-Kenneth-Ave-101-Chicago-IL-60632/89923685_zpid/';

async function checkProperty() {
  console.log('=== CHECKING PROPERTY ===\n');
  console.log('URL:', URL_TO_CHECK);

  // Check zillow_imports
  const importSnap = await db.collection('zillow_imports')
    .where('url', '==', URL_TO_CHECK)
    .get();

  if (importSnap.empty) {
    console.log('\n❌ Property NOT FOUND in zillow_imports');

    // Check scraper_queue
    const queueSnap = await db.collection('scraper_queue')
      .where('url', '==', URL_TO_CHECK)
      .get();

    if (!queueSnap.empty) {
      const data = queueSnap.docs[0].data();
      console.log('\nFound in scraper_queue:');
      console.log('Status:', data.status);
      console.log('Address:', data.address);
    }
    return;
  }

  const data = importSnap.docs[0].data();
  console.log('\n✅ Property FOUND in zillow_imports\n');
  console.log('Address:', data.address);
  console.log('Price:', data.price);
  console.log('Created:', data.createdAt?.toDate?.() || data.createdAt);

  console.log('\n=== DESCRIPTION ===\n');
  const desc = data.description || '';
  console.log(desc.substring(0, 1000));
  if (desc.length > 1000) console.log('... (truncated)');

  console.log('\n=== FILTER CHECK ===\n');
  const result = hasStrictOwnerFinancing(desc);
  console.log('Filter passes:', result.passes);
  console.log('Keywords matched:', result.matchedKeywords?.join(', ') || 'none');

  // Search for any owner/seller/financing words
  const lowerDesc = desc.toLowerCase();
  const searchTerms = ['owner', 'seller', 'financing', 'finance', 'carry', 'terms', 'creative', 'flexible', 'rent to own', 'lease option', 'contract'];
  const found = searchTerms.filter(term => lowerDesc.includes(term));
  console.log('\nRelated words found:', found.join(', ') || 'none');

  // Show context around any found keywords
  if (result.matchedKeywords && result.matchedKeywords.length > 0) {
    console.log('\n=== KEYWORD CONTEXT ===\n');
    for (const kw of result.matchedKeywords) {
      const idx = lowerDesc.indexOf(kw.toLowerCase());
      if (idx !== -1) {
        const start = Math.max(0, idx - 50);
        const end = Math.min(desc.length, idx + kw.length + 100);
        console.log(`"...${desc.substring(start, end)}..."\n`);
      }
    }
  }
}

checkProperty();
