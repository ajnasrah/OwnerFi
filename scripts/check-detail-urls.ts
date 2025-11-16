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
  console.log('🔍 Checking if search scraper has detailUrl field...\n');

  const searchScraperProps = await db
    .collection('zillow_imports')
    .where('source', '==', 'apify_search_scraper')
    .limit(5)
    .get();

  if (searchScraperProps.empty) {
    console.log('No properties found');
    return;
  }

  console.log(`📊 Checking ${searchScraperProps.size} properties:\n`);

  let hasDetailUrl = 0;
  let missingDetailUrl = 0;

  searchScraperProps.docs.forEach((doc, i) => {
    const data = doc.data();
    if (data.detailUrl) {
      hasDetailUrl++;
      console.log(`✅ ${i + 1}. ${data.address}`);
      console.log(`   detailUrl: ${data.detailUrl}\n`);
    } else {
      missingDetailUrl++;
      console.log(`❌ ${i + 1}. ${data.address}`);
      console.log(`   NO detailUrl\n`);
    }
  });

  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📊 RESULTS:\n');
  console.log(`✅ Has detailUrl: ${hasDetailUrl}`);
  console.log(`❌ Missing detailUrl: ${missingDetailUrl}\n`);

  console.log('💡 SOLUTION:\n');
  console.log('   1. Search scraper gets URLs from Zillow search');
  console.log('   2. Extract detailUrl from each result');
  console.log('   3. Add detailUrls to scraper_queue');
  console.log('   4. Detail scraper processes queue and gets descriptions');
  console.log('   5. Apply strict filter to descriptions');
  console.log('\n   This ensures ALL properties have descriptions before filtering.\n');
}

main().catch(console.error);
