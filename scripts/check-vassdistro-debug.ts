import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit as firestoreLimit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkArticles() {
  console.log('Checking VassDistro articles...\n');

  const q = query(
    collection(db, 'vassdistro_articles'),
    where('processed', '==', false),
    firestoreLimit(50)
  );

  const snapshot = await getDocs(q);
  console.log(`Total unprocessed articles: ${snapshot.size}\n`);

  const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
  const articles = snapshot.docs.map(doc => ({
    id: doc.id,
    title: doc.data().title,
    qualityScore: doc.data().qualityScore,
    pubDate: doc.data().pubDate,
    processed: doc.data().processed,
    daysOld: Math.floor((Date.now() - doc.data().pubDate) / (24 * 60 * 60 * 1000))
  }));

  const highQuality = articles.filter(a => (a.qualityScore || 0) >= 70);
  const recent = articles.filter(a => a.pubDate >= threeDaysAgo);
  const eligible = articles.filter(a => (a.qualityScore || 0) >= 70 && a.pubDate >= threeDaysAgo);

  console.log(`Articles with score >= 70: ${highQuality.length}`);
  console.log(`Articles published within 3 days: ${recent.length}`);
  console.log(`Eligible articles (both conditions): ${eligible.length}\n`);

  console.log('Top 10 articles by score:');
  articles
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
    .slice(0, 10)
    .forEach(a => {
      console.log(`  Score: ${a.qualityScore || 'N/A'}, Age: ${a.daysOld} days, "${a.title.substring(0, 60)}"`);
    });

  if (eligible.length > 0) {
    console.log('\nEligible articles:');
    eligible.forEach(a => {
      console.log(`  Score: ${a.qualityScore}, Age: ${a.daysOld} days, "${a.title.substring(0, 60)}"`);
    });
  } else {
    console.log('\n❌ NO ELIGIBLE ARTICLES FOUND');
    console.log('Articles are either too old (>3 days) or have score < 70');
  }
}

checkArticles().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
