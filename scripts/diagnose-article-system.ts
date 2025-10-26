import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, limit as firestoreLimit } from 'firebase/firestore';

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

async function diagnoseBrand(brand: 'carz' | 'ownerfi' | 'vassdistro') {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${brand.toUpperCase()} ARTICLE SYSTEM DIAGNOSIS`);
  console.log('='.repeat(60));

  const articlesCollection = `${brand}_articles`;
  const feedsCollection = `${brand}_rss_feeds`;

  // Check RSS feeds
  try {
    const feedsSnapshot = await getDocs(collection(db, feedsCollection));
    const feeds = feedsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`\n📡 RSS FEEDS: ${feeds.length} total`);
    const enabledFeeds = feeds.filter((f: any) => f.enabled);
    console.log(`   Enabled: ${enabledFeeds.length}`);

    if (enabledFeeds.length > 0) {
      console.log('\n   Enabled feeds:');
      enabledFeeds.forEach((f: any) => {
        const lastFetched = f.lastFetched ? new Date(f.lastFetched).toLocaleString() : 'Never';
        console.log(`   • ${f.name} (ID: ${f.id})`);
        console.log(`     Last fetched: ${lastFetched}`);
        if (f.lastError) console.log(`     ⚠️  Last error: ${f.lastError}`);
      });
    }
  } catch (error) {
    console.log(`\n❌ RSS FEEDS: Error - ${error}`);
  }

  // Check all articles
  try {
    const allArticlesQuery = query(collection(db, articlesCollection), firestoreLimit(100));
    const allSnapshot = await getDocs(allArticlesQuery);

    console.log(`\n📰 TOTAL ARTICLES: ${allSnapshot.size}`);

    if (allSnapshot.size === 0) {
      console.log('   ❌ NO ARTICLES FOUND IN DATABASE');
      console.log('   Action needed: Run RSS fetch cron to populate articles');
      return;
    }

    const articles = allSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const processed = articles.filter((a: any) => a.processed);
    const unprocessed = articles.filter((a: any) => !a.processed);
    const rated = articles.filter((a: any) => typeof a.qualityScore === 'number');
    const unrated = articles.filter((a: any) => typeof a.qualityScore !== 'number');

    console.log(`   Processed: ${processed.length}`);
    console.log(`   Unprocessed: ${unprocessed.length}`);
    console.log(`   Rated: ${rated.length}`);
    console.log(`   Unrated: ${unrated.length}`);

    // Check for workflow-eligible articles
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    const eligible = unprocessed.filter((a: any) =>
      typeof a.qualityScore === 'number' &&
      a.qualityScore >= 70 &&
      a.pubDate >= threeDaysAgo
    );

    console.log(`\n✅ WORKFLOW-ELIGIBLE ARTICLES: ${eligible.length}`);
    console.log(`   (Score >= 70, unprocessed, published within 3 days)`);

    if (eligible.length > 0) {
      console.log('\n   Top eligible articles:');
      eligible
        .sort((a: any, b: any) => (b.qualityScore || 0) - (a.qualityScore || 0))
        .slice(0, 5)
        .forEach((a: any) => {
          const daysOld = Math.floor((Date.now() - a.pubDate) / (24 * 60 * 60 * 1000));
          console.log(`   • Score: ${a.qualityScore}, Age: ${daysOld}d - "${a.title.substring(0, 50)}"`);
        });
    } else {
      console.log('\n   ❌ NO ELIGIBLE ARTICLES AVAILABLE');

      // Diagnose why
      const highQuality = unprocessed.filter((a: any) => typeof a.qualityScore === 'number' && a.qualityScore >= 70);
      const recent = unprocessed.filter((a: any) => a.pubDate >= threeDaysAgo);

      console.log('\n   Diagnosis:');
      console.log(`   • Unprocessed articles with score >= 70: ${highQuality.length}`);
      console.log(`   • Unprocessed articles within 3 days: ${recent.length}`);

      if (unprocessed.length === 0) {
        console.log('   ⚠️  All articles are marked as processed');
        console.log('   Action needed: RSS fetch cron needs to bring in new articles');
      } else if (highQuality.length === 0) {
        console.log('   ⚠️  No high-quality articles (score >= 70)');
        console.log('   Top scores:');
        unprocessed
          .sort((a: any, b: any) => (b.qualityScore || 0) - (a.qualityScore || 0))
          .slice(0, 5)
          .forEach((a: any) => {
            console.log(`      • Score: ${a.qualityScore || 'N/A'} - "${a.title.substring(0, 50)}"`);
          });
      } else if (recent.length === 0) {
        console.log('   ⚠️  All articles are older than 3 days');
        console.log('   Action needed: RSS feeds need to fetch newer articles');
      }
    }

    // Show article age distribution
    console.log('\n📅 ARTICLE AGE DISTRIBUTION:');
    const now = Date.now();
    const age24h = unprocessed.filter((a: any) => a.pubDate >= now - 24 * 60 * 60 * 1000).length;
    const age3d = unprocessed.filter((a: any) => a.pubDate >= now - 3 * 24 * 60 * 60 * 1000).length;
    const age7d = unprocessed.filter((a: any) => a.pubDate >= now - 7 * 24 * 60 * 60 * 1000).length;
    const ageOlder = unprocessed.filter((a: any) => a.pubDate < now - 7 * 24 * 60 * 60 * 1000).length;

    console.log(`   Last 24 hours: ${age24h}`);
    console.log(`   Last 3 days: ${age3d}`);
    console.log(`   Last 7 days: ${age7d}`);
    console.log(`   Older than 7 days: ${ageOlder}`);

  } catch (error) {
    console.log(`\n❌ ARTICLES: Error - ${error}`);
  }
}

async function diagnoseAll() {
  console.log('\n🔍 DIAGNOSING ENTIRE ARTICLE SYSTEM\n');

  for (const brand of ['carz', 'ownerfi', 'vassdistro'] as const) {
    await diagnoseBrand(brand);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ DIAGNOSIS COMPLETE');
  console.log('='.repeat(60) + '\n');
}

diagnoseAll().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
