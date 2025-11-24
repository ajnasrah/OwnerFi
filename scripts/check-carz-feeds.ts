import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

if (getApps().length === 0) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function checkCarzFeeds() {
  console.log('=== Carz Inc RSS Feeds ===\n');

  // Check RSS feeds
  const feedsRef = db.collection('carz_rss_feeds');
  const feeds = await feedsRef.get();

  console.log(`Total feeds configured: ${feeds.size}\n`);

  if (feeds.empty) {
    console.log('❌ No RSS feeds configured for Carz!\n');
    return;
  }

  console.log('Feed URLs:');
  feeds.docs.forEach((doc, i) => {
    const data = doc.data();
    console.log(`${i+1}. ${data.url || doc.id}`);
    if (data.enabled === false) console.log('   ⚠️  DISABLED');
  });

  // Check articles
  console.log('\n=== Carz Articles ===\n');
  const articlesRef = db.collection('carz_articles');

  // Total articles
  const total = await articlesRef.count().get();
  console.log(`Total articles: ${total.data().count}\n`);

  // Unprocessed articles
  const unprocessed = await articlesRef
    .where('processed', '==', false)
    .limit(10)
    .get();

  console.log(`Unprocessed articles: ${unprocessed.size}\n`);

  if (unprocessed.size > 0) {
    console.log('Top 5 unprocessed articles:');
    unprocessed.docs.slice(0, 5).forEach((doc, i) => {
      const data = doc.data();
      console.log(`${i+1}. ${(data.title || 'No title').substring(0, 70)}`);
      console.log(`   Added: ${data.createdAt?.toDate?.() || 'N/A'}`);
      console.log(`   Rating: ${data.qualityRating || 'Not rated'}`);
    });
  }

  // Recent processed articles
  const processed = await articlesRef
    .where('processed', '==', true)
    .orderBy('processedAt', 'desc')
    .limit(5)
    .get();

  console.log(`\n=== Recently Processed (${processed.size}) ===\n`);
  processed.docs.forEach((doc, i) => {
    const data = doc.data();
    console.log(`${i+1}. ${(data.title || 'No title').substring(0, 70)}`);
    console.log(`   Processed: ${data.processedAt?.toDate?.() || 'N/A'}`);
  });

  // Check for high-quality rated articles
  const highQuality = await articlesRef
    .where('processed', '==', false)
    .where('qualityRating', '>=', 7)
    .limit(5)
    .get();

  console.log(`\n=== High Quality Unprocessed (rating >= 7): ${highQuality.size} ===\n`);
  if (highQuality.size > 0) {
    highQuality.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`${i+1}. Rating ${data.qualityRating}: ${(data.title || 'No title').substring(0, 60)}`);
    });
  }
}

checkCarzFeeds().catch(console.error);
