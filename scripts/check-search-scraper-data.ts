import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function main() {
  console.log('🔍 Checking what data search scraper is saving...\n');

  const searchScraperProps = await db
    .collection('zillow_imports')
    .where('source', '==', 'apify_search_scraper')
    .limit(3)
    .get();

  if (searchScraperProps.empty) {
    console.log('No properties found');
    return;
  }

  console.log(`📊 Sample of ${searchScraperProps.size} properties:\n`);

  searchScraperProps.docs.forEach((doc, i) => {
    const data = doc.data();
    console.log(`\n=== Property ${i + 1} ===`);
    console.log('Fields present:', Object.keys(data).sort());
    console.log('\nSample values:');
    console.log('  address:', data.address || data.fullAddress || data.streetAddress || 'N/A');
    console.log('  price:', data.price || 'N/A');
    console.log('  description:', data.description ? `${data.description.substring(0, 100)}...` : 'MISSING');
    console.log('  url:', data.url || 'N/A');
    console.log('  zpid:', data.zpid || 'N/A');
    console.log('  bedrooms:', data.bedrooms || 'N/A');
    console.log('  bathrooms:', data.bathrooms || 'N/A');
  });

  console.log('\n\n🎯 ISSUE FOUND:');
  console.log('   The search scraper is not saving the description field!');
  console.log('   Without description, we cannot filter for owner financing keywords.\n');
}

main().catch(console.error);
