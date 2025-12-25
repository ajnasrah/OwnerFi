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

async function checkRecentProperties() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  console.log('=== PROPERTIES ADDED IN LAST 24 HOURS ===\n');
  console.log('Checking from:', oneDayAgo.toISOString());
  console.log('Current time:', new Date().toISOString());

  const recentProperties = await db.collection('properties')
    .where('createdAt', '>=', oneDayAgo)
    .orderBy('createdAt', 'desc')
    .get();

  console.log('\nTotal added:', recentProperties.size);

  // Group by hour
  const byHour: Record<string, number> = {};
  const byDealType: Record<string, number> = { owner_finance: 0, cash_deal: 0, both: 0 };

  recentProperties.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.() || new Date();
    const hourKey = createdAt.toISOString().slice(0, 13) + ':00';

    byHour[hourKey] = (byHour[hourKey] || 0) + 1;

    if (data.isOwnerFinance && data.isCashDeal) {
      byDealType.both++;
    } else if (data.isOwnerFinance) {
      byDealType.owner_finance++;
    } else if (data.isCashDeal) {
      byDealType.cash_deal++;
    }
  });

  console.log('\n=== BY HOUR ===');
  Object.entries(byHour).sort().forEach(([hour, count]) => {
    console.log(`${hour}: ${count} properties`);
  });

  console.log('\n=== BY DEAL TYPE ===');
  console.log('Owner Finance:', byDealType.owner_finance);
  console.log('Cash Deal:', byDealType.cash_deal);
  console.log('Both:', byDealType.both);

  // Show sample of recent additions
  console.log('\n=== SAMPLE RECENT ADDITIONS (last 10) ===');
  let count = 0;
  recentProperties.forEach(doc => {
    if (count >= 10) return;
    const data = doc.data();
    console.log(`- ${data.fullAddress || data.streetAddress || 'Unknown'}`);
    console.log(`  Price: $${data.price?.toLocaleString() || 'N/A'} | Type: ${data.isOwnerFinance ? 'OF' : ''}${data.isCashDeal ? 'CD' : ''}`);
    console.log(`  Created: ${data.createdAt?.toDate?.()?.toISOString() || 'N/A'}`);
    count++;
  });

  // Also check scrapedAt
  console.log('\n=== PROPERTIES WITH scrapedAt IN LAST 24H ===');
  const scrapedRecently = await db.collection('properties')
    .where('scrapedAt', '>=', oneDayAgo)
    .get();
  console.log('Count:', scrapedRecently.size);
}

checkRecentProperties().catch(console.error);
