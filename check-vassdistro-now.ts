import { db } from './src/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

async function check() {
  console.log('🔍 Checking VassDistro articles in Firestore...\n');

  // Get ALL articles
  const allQuery = query(collection(db!, 'vassdistro_articles'), limit(100));
  const allSnap = await getDocs(allQuery);

  console.log(`📊 Total articles in DB: ${allSnap.size}`);

  if (allSnap.size === 0) {
    console.log('❌ NO ARTICLES IN DATABASE!');
    console.log('\nProblem: Articles need to be fetched from RSS feeds first.');
    console.log('\nSolution: Run RSS fetch cron:');
    console.log('curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/fetch-rss\n');
    return;
  }

  const articles = allSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as any[];

  const unprocessed = articles.filter(a => !a.processed);
  const withScores = articles.filter(a => typeof a.qualityScore === 'number');
  const highQuality = articles.filter(a => typeof a.qualityScore === 'number' && a.qualityScore >= 70);

  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  const recent = articles.filter(a => a.pubDate >= thirtyDaysAgo);

  console.log(`\n📈 Article Breakdown:`);
  console.log(`   Unprocessed: ${unprocessed.length}`);
  console.log(`   With quality scores: ${withScores.length}`);
  console.log(`   High quality (≥70): ${highQuality.length}`);
  console.log(`   Recent (≤30 days): ${recent.length}`);

  const eligible = unprocessed.filter(a =>
    typeof a.qualityScore === 'number' &&
    a.qualityScore >= 70 &&
    a.pubDate >= thirtyDaysAgo
  );

  console.log(`\n✅ ELIGIBLE for workflow: ${eligible.length}`);

  if (eligible.length === 0) {
    console.log('\n❌ NO ELIGIBLE ARTICLES!');
    console.log('\nReasons:');

    if (unprocessed.length === 0) {
      console.log('  ⚠️  All articles are marked as processed');
      console.log('  Solution: Wait for new RSS fetch or unmark some articles');
    }

    if (withScores.length === 0) {
      console.log('  ⚠️  No articles have been rated');
      console.log('  Solution: Run rating cron:');
      console.log('  curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/rate-articles');
    } else if (highQuality.length === 0) {
      console.log('  ⚠️  No articles with score ≥70');
      console.log(`  Highest score: ${Math.max(...withScores.map(a => a.qualityScore))}`);
    }

    if (recent.length === 0) {
      console.log('  ⚠️  All articles are older than 30 days');
      const oldestDays = Math.floor((now - Math.max(...articles.map(a => a.pubDate))) / (24 * 60 * 60 * 1000));
      console.log(`  Newest article is ${oldestDays} days old`);
    }
  } else {
    console.log('\n✅ Top eligible articles:');
    eligible
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
      .slice(0, 5)
      .forEach((a, i) => {
        const daysOld = Math.floor((now - a.pubDate) / (24 * 60 * 60 * 1000));
        console.log(`  ${i + 1}. Score: ${a.qualityScore}, Age: ${daysOld}d, "${a.title.substring(0, 60)}"`);
      });
  }
}

check()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
