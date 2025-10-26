// Initialize VassDistro: Add feeds, fetch articles, rate them
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { VASSDISTRO_FEEDS } from '@/config/feed-sources';
import { processFeedSource } from '@/lib/rss-fetcher';
import { evaluateArticlesBatch } from '@/lib/article-quality-filter';

export const maxDuration = 300;

export async function POST() {
  const results = {
    step: '',
    feeds: 0,
    articles: 0,
    rated: 0,
    errors: [] as string[]
  };

  try {
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    console.log('🚀 Initializing VassDistro...\n');

    // Step 1: Check if feeds exist
    results.step = 'Checking feeds';
    const feedsSnapshot = await getDocs(collection(db, 'vassdistro_rss_feeds'));

    if (feedsSnapshot.empty) {
      console.log('📝 Adding VassDistro RSS feeds...');
      for (const feed of VASSDISTRO_FEEDS) {
        await setDoc(doc(db, 'vassdistro_rss_feeds', feed.id), {
          ...feed,
          articlesProcessed: 0
        });
        results.feeds++;
      }
      console.log(`✅ Added ${results.feeds} feeds\n`);
    } else {
      results.feeds = feedsSnapshot.size;
      console.log(`✅ ${results.feeds} feeds already exist\n`);
    }

    // Step 2: Fetch articles from RSS
    results.step = 'Fetching articles';
    console.log('📡 Fetching articles from RSS feeds...');

    for (const feed of VASSDISTRO_FEEDS) {
      try {
        const feedWithDefaults = {
          ...feed,
          lastFetched: 0, // Force fetch all articles
          articlesProcessed: 0
        };

        const result = await processFeedSource(feedWithDefaults as any);

        if (result.success) {
          results.articles += result.newArticles;
          console.log(`  ✅ ${feed.name}: ${result.newArticles} articles`);
        } else {
          console.log(`  ❌ ${feed.name}: ${result.error}`);
          results.errors.push(`${feed.name}: ${result.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log(`  ❌ ${feed.name}: ${errorMsg}`);
        results.errors.push(`${feed.name}: ${errorMsg}`);
      }
    }

    console.log(`\n✅ Fetched ${results.articles} total articles\n`);

    if (results.articles === 0) {
      return NextResponse.json({
        success: false,
        error: 'No articles fetched',
        details: results
      }, { status: 500 });
    }

    // Step 3: Rate articles
    results.step = 'Rating articles';
    console.log('🤖 Rating articles with AI...');

    const articlesSnapshot = await getDocs(collection(db, 'vassdistro_articles'));
    const allArticles = articlesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    const needRating = allArticles.filter(a => a.qualityScore === undefined);

    if (needRating.length > 0) {
      console.log(`  Rating ${needRating.length} articles...`);

      const scores = await evaluateArticlesBatch(
        needRating.map(a => ({
          title: a.title,
          content: a.content || a.description,
          category: 'vassdistro'
        })),
        10 // 10 concurrent API calls
      );

      // Update articles with scores
      for (let i = 0; i < needRating.length; i++) {
        await setDoc(doc(db, 'vassdistro_articles', needRating[i].id), {
          ...needRating[i],
          qualityScore: scores[i].score,
          aiReasoning: scores[i].reasoning,
          ratedAt: Date.now()
        });
        results.rated++;
      }

      console.log(`✅ Rated ${results.rated} articles\n`);
    } else {
      console.log(`  ℹ️  All articles already rated\n`);
    }

    // Step 4: Show stats
    const finalSnapshot = await getDocs(collection(db, 'vassdistro_articles'));
    const finalArticles = finalSnapshot.docs.map(doc => doc.data()) as any[];

    const unprocessed = finalArticles.filter(a => !a.processed);
    const highQuality = finalArticles.filter(a =>
      !a.processed &&
      typeof a.qualityScore === 'number' &&
      a.qualityScore >= 70
    );

    const topScores = highQuality
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
      .slice(0, 10)
      .map(a => a.qualityScore);

    console.log('📊 Final Stats:');
    console.log(`   Total articles: ${finalArticles.length}`);
    console.log(`   Unprocessed: ${unprocessed.length}`);
    console.log(`   High quality (≥70): ${highQuality.length}`);
    console.log(`   Top 10 scores: ${topScores.join(', ')}\n`);

    return NextResponse.json({
      success: true,
      message: '✅ VassDistro initialized successfully!',
      stats: {
        feedsAdded: results.feeds,
        articlesFetched: results.articles,
        articlesRated: results.rated,
        totalArticles: finalArticles.length,
        unprocessed: unprocessed.length,
        highQuality: highQuality.length,
        topScores
      },
      errors: results.errors.length > 0 ? results.errors : undefined
    });

  } catch (error) {
    console.error('❌ Initialization error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      step: results.step,
      details: results
    }, { status: 500 });
  }
}
