/**
 * CONSOLIDATED Video Generation Cron
 *
 * Generates article videos for brands with RSS feeds:
 * - carz, ownerfi, abdullah, personal, gaza
 *
 * Active brands: carz, ownerfi, abdullah, personal, gaza
 *
 * Schedule: 0 8,12,19 * * * (3 times daily at 8am, 12pm, 7pm CST)
 * Optimal times based on platform analytics:
 * - 8 AM: LinkedIn/Twitter morning peak
 * - 12 PM: Universal lunch peak (all platforms)
 * - 7 PM: Evening prime time (Instagram/TikTok/YouTube)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronLock } from '@/lib/cron-lock';

const CRON_SECRET = process.env.CRON_SECRET;
export const maxDuration = 300; // 5 minutes - processes multiple brands sequentially

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (!CRON_SECRET) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }
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
        articles: [] as any[],
        gaza: null as any,
        realtors: null as any
      };

      // 1. Generate article videos for brands with RSS feeds
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎬 GENERATING ARTICLE VIDEOS (Viral Brands)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const articleResults = await generateArticleVideos();
      results.articles = articleResults;

      // 2. Generate Gaza humanitarian news videos (separate workflow)
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🕊️  GENERATING GAZA NEWS VIDEOS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const gazaResult = await generateGazaVideo();
      results.gaza = gazaResult;

      // 3. Generate Realtor videos (question-based topics, not RSS)
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🏠 GENERATING REALTOR VIDEOS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const realtorResult = await generateRealtorVideo();
      results.realtors = realtorResult;

      const duration = Date.now() - startTime;

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ [GENERATE-VIDEOS] Complete');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 Summary:`);
      console.log(`   Articles: ${results.articles.filter(r => r.success).length}/${results.articles.length} generated`);
      console.log(`   Gaza: ${results.gaza?.success ? '✅' : '⏭️ '} ${results.gaza?.message || results.gaza?.workflowId || 'skipped'}`);
      console.log(`   Realtors: ${results.realtors?.success ? '✅' : '⏭️ '} ${results.realtors?.message || results.realtors?.workflowId || 'skipped'}`);
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
  // Active article brands with RSS feeds
  // NOTE: Abdullah is NOT included here - it has its own dedicated cron (/api/cron/abdullah)
  //       that generates themed content (mindset/business/money/freedom/story)
  // NOTE: Personal is NOT included - it uses Google Drive uploads, not RSS
  // NOTE: Realtors is handled separately below (uses question-based topics, not RSS)
  const articleBrands = ['carz', 'ownerfi'] as const;

  const results = [];

  for (const brand of articleBrands) {
    console.log(`\n📂 Checking ${brand} articles...`);

    try {
      // CRITICAL FIX: Check for quality articles (qualityScore >= 30) before triggering workflow
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

      // Get unprocessed articles with quality score >= 30 (in-memory filter)
      const q = query(
        collection(db, collectionName),
        where('processed', '==', false),
        firestoreLimit(20)
      );

      const snapshot = await getDocs(q);
      const articles = snapshot.docs.map(doc => doc.data());

      // Filter for quality articles (score >= 30)
      // Lowered from 50 to 30 because articles weren't being processed
      const qualityArticles = articles.filter((a: any) =>
        typeof a.qualityScore === 'number' && a.qualityScore >= 30
      );

      console.log(`   Found ${articles.length} unprocessed, ${qualityArticles.length} quality (score >= 30)`);

      if (qualityArticles.length === 0) {
        console.log(`   ⏭️  No quality articles available - skipping`);
        results.push({
          brand,
          success: false,
          skipped: true,
          message: 'No quality articles available (need score >= 30)'
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

// ============================================================================
// 3. GENERATE GAZA VIDEO (Humanitarian News - Special Workflow)
// ============================================================================

async function generateGazaVideo() {
  const { getAndLockArticle, addWorkflowToQueue, updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
  const { getBrandWebhookUrl } = await import('@/lib/brand-utils');
  const { videoProvider } = await import('@/lib/env-config');

  const brand = 'gaza';
  const activeProvider = videoProvider;

  try {
    // Check daily limit (5 videos per day)
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = await getAdminDb();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();

    const todaySnapshot = await adminDb
      .collection('gaza_workflow_queue')
      .where('createdAt', '>=', startOfDay)
      .get();

    const videosToday = todaySnapshot.size;
    const maxPerDay = 5;

    console.log(`   Videos generated today: ${videosToday}/${maxPerDay}`);
    console.log(`   Video provider: ${activeProvider}`);

    if (videosToday >= maxPerDay) {
      console.log(`   ⏭️  Daily limit reached (${maxPerDay}/day)`);
      return {
        success: false,
        skipped: true,
        message: `Daily limit reached (${videosToday}/${maxPerDay})`
      };
    }

    // Get and lock best article
    console.log(`   📰 Fetching best Gaza article...`);
    const article = await getAndLockArticle(brand as any);

    if (!article) {
      console.log(`   ⏭️  No quality articles available`);
      return {
        success: false,
        skipped: true,
        message: 'No quality articles available'
      };
    }

    console.log(`   ✅ Article: "${article.title.substring(0, 50)}..."`);

    // Generate script using OpenAI (same as gaza-video-generator)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    let script: string;

    if (OPENAI_API_KEY) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayName = days[new Date().getDay()];
      const dailyThemes: Record<string, { theme: string; emotion: string }> = {
        'Monday': { theme: 'Breaking News', emotion: 'Urgency / Concern' },
        'Tuesday': { theme: 'Human Stories', emotion: 'Sadness / Empathy' },
        'Wednesday': { theme: 'Humanitarian Crisis', emotion: 'Grief / Despair' },
        'Thursday': { theme: 'Aid & Relief', emotion: 'Hope / Determination' },
        'Friday': { theme: 'Voices from Gaza', emotion: 'Compassion / Solidarity' },
        'Saturday': { theme: 'World Response', emotion: 'Frustration / Hope' },
        'Sunday': { theme: 'Call to Action', emotion: 'Heartbreak / Urgency' }
      };
      const todayTheme = dailyThemes[todayName];

      const prompt = `You are creating a short-form news video script about the Gaza humanitarian crisis.
TONE: Somber, empathetic, urgent but respectful. NEVER sensationalize suffering.
EMOTION TODAY: ${todayTheme.emotion}
THEME: ${todayTheme.theme}

ARTICLE:
Title: ${article.title}
Content: ${(article.content || article.description || '').substring(0, 1500)}

STRUCTURE: Hook (3-5s) → Story (15-20s) → Impact (5-10s). 30 seconds max (~90 words).
Return ONLY the script text - no labels, brackets, or formatting.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a news script writer for Gaza humanitarian crisis coverage. Serious, empathetic, respectful. Never sensationalize suffering.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 300
        })
      });

      const data = await response.json();
      script = data.choices?.[0]?.message?.content?.trim() || `Breaking news from Gaza. ${article.title}. The humanitarian crisis continues as civilians desperately need aid.`;
    } else {
      script = `Breaking news from Gaza. ${article.title}. The humanitarian crisis continues as civilians desperately need aid. Families are struggling to survive. Share this to spread awareness.`;
    }

    console.log(`   📝 Script: ${script.substring(0, 80)}...`);

    // Create workflow entry
    const todayStr = new Date().toISOString().split('T')[0];
    const articleId = `gaza_${article.id}_${todayStr}`;

    let queueItem;
    try {
      queueItem = await addWorkflowToQueue(
        articleId,
        article.title,
        brand as any
      );
    } catch (queueError) {
      if (queueError instanceof Error && queueError.message.includes('Duplicate workflow blocked')) {
        console.warn(`   ⚠️  ${queueError.message}`);
        return { success: false, error: 'Duplicate workflow', skipped: true };
      }
      throw queueError;
    }

    const workflowId = queueItem.id;
    let videoId: string;
    let agentId: string;

    if (activeProvider === 'synthesia') {
      // Synthesia path
      console.log(`   🎥 Sending to Synthesia...`);
      const { generateSynthesiaVideo } = await import('@/lib/synthesia-client');
      const { getSynthesiaAgentForBrand, buildSynthesiaClipConfig } = await import('@/config/synthesia-agents');

      const synthAgent = getSynthesiaAgentForBrand('gaza');
      const clip = buildSynthesiaClipConfig(synthAgent, script);

      const result = await generateSynthesiaVideo(
        {
          title: article.title.substring(0, 50),
          aspectRatio: '9:16',
          clips: [clip],
          callbackId: `gaza:${workflowId}`,
        },
        'gaza',
        workflowId
      );

      if (!result.success || !result.video_id) {
        await updateWorkflowStatus(workflowId, brand as any, {
          status: 'failed',
          error: result.error || 'Synthesia video generation failed'
        } as any);
        return { success: false, error: result.error || 'Synthesia failed' };
      }

      videoId = result.video_id;
      agentId = synthAgent.id;

      await updateWorkflowStatus(workflowId, brand as any, {
        caption: `${article.title}\n\n#Gaza #Palestine #HumanitarianCrisis #FreePalestine #GazaRelief`,
        title: article.title.substring(0, 50),
        synthesiaVideoId: videoId,
        videoProvider: 'synthesia',
        agentId,
        status: 'synthesia_processing'
      } as any);
    } else {
      // HeyGen path (legacy)
      console.log(`   🎥 Sending to HeyGen...`);
      const { createGazaVideoGenerator } = await import('@/lib/gaza-video-generator');
      const generator = createGazaVideoGenerator();

      const result = await generator.generateVideo(
        {
          id: article.id,
          title: article.title,
          content: article.content || article.description,
          link: article.link,
          description: article.description
        },
        workflowId,
        undefined,
        {}
      );

      if (!result.videoId) {
        await updateWorkflowStatus(workflowId, brand as any, {
          status: 'failed',
          error: 'Video generation failed - no videoId returned'
        });
        return { success: false, error: 'Video generation failed - no videoId returned' };
      }

      videoId = result.videoId;
      agentId = result.agentId;

      await updateWorkflowStatus(workflowId, brand as any, {
        status: 'heygen_processing',
        heygenVideoId: videoId,
        videoProvider: 'heygen'
      });
    }

    console.log(`   ✅ Video generation started (${activeProvider}): ${videoId}`);
    return {
      success: true,
      workflowId,
      videoId,
      article: article.title.substring(0, 60),
      provider: activeProvider
    };

  } catch (error) {
    console.error(`   ❌ Error generating Gaza video:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// 4. GENERATE REALTOR VIDEO (Question-Based Topics - Sub-brand of OwnerFi)
// ============================================================================

async function generateRealtorVideo() {
  const { addWorkflowToQueue, updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
  const { generateRealtorScript, buildRealtorVideoRequestWithAgent, getCategoryForHour } = await import('@/lib/realtor-content-generator');
  const { getBrandWebhookUrl } = await import('@/lib/brand-utils');
  const { circuitBreakers, fetchWithTimeout, TIMEOUTS } = await import('@/lib/api-utils');

  const brand = 'realtors';
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  const { videoProvider } = await import('@/lib/env-config');
  const activeProvider = videoProvider;

  try {
    // Check daily limit (3 videos per day for realtors)
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = await getAdminDb();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();

    const todaySnapshot = await adminDb
      .collection('realtors_workflow_queue')
      .where('createdAt', '>=', startOfDay)
      .get();

    const videosToday = todaySnapshot.size;
    const maxPerDay = 3;

    console.log(`   Videos generated today: ${videosToday}/${maxPerDay}`);

    if (videosToday >= maxPerDay) {
      console.log(`   ⏭️  Daily limit reached (${maxPerDay}/day)`);
      return {
        success: false,
        skipped: true,
        message: `Daily limit reached (${videosToday}/${maxPerDay})`
      };
    }

    // Determine category based on current hour (CST)
    const now = new Date();
    const cstHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' })).getHours();
    const category = getCategoryForHour(cstHour);

    console.log(`   📅 Current CST hour: ${cstHour}`);
    console.log(`   🎯 Category: ${category}`);

    // Generate script from topic
    console.log(`   🤖 Generating realtor script...`);
    const script = await generateRealtorScript(category);

    console.log(`   ✅ Script generated:`);
    console.log(`      Topic: ${script.topicId}`);
    console.log(`      Hook: ${script.hook}`);

    // Create workflow entry with deduplication key
    const todayStr = new Date().toISOString().split('T')[0];
    const articleId = `realtors_${script.topicId}_${todayStr}_${cstHour}h`;

    let queueItem;
    try {
      queueItem = await addWorkflowToQueue(
        articleId,
        script.title,
        brand as any
      );
    } catch (queueError) {
      if (queueError instanceof Error && queueError.message.includes('Duplicate workflow blocked')) {
        console.warn(`   ⚠️  ${queueError.message}`);
        return { success: false, error: 'Duplicate workflow', skipped: true };
      }
      throw queueError;
    }

    const workflowId = queueItem.id;
    console.log(`   📝 Workflow ID: ${workflowId}`);

    let videoId: string;
    let agentId: string;

    if (activeProvider === 'synthesia') {
      // Synthesia path
      console.log(`   🎥 Sending to Synthesia...`);
      const { generateSynthesiaVideo } = await import('@/lib/synthesia-client');
      const { getSynthesiaAgentForBrand, buildSynthesiaClipConfig } = await import('@/config/synthesia-agents');

      const synthAgent = getSynthesiaAgentForBrand('realtors');
      const clip = buildSynthesiaClipConfig(synthAgent, script.script);

      const result = await generateSynthesiaVideo(
        {
          title: script.title,
          aspectRatio: '9:16',
          clips: [clip],
          callbackId: `realtors:${workflowId}`,
        },
        'realtors',
        workflowId
      );

      if (!result.success || !result.video_id) {
        await updateWorkflowStatus(workflowId, brand as any, {
          status: 'failed',
          error: result.error || 'Synthesia video generation failed'
        } as any);
        return { success: false, error: result.error || 'Synthesia failed' };
      }

      videoId = result.video_id;
      agentId = synthAgent.id;

      await updateWorkflowStatus(workflowId, brand as any, {
        caption: script.caption,
        title: script.title,
        synthesiaVideoId: videoId,
        videoProvider: 'synthesia',
        agentId,
        status: 'synthesia_processing'
      } as any);
    } else {
      // HeyGen path (original)
      console.log(`   🎥 Sending to HeyGen...`);

      await updateWorkflowStatus(workflowId, brand as any, {
        caption: script.caption,
        title: script.title,
        status: 'heygen_processing'
      } as any);

      const webhookUrl = getBrandWebhookUrl('realtors', 'heygen');
      const { request: videoRequest, agentId: heygenAgentId } = await buildRealtorVideoRequestWithAgent(script, workflowId);

      const fullRequest = {
        ...videoRequest,
        webhook_url: webhookUrl,
        test: false
      };

      console.log(`   Webhook: ${webhookUrl}`);
      console.log(`   Agent: ${heygenAgentId}`);

      const response = await circuitBreakers.heygen.execute(async () => {
        return await fetchWithTimeout(
          'https://api.heygen.com/v2/video/generate',
          {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'content-type': 'application/json',
              'x-api-key': HEYGEN_API_KEY!
            },
            body: JSON.stringify(fullRequest)
          },
          TIMEOUTS.HEYGEN_API
        );
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`   ❌ HeyGen API error: ${response.status}`);

        await updateWorkflowStatus(workflowId, brand as any, {
          status: 'failed',
          error: `HeyGen error: ${response.status}`
        } as any);

        return { success: false, error: `HeyGen API error: ${response.status}` };
      }

      const data = await response.json();

      if (!data.data || !data.data.video_id) {
        await updateWorkflowStatus(workflowId, brand as any, {
          status: 'failed',
          error: 'HeyGen did not return video_id'
        } as any);
        return { success: false, error: 'HeyGen did not return video_id' };
      }

      videoId = data.data.video_id;
      agentId = heygenAgentId;

      await updateWorkflowStatus(workflowId, brand as any, {
        heygenVideoId: videoId,
        videoProvider: 'heygen',
        agentId
      } as any);
    }

    console.log(`   ✅ Video generation started (${activeProvider}): ${videoId}`);

    return {
      success: true,
      workflowId,
      videoId,
      topic: script.topicId,
      category,
      provider: activeProvider
    };

  } catch (error) {
    console.error(`   ❌ Error generating Realtor video:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
