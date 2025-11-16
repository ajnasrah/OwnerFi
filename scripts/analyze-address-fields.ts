import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function analyzeAddressFields() {
  console.log('\n🔍 Analyzing Address Fields in Database\n');
  console.log('='.repeat(80));

  // Get sample properties
  const snapshot = await db.collection('zillow_imports')
    .limit(10)
    .get();

  console.log(`\n📊 Sampled ${snapshot.size} properties\n`);

  snapshot.forEach((doc, index) => {
    const data = doc.data();
    console.log(`\n━━━ Property ${index + 1} ━━━`);
    console.log(`fullAddress:    "${data.fullAddress || 'N/A'}"`);
    console.log(`streetAddress:  "${data.streetAddress || 'N/A'}"`);
    console.log(`address:        "${data.address || 'N/A'}"`);
    console.log(`city:           "${data.city || 'N/A'}"`);
    console.log(`state:          "${data.state || 'N/A'}"`);
    console.log(`zipCode:        "${data.zipCode || 'N/A'}"`);
    console.log(`source:         "${data.source || 'N/A'}"`);

    // Check for duplication
    const hasFullInStreet = data.streetAddress && data.city &&
      data.streetAddress.toLowerCase().includes(data.city.toLowerCase());

    if (hasFullInStreet) {
      console.log('⚠️  ISSUE: streetAddress contains city (duplication detected!)');
    }
  });

  console.log('\n' + '='.repeat(80));
}

analyzeAddressFields()
  .then(() => {
    console.log('\n✅ Analysis complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
