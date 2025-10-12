// Test RSS Feed + AI Quality Evaluation
require('dotenv').config({ path: '.env.local' });

// Polyfill fetch for Node.js
if (!globalThis.fetch) {
  globalThis.fetch = require('node-fetch');
}

async function testRSSAndAI() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║         Testing RSS Feed + AI Quality Evaluation              ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const { addFeedSource, getAllFeedSources, getUnprocessedArticles } = require('./src/lib/feed-store.ts');
  const { processFeedSource } = require('./src/lib/rss-fetcher.ts');
  const { evaluateArticleQuality } = require('./src/lib/article-quality-filter.ts');
  const { CARZ_FEEDS, OWNERFI_FEEDS } = require('./src/config/feed-sources.ts');

  // Initialize feeds
  console.log('📡 Initializing feeds...');
  CARZ_FEEDS.forEach(feed => addFeedSource(feed));
  OWNERFI_FEEDS.forEach(feed => addFeedSource(feed));
  console.log(`✅ Added ${CARZ_FEEDS.length + OWNERFI_FEEDS.length} feeds\n`);

  // Fetch from first 3 feeds
  console.log('📥 Fetching articles from RSS feeds...\n');
  const feeds = getAllFeedSources().slice(0, 3);

  for (const feed of feeds) {
    console.log(`Fetching: ${feed.name}`);
    try {
      await processFeedSource(feed);
      console.log(`✅ ${feed.name} - Success\n`);
    } catch (error) {
      console.log(`❌ ${feed.name} - Error: ${error.message}\n`);
    }
  }

  // Get articles
  const articles = getUnprocessedArticles(undefined, 10);
  console.log(`📊 Found ${articles.length} new articles\n`);

  if (articles.length === 0) {
    console.log('⚠️  No new articles found.');
    console.log('   This is normal if feeds were recently checked.');
    console.log('   Real-time filter only shows articles AFTER last check.\n');
    return;
  }

  // Evaluate top 3 with AI
  console.log('🤖 Evaluating articles with OpenAI...\n');
  const results = [];

  for (let i = 0; i < Math.min(3, articles.length); i++) {
    const article = articles[i];
    const shortTitle = article.title.length > 60
      ? article.title.substring(0, 60) + '...'
      : article.title;

    // Get the feed to find category
    const { getFeedSource } = require('./src/lib/feed-store.ts');
    const feed = getFeedSource(article.feedId);
    const category = feed?.category || 'carz';

    console.log(`\nEvaluating Article ${i + 1}:`);
    console.log(`Title: ${shortTitle}`);
    console.log(`Category: ${category.toUpperCase()}`);
    console.log(`Source: ${feed?.name || 'Unknown'}`);

    try {
      const quality = await evaluateArticleQuality(
        article.title,
        article.content,
        category
      );

      results.push({
        title: article.title,
        category: feed?.category || 'unknown',
        source: feed?.name || article.feedId,
        score: quality.score,
        shouldMakeVideo: quality.shouldMakeVideo,
        reasoning: quality.reasoning,
        strengths: quality.strengths,
        redFlags: quality.redFlags
      });

      console.log(`Score: ${quality.score} / 100`);
      console.log(`Make Video? ${quality.shouldMakeVideo ? '✅ YES' : '❌ NO'}`);
      console.log(`Reasoning: ${quality.reasoning}`);

    } catch (error) {
      console.log(`❌ AI Error: ${error.message}`);
    }
  }

  // Display results
  console.log('\n' + '='.repeat(70));
  console.log('TOP 3 ARTICLES (Ranked by AI Score)');
  console.log('='.repeat(70) + '\n');

  results.sort((a, b) => b.score - a.score);

  results.forEach((result, i) => {
    console.log(`${i + 1}. ${result.title}`);
    console.log(`   Category: ${result.category.toUpperCase()}`);
    console.log(`   Source: ${result.source}`);
    console.log(`   AI Score: ${result.score} / 100`);
    console.log(`   Make Video? ${result.shouldMakeVideo ? '✅ YES (Score >= 70)' : '❌ NO (Score < 70)'}`);
    console.log(`   Reasoning: ${result.reasoning}`);
    if (result.strengths.length > 0) {
      console.log(`   Strengths: ${result.strengths.join(', ')}`);
    }
    if (result.redFlags.length > 0) {
      console.log(`   Red Flags: ${result.redFlags.join(', ')}`);
    }
    console.log('');
  });

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                     Test Complete!                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
}

testRSSAndAI().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  console.error(error);
  process.exit(1);
});
