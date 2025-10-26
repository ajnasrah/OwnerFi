import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, limit as firestoreLimit } from 'firebase/firestore';

async function checkArticles() {
  console.log('Checking VassDistro articles...\n');

  const q = query(
    collection(db, 'vassdistro_articles'),
    firestoreLimit(20)
  );

  const snapshot = await getDocs(q);
  console.log(`Total articles fetched: ${snapshot.size}\n`);

  const processed = [];
  const unprocessed = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const article = {
      id: doc.id,
      title: data.title,
      processed: data.processed,
      qualityScore: data.qualityScore,
      pubDate: data.pubDate
    };

    if (data.processed) {
      processed.push(article);
    } else {
      unprocessed.push(article);
    }
  });

  console.log(`Processed: ${processed.length}`);
  console.log(`Unprocessed: ${unprocessed.length}\n`);

  if (unprocessed.length > 0) {
    console.log('Unprocessed articles:');
    unprocessed.forEach(a => {
      console.log(`  - Score ${a.qualityScore || 'N/A'}: ${a.title.substring(0, 60)}`);
    });
  }

  if (processed.length > 0) {
    console.log('\nProcessed articles:');
    processed.slice(0, 5).forEach(a => {
      console.log(`  - Score ${a.qualityScore || 'N/A'}: ${a.title.substring(0, 60)}`);
    });
  }
}

checkArticles().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
