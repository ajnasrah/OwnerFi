// Test Top N Article Selection (No Threshold)
require('dotenv').config({ path: '.env.local' });

if (!globalThis.fetch) {
  globalThis.fetch = require('node-fetch');
}

async function testTopArticleSelection() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║         Testing TOP N Article Selection (No Threshold)        ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const { addFeedSource, getAllFeedSources, getUnprocessedArticles, getFeedSource } = require('./src/lib/feed-store.ts');
  const { processFeedSource } = require('./src/lib/rss-fetcher.ts');
  const { evaluateArticleQuality } = require('./src/lib/article-quality-filter.ts');
  const { CARZ_FEEDS, OWNERFI_FEEDS } = require('./src/config/feed-sources.ts');

  // Initialize feeds
  console.log('📡 Initializing feeds...');
  CARZ_FEEDS.forEach(feed => addFeedSource(feed));
  OWNERFI_FEEDS.forEach(feed => addFeedSource(feed));
  console.log(`✅ Added ${CARZ_FEEDS.length + OWNERFI_FEEDS.length} feeds\n`);

  // Fetch articles
  console.log('📥 Fetching articles from first 3 Carz feeds...\n');
  const feeds = getAllFeedSources('carz').slice(0, 3);

  for (const feed of feeds) {
    console.log(`Fetching: ${feed.name}`);
    try {
      await processFeedSource(feed);
      console.log(`✅ Success\n`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }

  // Get articles
  const articles = getUnprocessedArticles('carz', 10);
  console.log(`📊 Found ${articles.length} new Carz articles\n`);

  if (articles.length === 0) {
    console.log('⚠️  No new articles found. Try again later.\n');
    return;
  }

  // Evaluate ALL articles
  console.log('🤖 Evaluating ALL articles with OpenAI...\n');
  const evaluations = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const feed = getFeedSource(article.feedId);

    console.log(`${i + 1}. Evaluating: ${article.title.substring(0, 60)}...`);

    try {
      const quality = await evaluateArticleQuality(
        article.title,
        article.content,
        'carz'
      );

      evaluations.push({
        title: article.title,
        source: feed?.name || 'Unknown',
        score: quality.score,
        reasoning: quality.reasoning
      });

      console.log(`   Score: ${quality.score}/100\n`);

    } catch (error) {
      console.log(`   ❌ AI Error: ${error.message}\n`);
    }
  }

  // Sort by score and show top 5
  evaluations.sort((a, b) => b.score - a.score);

  console.log('\n' + '='.repeat(70));
  console.log('🏆 TOP 5 ARTICLES (Will Generate Videos)');
  console.log('='.repeat(70) + '\n');

  const top5 = evaluations.slice(0, 5);
  top5.forEach((result, i) => {
    console.log(`${i + 1}. ${result.title}`);
    console.log(`   Source: ${result.source}`);
    console.log(`   AI Score: ${result.score} / 100 ✅`);
    console.log(`   Reasoning: ${result.reasoning}`);
    console.log('');
  });

  // Show rejected articles
  const rejected = evaluations.slice(5);
  if (rejected.length > 0) {
    console.log('='.repeat(70));
    console.log(`❌ NOT SELECTED (${rejected.length} articles)`);
    console.log('='.repeat(70) + '\n');

    rejected.forEach((result, i) => {
      console.log(`${i + 1}. ${result.title.substring(0, 60)}... - Score: ${result.score}/100`);
    });
    console.log('');
  }

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║  ✅ NEW STRATEGY: Always pick top 5 regardless of score!     ║');
  console.log('║                                                                ║');
  console.log('║  • NO 70+ threshold anymore                                   ║');
  console.log('║  • Evaluates ALL available articles                           ║');
  console.log('║  • Picks the 5 highest-rated ones                             ║');
  console.log('║  • Even 50/100 scores will be selected if they\'re top 5      ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
}

testTopArticleSelection().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});
