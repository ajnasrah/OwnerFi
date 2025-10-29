import { db } from './src/lib/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';

async function checkArticles() {
  const articlesRef = collection(db, 'ownerfi_articles');
  const q = query(articlesRef, where('processed', '==', false), limit(5));

  const snapshot = await getDocs(q);

  console.log(`Found ${snapshot.size} unprocessed articles\n`);

  snapshot.docs.forEach((doc, index) => {
    const data = doc.data();
    console.log(`${index + 1}. Article: ${data.title}`);
    console.log(`   Content length: ${data.content ? data.content.length : 0} chars`);
    console.log(`   Quality Score: ${data.qualityScore || 'not rated'}`);
    console.log(`   Content preview: ${data.content ? data.content.substring(0, 100) : 'NO CONTENT'}...\n`);
  });

  process.exit(0);
}

checkArticles().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
