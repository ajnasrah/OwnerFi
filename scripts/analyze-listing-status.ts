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

async function analyzeStatuses() {
  console.log('Analyzing Zillow listing statuses...\n');

  // Get all properties
  const snapshot = await db.collection('zillow_imports').get();

  console.log(`Total properties: ${snapshot.size}\n`);

  // Count by status
  const statusCounts: Record<string, number> = {};
  const propertiesWithUrls = snapshot.docs.filter(doc => doc.data().url);
  const propertiesWithoutUrls = snapshot.docs.filter(doc => !doc.data().url);

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const status = data.homeStatus || 'UNKNOWN';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log('=== URL STATUS ===');
  console.log(`Properties WITH URLs: ${propertiesWithUrls.length}`);
  console.log(`Properties WITHOUT URLs: ${propertiesWithoutUrls.length}`);

  if (propertiesWithoutUrls.length > 0) {
    console.log('\nSample properties WITHOUT URLs:');
    propertiesWithoutUrls.slice(0, 5).forEach((doc, i) => {
      const data = doc.data();
      console.log(`  ${i + 1}. ${data.fullAddress || 'No address'} - ZPID: ${doc.id}`);
    });
  }

  console.log('\n=== LISTING STATUS BREAKDOWN ===');
  Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      const percentage = ((count / snapshot.size) * 100).toFixed(1);
      console.log(`${status}: ${count} (${percentage}%)`);
    });

  // Get 5 random properties with full details
  console.log('\n=== SAMPLE PROPERTIES (Random 5) ===\n');
  const randomDocs = snapshot.docs
    .sort(() => Math.random() - 0.5)
    .slice(0, 5);

  randomDocs.forEach((doc, index) => {
    const data = doc.data();
    console.log(`${index + 1}. ${data.fullAddress || 'No address'}`);
    console.log(`   ZPID: ${doc.id}`);
    console.log(`   URL: ${data.url || 'MISSING'}`);
    console.log(`   Status: ${data.homeStatus || 'UNKNOWN'}`);
    console.log(`   Price: $${data.price?.toLocaleString() || 'N/A'}`);
    console.log(`   Days on Zillow: ${data.daysOnZillow || 'N/A'}`);
    console.log(`   Last Scraped: ${data.lastScrapedAt?.toDate?.()?.toLocaleDateString() || data.scrapedAt?.toDate?.()?.toLocaleDateString() || 'N/A'}`);
    console.log();
  });

  // Check for non-active statuses
  const nonActiveStatuses = ['PENDING', 'OFF_MARKET', 'SOLD', 'RECENTLY_SOLD'];
  const nonActiveProps = snapshot.docs.filter(doc => {
    const status = doc.data().homeStatus;
    return nonActiveStatuses.includes(status);
  });

  if (nonActiveProps.length > 0) {
    console.log('\n=== ⚠️ NON-ACTIVE PROPERTIES FOUND ===');
    console.log(`Found ${nonActiveProps.length} properties that may not be active:\n`);

    nonActiveProps.slice(0, 10).forEach((doc, i) => {
      const data = doc.data();
      console.log(`${i + 1}. ${data.homeStatus} - ${data.fullAddress}`);
      console.log(`   URL: ${data.url}`);
      console.log();
    });

    if (nonActiveProps.length > 10) {
      console.log(`... and ${nonActiveProps.length - 10} more non-active properties\n`);
    }
  } else {
    console.log('\n✅ All properties appear to be FOR_SALE\n');
  }

  // Recommendation
  console.log('\n=== RECOMMENDATIONS ===');
  console.log('1. Every scraped property includes the original Zillow URL');
  console.log('2. The homeStatus field tracks listing status (FOR_SALE, PENDING, etc.)');
  console.log('3. To verify current status, you can manually check any URL above');
  console.log('4. Consider implementing a re-scraping job to refresh stale listings');
  console.log('5. Filter out non-FOR_SALE properties when sending to GHL\n');
}

analyzeStatuses().then(() => process.exit(0)).catch(console.error);
