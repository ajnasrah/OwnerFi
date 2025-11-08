import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkArticleQueue() {
  console.log('📊 Checking article queues for all brands...\n');

  const brands = [
    { name: 'carz', collection: 'carz_articles' },
    { name: 'ownerfi', collection: 'ownerfi_articles' },
    { name: 'vassdistro', collection: 'vassdistro_articles' }
  ];

  for (const brand of brands) {
    console.log(`\n━━━ ${brand.name.toUpperCase()} ━━━`);

    // Total articles
    const allQuery = query(collection(db, brand.collection));
    const allSnapshot = await getDocs(allQuery);
    console.log(`Total articles: ${allSnapshot.size}`);

    // Available (not processed)
    const availableQuery = query(
      collection(db, brand.collection),
      where('processed', '==', false)
    );
    const availableSnapshot = await getDocs(availableQuery);
    console.log(`Available (unprocessed): ${availableSnapshot.size}`);

    // Show top 5 available
    if (availableSnapshot.size > 0) {
      console.log('\n📰 Next 5 articles in queue:');
      let count = 0;
      availableSnapshot.forEach(doc => {
        if (count < 5) {
          const data = doc.data();
          const contentLength = data.content?.length || 0;
          console.log(`  ${count + 1}. ${data.title.substring(0, 60)}...`);
          console.log(`     Content: ${contentLength} chars | Feed: ${data.feedId}`);
          count++;
        }
      });
    }

    // Check for empty content articles
    const emptyQuery = query(
      collection(db, brand.collection),
      where('processed', '==', false)
    );
    const emptySnapshot = await getDocs(emptyQuery);
    let emptyCount = 0;
    emptySnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.content || data.content.trim().length < 200) {
        emptyCount++;
      }
    });
    if (emptyCount > 0) {
      console.log(`⚠️  Articles with content < 200 chars: ${emptyCount}`);
    }
  }
}

checkArticleQueue().catch(console.error);
