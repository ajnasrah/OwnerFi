#!/usr/bin/env node
/**
 * Check Platform Analytics in Firestore
 * Quick diagnostic to see what's stored in platform_analytics collection
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.error('❌ Missing Firebase credentials in environment');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    }),
  });
}

const db = admin.firestore();

async function main() {
  console.log('🔍 Checking platform_analytics collection...\n');

  // Get all documents
  const snapshot = await db.collection('platform_analytics').limit(10).get();

  console.log(`Found ${snapshot.size} documents (showing first 10)\n`);

  if (snapshot.empty) {
    console.log('❌ No documents found in platform_analytics collection');
    console.log('Run: npx tsx scripts/sync-platform-analytics.ts');
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log('━'.repeat(80));
    console.log(`Doc ID: ${doc.id}`);
    console.log(`Brand: ${data.brand}`);
    console.log(`Platform: ${data.platform}`);
    console.log(`Published: ${data.publishedAt}`);
    console.log(`Views: ${data.views || 0}`);
    console.log(`Likes: ${data.likes || 0}`);
    console.log(`Engagement Rate: ${data.engagementRate || 0}%`);
    console.log(`Hour: ${data.hour}`);
    console.log(`Day: ${data.dayName}`);
  });

  console.log('━'.repeat(80));

  // Get counts by brand
  console.log('\n📊 Counts by brand:\n');
  const brands = ['ownerfi', 'carz', 'podcast', 'vassdistro', 'abdullah'];

  for (const brand of brands) {
    const brandSnapshot = await db.collection('platform_analytics')
      .where('brand', '==', brand)
      .count()
      .get();
    console.log(`${brand.padEnd(15)}: ${brandSnapshot.data().count} documents`);
  }

  console.log('\n✅ Done');
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
