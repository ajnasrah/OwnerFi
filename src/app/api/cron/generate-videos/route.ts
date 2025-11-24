/**
 * CONSOLIDATED Video Generation Cron
 *
 * Consolidates 3 separate video generation cron jobs into ONE:
 * 1. podcast/cron (podcast episode generation)
 * 2. generate-video (carz + ownerfi article videos)
 * 3. generate-video-vassdistro (vassdistro article videos)
 *
 * Plus adds support for ALL 8 brands: carz, ownerfi, vassdistro, benefit, abdullah, personal, property, property-spanish
 *
 * Schedule: 0 9,12,15,18,21 * * * (5 times daily at 9am, 12pm, 3pm, 6pm, 9pm CST)
 * Previously: 3 crons × 5 runs/day = 15 invocations/day
 * Now: 1 cron × 5 runs/day = 5 invocations/day
 * SAVINGS: 10 fewer cron invocations per day (67% reduction)
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
        podcast: null as any,
        articles: [] as any[]
      };

      // 1. Generate podcast episode (if due)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('1️⃣  GENERATING PODCAST EPISODE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const podcastResult = await generatePodcastEpisode();
      results.podcast = podcastResult;

      // 2. Generate article videos for brands with RSS feeds
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('2️⃣  GENERATING ARTICLE VIDEOS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const articleResults = await generateArticleVideos();
      results.articles = articleResults;

      const duration = Date.now() - startTime;

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ [GENERATE-VIDEOS] Complete');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 Summary:`);
      console.log(`   Podcast: ${results.podcast?.success ? 'Generated' : 'Skipped/Failed'}`);
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
// 1. GENERATE PODCAST EPISODE
// ============================================================================

async function generatePodcastEpisode() {
  try {
    console.log('🎙️  Checking if podcast episode generation is due...');

    // Import podcast generation libraries
    const { PodcastScheduler } = await import('../../../../../podcast/lib/podcast-scheduler');
    const ScriptGenerator = (await import('../../../../../podcast/lib/script-generator')).default;
    const { addPodcastWorkflow, updatePodcastWorkflow, getHostProfile, getGuestProfile } = await import('@/lib/feed-store-firestore');
    const { getBrandWebhookUrl } = await import('@/lib/brand-utils');

    // Check if we should generate an episode
    const scheduler = new PodcastScheduler();
    await scheduler.loadStateFromFirestore();

    if (!scheduler.shouldGenerateEpisode()) {
      console.log('   ⏭️  Not time for new episode yet');
      return {
        success: true,
        skipped: true,
        message: 'Not time for new episode',
        stats: scheduler.getStats()
      };
    }

    console.log('   ✅ Time to generate new episode!');

    const episodeNumber = scheduler.getStats().last_episode_number + 1;

    // Create workflow
    const workflow = await addPodcastWorkflow(episodeNumber, 'Generating...');
    console.log(`   📊 Workflow created: ${workflow.id}`);

    // Generate script
    console.log('   📝 Generating script...');
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const scriptGen = new ScriptGenerator(OPENAI_API_KEY);
    await scriptGen.loadProfiles();
    const script = await scriptGen.generateScript(undefined, 1); // 1 Q&A pair

    console.log(`   ✅ Script: "${script.episode_title}"`);
    console.log(`      Guest: ${script.guest_name}`);
    console.log(`      Q&A pairs: ${script.qa_pairs?.length || 0}`);

    if (!script.qa_pairs || script.qa_pairs.length === 0) {
      throw new Error('Script generation failed: no Q&A pairs');
    }

    // CRITICAL FIX: Save script data but DON'T change status yet
    // Only change to heygen_processing AFTER we get the video ID
    await updatePodcastWorkflow(workflow.id, {
      episodeTitle: script.episode_title,
      guestName: script.guest_name,
      topic: script.topic,
      // DON'T set status here - will set after HeyGen API success
    });

    // Generate HeyGen video
    console.log('   🎥 Sending to HeyGen...');
    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    if (!HEYGEN_API_KEY) throw new Error('HEYGEN_API_KEY not configured');

    const hostProfile = await getHostProfile();
    const guestProfile = await getGuestProfile(script.guest_id);
    if (!hostProfile || !guestProfile) throw new Error('Profiles not found');

    const webhookUrl = getBrandWebhookUrl('podcast', 'heygen');

    // Build video inputs
    const videoInputs = script.qa_pairs.flatMap((pair) => {
      // Host uses standard talking_photo configuration
      const hostCharacter = {
        type: 'talking_photo',
        talking_photo_id: hostProfile.avatar_id,
        scale: hostProfile.scale || 1.4,
        talking_style: 'expressive'
      };

      // Guest uses standard talking_photo configuration
      const guestCharacter = {
        type: 'talking_photo',
        talking_photo_id: guestProfile.avatar_id,
        scale: guestProfile.scale || 1.4,
        talking_style: 'expressive'
      };

      return [
        {
          character: hostCharacter,
          voice: { type: 'text', input_text: pair.question, voice_id: hostProfile.voice_id, speed: 1.1 },
          background: { type: 'color', value: hostProfile.background_color || '#ffffff' }
        },
        {
          character: guestCharacter,
          voice: { type: 'text', input_text: pair.answer, voice_id: guestProfile.voice_id, speed: 1.1 },
          background: { type: 'color', value: guestProfile.background_color || '#f5f5f5' }
        }
      ];
    });

    if (videoInputs.length === 0) throw new Error('video_inputs is empty');

    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Api-Key': HEYGEN_API_KEY
      },
      body: JSON.stringify({
        test: false,
        caption: false,
        callback_id: workflow.id,
        webhook_url: webhookUrl,
        video_inputs: videoInputs,
        dimension: { width: 1080, height: 1920 }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
    }

    const heygenData = await response.json();
    const videoId = heygenData.data?.video_id;
    if (!videoId) throw new Error('HeyGen did not return video_id');

    console.log(`   ✅ HeyGen video ID: ${videoId}`);

    // CRITICAL FIX: Update workflow with BOTH videoId AND status atomically
    // This ensures we never have heygen_processing status without a videoId
    await updatePodcastWorkflow(workflow.id, {
      heygenVideoId: videoId,
      status: 'heygen_processing'
    });

    // Record episode
    const recordedEpisodeNumber = await scheduler.recordEpisode(script.guest_id, videoId);

    console.log(`   🎉 Episode #${recordedEpisodeNumber} initiated!`);

    return {
      success: true,
      episode: {
        number: recordedEpisodeNumber,
        title: script.episode_title,
        guest: script.guest_name,
        video_id: videoId,
        workflow_id: workflow.id
      }
    };

  } catch (error) {
    console.error('   ❌ Podcast generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
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
  // NOTE: podcast, property, property-spanish don't use RSS article workflows
  const articleBrands = ['carz', 'ownerfi', 'vassdistro', 'benefit', 'abdullah', 'personal'] as const;

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
