import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

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

async function verifyUrls() {
  console.log('🔍 Verifying all properties have source URLs...\n');

  // Get ALL properties
  const snapshot = await db.collection('zillow_imports').get();

  console.log(`📊 Total properties in database: ${snapshot.size}\n`);

  if (snapshot.empty) {
    console.log('❌ No properties found in database');
    return;
  }

  // Check for URLs
  const propertiesWithUrl = snapshot.docs.filter(doc => {
    const data = doc.data();
    return data.url && data.url.trim().length > 0;
  });

  const propertiesWithoutUrl = snapshot.docs.filter(doc => {
    const data = doc.data();
    return !data.url || data.url.trim().length === 0;
  });

  const propertiesWithHdpUrl = snapshot.docs.filter(doc => {
    const data = doc.data();
    return data.hdpUrl && data.hdpUrl.trim().length > 0;
  });

  // Calculate percentages
  const urlPercentage = ((propertiesWithUrl.length / snapshot.size) * 100).toFixed(2);
  const hdpUrlPercentage = ((propertiesWithHdpUrl.length / snapshot.size) * 100).toFixed(2);

  console.log('=== URL VERIFICATION RESULTS ===\n');
  console.log(`✅ Properties WITH url field: ${propertiesWithUrl.length} (${urlPercentage}%)`);
  console.log(`✅ Properties WITH hdpUrl field: ${propertiesWithHdpUrl.length} (${hdpUrlPercentage}%)`);
  console.log(`❌ Properties WITHOUT url field: ${propertiesWithoutUrl.length}\n`);

  if (propertiesWithoutUrl.length > 0) {
    console.log('⚠️  PROPERTIES WITHOUT URLs:\n');
    propertiesWithoutUrl.slice(0, 20).forEach((doc, i) => {
      const data = doc.data();
      console.log(`${i + 1}. ${data.fullAddress || data.streetAddress || 'No address'}`);
      console.log(`   ZPID: ${doc.id}`);
      console.log(`   URL: ${data.url || 'MISSING'}`);
      console.log(`   hdpUrl: ${data.hdpUrl || 'MISSING'}`);
      console.log(`   Source: ${data.source || 'Unknown'}`);
      console.log();
    });

    if (propertiesWithoutUrl.length > 20) {
      console.log(`... and ${propertiesWithoutUrl.length - 20} more without URLs\n`);
    }
  } else {
    console.log('🎉 ALL PROPERTIES HAVE URLs!\n');
  }

  // Sample verification - show 10 random properties with URLs
  console.log('=== SAMPLE PROPERTIES WITH URLS (Random 10) ===\n');
  const randomSample = propertiesWithUrl
    .sort(() => Math.random() - 0.5)
    .slice(0, 10);

  randomSample.forEach((doc, i) => {
    const data = doc.data();
    console.log(`${i + 1}. ${data.fullAddress || 'No address'}`);
    console.log(`   URL: ${data.url}`);
    console.log(`   Status: ${data.homeStatus || 'Unknown'}`);
    console.log();
  });

  // Summary
  console.log('=== SUMMARY ===');
  if (propertiesWithUrl.length === snapshot.size) {
    console.log('✅ VERIFICATION PASSED: All properties have source URLs');
  } else {
    console.log(`⚠️  VERIFICATION FAILED: ${propertiesWithoutUrl.length} properties missing URLs`);
  }
  console.log();
}

verifyUrls().then(() => process.exit(0)).catch(console.error);
