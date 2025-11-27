import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
const APIFY_TOKEN = process.env.APIFY_API_KEY;

async function trace() {
  // Get sample URLs from one of the big datasets
  const datasetRes = await fetch(
    `https://api.apify.com/v2/datasets/9i1qNYmg5zsel8m0W/items?token=${APIFY_TOKEN}&limit=100`
  );
  const items = await datasetRes.json();

  console.log('Sample of 100 URLs from the 13k dataset:');

  let inQueue = 0;
  let inImports = 0;
  let notFound = 0;

  for (const item of items) {
    const url = item.detailUrl;
    if (!url) continue;

    // Check if in scraper_queue
    const queueSnap = await db.collection('scraper_queue')
      .where('url', '==', url)
      .limit(1)
      .get();

    if (!queueSnap.empty) {
      inQueue++;
      continue;
    }

    // Check if in zillow_imports
    const importsSnap = await db.collection('zillow_imports')
      .where('url', '==', url)
      .limit(1)
      .get();

    if (!importsSnap.empty) {
      inImports++;
      continue;
    }

    notFound++;
    if (notFound <= 3) {
      console.log('  NOT FOUND:', url);
    }
  }

  console.log('\nResults from 100 sample URLs:');
  console.log('  In scraper_queue:', inQueue);
  console.log('  In zillow_imports:', inImports);
  console.log('  NOT in either (lost):', notFound);
}

trace();
