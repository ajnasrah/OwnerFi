import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { OWNERFI_FEEDS } from '../src/config/feed-sources';

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

async function initNewFeeds() {
  console.log('🚀 Initializing new OwnerFi RSS feeds...\n');

  let added = 0;
  let existing = 0;

  for (const feed of OWNERFI_FEEDS) {
    try {
      const feedRef = doc(db, 'feed_sources', feed.id);
      const feedSnap = await getDoc(feedRef);

      if (feedSnap.exists()) {
        console.log(`⏭️  ${feed.id} - already exists`);
        existing++;
      } else {
        await setDoc(feedRef, {
          ...feed,
          articlesProcessed: 0,
          lastFetched: 0, // Set to 0 so it fetches immediately
          createdAt: Date.now()
        });
        console.log(`✅ ${feed.id} - added`);
        added++;
      }
    } catch (error) {
      console.error(`❌ ${feed.id} - error:`, error);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Added: ${added}`);
  console.log(`   Already existed: ${existing}`);
  console.log(`   Total OwnerFi feeds: ${OWNERFI_FEEDS.length}`);
}

initNewFeeds().catch(console.error);
