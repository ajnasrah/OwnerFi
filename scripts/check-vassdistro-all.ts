import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit as firestoreLimit, query } from 'firebase/firestore';

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
  console.log('Checking ALL VassDistro articles...\n');

  const q = query(
    collection(db, 'vassdistro_articles'),
    firestoreLimit(50)
  );

  const snapshot = await getDocs(q);
  console.log(`Total articles: ${snapshot.size}\n`);

  const processed = [];
  const unprocessed = [];

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const article = {
      id: doc.id,
      title: data.title,
      qualityScore: data.qualityScore,
      processed: data.processed,
      pubDate: data.pubDate,
      daysOld: Math.floor((Date.now() - data.pubDate) / (24 * 60 * 60 * 1000))
    };

    if (data.processed) {
      processed.push(article);
    } else {
      unprocessed.push(article);
    }
  });

  console.log(`Processed: ${processed.length}`);
  console.log(`Unprocessed: ${unprocessed.length}\n`);

  console.log('All articles (sorted by score):');
  [...processed, ...unprocessed]
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
    .slice(0, 20)
    .forEach(a => {
      const status = a.processed ? '✓ PROCESSED' : '○ AVAILABLE';
      console.log(`  ${status} | Score: ${a.qualityScore || 'N/A'}, Age: ${a.daysOld} days | "${a.title.substring(0, 50)}"`);
    });
}

checkArticles().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
