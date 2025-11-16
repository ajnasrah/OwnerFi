import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
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
  console.log('🔍 Inspecting scraped property data...\n');

  // Get first property from apify_search_scraper source
  const snapshot = await db
    .collection('zillow_imports')
    .where('source', '==', 'apify_search_scraper')
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('No properties found.');
    return;
  }

  const property = snapshot.docs[0].data();

  console.log('📋 Sample Property Data:');
  console.log('─────────────────────────────────────────');
  console.log(JSON.stringify(property, null, 2));
  console.log('─────────────────────────────────────────\n');

  console.log('🔑 Available Fields:');
  const fields = Object.keys(property).sort();
  fields.forEach((field) => {
    const value = property[field];
    const type = typeof value;
    const preview = type === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value;
    console.log(`  ${field}: ${type} = ${preview}`);
  });
}

main().catch(console.error);
