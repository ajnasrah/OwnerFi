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

async function checkHistory() {
  // Check scraper_queue - how many URLs were ever processed?
  const queueSnap = await db.collection('scraper_queue').get();
  console.log('=== SCRAPER QUEUE HISTORY ===');
  console.log('Total queue items:', queueSnap.size);
  
  // Count by source
  const bySource: Record<string, number> = {};
  queueSnap.docs.forEach(doc => {
    const source = doc.data().source || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;
  });
  console.log('By source:', bySource);
  
  // Check zillow_imports - when were they added?
  console.log('\n=== ZILLOW IMPORTS BY DATE ===');
  const importsSnap = await db.collection('zillow_imports')
    .orderBy('foundAt', 'desc')
    .limit(1000)
    .get();
  
  const byDate: Record<string, number> = {};
  importsSnap.docs.forEach(doc => {
    const foundAt = doc.data().foundAt?.toDate?.();
    if (foundAt) {
      const date = foundAt.toISOString().split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
    }
  });
  
  // Sort by date and show
  Object.entries(byDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10)
    .forEach(([date, count]) => {
      console.log(`  ${date}: ${count} properties`);
    });
  
  // Check how many have ownerFinanceVerified
  const verifiedSnap = await db.collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .count().get();
  console.log('\nWith ownerFinanceVerified=true:', verifiedSnap.data().count);
  
  // Check matchedKeywords distribution
  console.log('\n=== MATCHED KEYWORDS SAMPLE ===');
  const sampleSnap = await db.collection('zillow_imports')
    .where('matchedKeywords', '!=', null)
    .limit(20)
    .get();
  
  const keywordCounts: Record<string, number> = {};
  sampleSnap.docs.forEach(doc => {
    const keywords = doc.data().matchedKeywords || [];
    keywords.forEach((kw: string) => {
      keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
    });
  });
  console.log('Sample keyword distribution:', keywordCounts);
}

checkHistory();
