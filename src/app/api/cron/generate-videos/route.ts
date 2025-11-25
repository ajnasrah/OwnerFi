/**
 * CONSOLIDATED Video Generation Cron
 *
 * Generates article videos for brands with RSS feeds:
 * - carz, ownerfi, vassdistro, abdullah, personal
 *
 * NOTE: podcast and benefit brands have been deprecated and removed.
 *
 * Schedule: 0 9,12,15,18,21 * * * (5 times daily at 9am, 12pm, 3pm, 6pm, 9pm CST)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronLock } from '@/lib/cron-lock';

const CRON_SECRET = process.env.CRON_SECRET;
export const maxDuration = 60; // 1 minute (webhook-based, no long polling)

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎬 [GENERATE-VIDEOS] Consolidated generation starting...');
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Use cron lock to prevent concurrent runs
    return withCronLock('generate-videos', async () => {
      const results = {
        articles: [] as any[]
      };

      // Generate article videos for brands with RSS feeds
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎬 GENERATING ARTICLE VIDEOS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const articleResults = await generateArticleVideos();
      results.articles = articleResults;

      const duration = Date.now() - startTime;

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ [GENERATE-VIDEOS] Complete');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 Summary:`);
      console.log(`   Articles: ${results.articles.filter(r => r.success).length}/${results.articles.length} generated`);
      console.log(`   Duration: ${duration}ms`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        results
      });
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ [GENERATE-VIDEOS] Critical error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

// ============================================================================
// 2. GENERATE ARTICLE VIDEOS
// ============================================================================

async function generateArticleVideos() {
  const { db } = await import('@/lib/firebase');
  const { collection, query, where, getDocs, limit: firestoreLimit } = await import('firebase/firestore');
  const { getCollectionName } = await import('@/lib/feed-store-firestore');
  const { POST: startWorkflow } = await import('@/app/api/workflow/complete-viral/route');

  // Brands with RSS feed-based article generation
  // NOTE: podcast, benefit, property, property-spanish have been deprecated
  const articleBrands = ['carz', 'ownerfi', 'vassdistro', 'abdullah', 'personal'] as const;

  const results = [];

  for (const brand of articleBrands) {
    console.log(`\n📂 Checking ${brand} articles...`);

    try {
      // CRITICAL FIX: Check for quality articles (qualityScore >= 50) before triggering workflow
      // This prevents wasting API calls on brands with no quality content
      const collectionName = getCollectionName('ARTICLES', brand);

      if (!db) {
        console.log(`   ⚠️  Firebase not initialized`);
        results.push({
          brand,
          success: false,
          error: 'Firebase not initialized'
        });
        continue;
      }

      // Get unprocessed articles with quality score >= 50 (in-memory filter)
      const q = query(
        collection(db, collectionName),
        where('processed', '==', false),
        firestoreLimit(20)
      );

      const snapshot = await getDocs(q);
      const articles = snapshot.docs.map(doc => doc.data());

      // Filter for quality articles (score >= 50)
      const qualityArticles = articles.filter((a: any) =>
        typeof a.qualityScore === 'number' && a.qualityScore >= 50
      );

      console.log(`   Found ${articles.length} unprocessed, ${qualityArticles.length} quality (score >= 50)`);

      if (qualityArticles.length === 0) {
        console.log(`   ⏭️  No quality articles available - skipping`);
        results.push({
          brand,
          success: false,
          skipped: true,
          message: 'No quality articles available (need score >= 50)'
        });
        continue;
      }

      // Show top quality article info
      const topArticle = qualityArticles.sort((a: any, b: any) => (b.qualityScore || 0) - (a.qualityScore || 0))[0];
      console.log(`   ✅ Top article: "${topArticle.title?.substring(0, 50)}..." (score: ${topArticle.qualityScore})`);

      // Trigger workflow
      console.log(`   🎬 Triggering video workflow...`);
      const mockRequest = new Request('https://ownerfi.ai/api/workflow/complete-viral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand,
          platforms: ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin'],
          schedule: 'immediate'
        })
      });

      const response = await startWorkflow(mockRequest as any);
      const data = await response.json();

      if (response.status === 200) {
        console.log(`   ✅ Workflow triggered: ${data.workflow_id}`);
        results.push({
          brand,
          success: true,
          workflowId: data.workflow_id,
          article: topArticle.title?.substring(0, 60) || 'Unknown',
          qualityScore: topArticle.qualityScore
        });
      } else {
        console.error(`   ❌ Workflow failed: ${data.error || 'Unknown error'}`);
        results.push({
          brand,
          success: false,
          error: data.error || 'Workflow creation failed'
        });
      }

    } catch (error) {
      console.error(`   ❌ Error processing ${brand}:`, error);
      results.push({
        brand,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}
