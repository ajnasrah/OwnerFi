// Complete Viral Video Workflow: RSS → Script → Video → Captions → Social Post
// This is the ONE endpoint to trigger the entire A-Z process
// NOW WITH COMPLIANCE CHECKING - validates marketing laws before video creation

import { NextRequest, NextResponse } from 'next/server';
import { scheduleVideoPost } from '@/lib/late-api'; // Switched from Metricool to Late
import { circuitBreakers, fetchWithTimeout, TIMEOUTS } from '@/lib/api-utils';
import { CompleteWorkflowRequestSchema, safeParse } from '@/lib/validation-schemas';
import { ERROR_MESSAGES } from '@/config/constants';
import { generateCaptionAndComment } from '@/lib/caption-intelligence';
import { validateAndFixScript } from '@/lib/compliance-checker';
import { Brand } from '@/config/constants';
import { selectAgent } from '@/lib/agent-selector';
import {
  buildCharacterConfig,
  buildVoiceConfig,
  buildBackgroundConfig,
  SCALE_PRESETS
} from '@/config/heygen-agents';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

// Import HeyGen client with cost tracking
import {
  generateHeyGenVideo as generateHeyGenVideoWithTracking,
  generateAvatarIVVideo,
  uploadHeyGenAsset
} from '@/lib/heygen-client';

export async function POST(request: NextRequest) {
  let workflowId: string | undefined; // Declare at function scope so catch block can access it
  let brand: Brand | undefined; // Declare at function scope so catch block can access it

  try {
    // Parse and validate request body
    const rawBody = await request.json();
    const validation = safeParse(CompleteWorkflowRequestSchema, rawBody);

    if (!validation.success) {
      const errors = 'errors' in validation ? validation.errors : ['Validation failed'];
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.MISSING_REQUIRED_FIELD,
          details: errors.join(', ')
        },
        { status: 400 }
      );
    }

    const body = validation.data;
    brand = body.brand;
    const platforms = body.platforms;
    const schedule = body.schedule;
    const resumeWorkflowId = body.workflowId;  // Optional: resume existing workflow

    console.log('🚀 Starting COMPLETE VIRAL VIDEO WORKFLOW');
    console.log(`   Brand: ${brand}`);
    console.log(`   Platforms: ${platforms.join(', ')}`);
    console.log(`   Schedule: ${schedule}`);
    if (resumeWorkflowId) {
      console.log(`   Resuming workflow: ${resumeWorkflowId}`);
    }

    // Step 1: Get article (either from existing workflow or from RSS feed)
    let article: any;

    if (resumeWorkflowId) {
      // RESUME MODE: Get article from existing workflow
      console.log('📰 Step 1: Fetching article from existing workflow...');
      const { getWorkflowById, getArticle } = await import('@/lib/feed-store-firestore');

      const workflowData = await getWorkflowById(resumeWorkflowId);
      if (!workflowData) {
        return NextResponse.json(
          { success: false, error: `Workflow not found: ${resumeWorkflowId}` },
          { status: 404 }
        );
      }

      // Override brand from workflow (workflow knows the correct brand)
      brand = workflowData.brand;

      // Get the article from the workflow's articleId
      const articleId = (workflowData.workflow as any).articleId;
      if (!articleId) {
        return NextResponse.json(
          { success: false, error: 'Workflow has no articleId' },
          { status: 400 }
        );
      }

      article = await getArticle(articleId, brand);
      if (!article) {
        return NextResponse.json(
          { success: false, error: `Article not found: ${articleId}` },
          { status: 404 }
        );
      }

      // Use the existing workflowId
      workflowId = resumeWorkflowId;

      console.log(`✅ Resuming workflow with article: ${article.title.substring(0, 50)}...`);
    } else {
      // NEW WORKFLOW MODE: Get and lock best article from feed
      console.log('📰 Step 1: Fetching and locking best article from RSS...');
      const { getAndLockArticle } = await import('@/lib/feed-store-firestore');
      article = await getAndLockArticle(brand as 'carz' | 'ownerfi');

      if (!article) {
        return NextResponse.json(
          { success: false, error: 'No articles available' },
          { status: 404 }
        );
      }

      console.log(`✅ Got and locked article: ${article.title.substring(0, 50)}...`);
    }

    // Validate article content exists and has sufficient length
    const contentLength = article.content?.trim().length || 0;

    if (contentLength === 0) {
      console.error(`❌ Article has ZERO content: ${article.title}`);
      console.error(`   Feed ID: ${article.feedId || 'unknown'}`);
      console.error(`   Link: ${article.link}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Article has no content - RSS feed may only provide headlines',
          details: `Content length: 0 chars. This feed (${article.feedId || 'unknown'}) likely needs to be replaced with one that provides full content.`
        },
        { status: 400 }
      );
    }

    if (contentLength < 200) {
      console.error(`❌ Article content too short (${contentLength} chars < 200 minimum): ${article.title}`);
      console.error(`   This would waste HeyGen credits on poor quality video.`);

      // Mark article as processed so it's not retried
      const { markArticleProcessed } = await import('@/lib/feed-store-firestore');
      await markArticleProcessed(article.id, brand as 'carz' | 'ownerfi', undefined, 'Content too short');

      return NextResponse.json({
        success: false,
        error: 'Article content too short for video generation',
        details: `Content length: ${contentLength} chars (minimum: 200 chars required)`,
        article_title: article.title
      }, { status: 400 });
    }

    // Add to workflow queue with 'pending' status (only if creating new workflow)
    if (article.id && !resumeWorkflowId) {
      const { addWorkflowToQueue } = await import('@/lib/feed-store-firestore');

      try {
        const queueItem = await addWorkflowToQueue(
          article.id,
          article.title,
          brand as 'carz' | 'ownerfi'
        );
        workflowId = queueItem.id;
        console.log(`📋 Added to workflow queue: ${workflowId}`);
      } catch (queueError) {
        // Handle duplicate workflow error gracefully
        if (queueError instanceof Error && queueError.message.includes('Duplicate workflow blocked')) {
          console.warn(`⚠️  ${queueError.message}`);
          return NextResponse.json({
            success: false,
            error: 'Duplicate workflow',
            message: queueError.message,
            article: { id: article.id, title: article.title }
          }, { status: 409 }); // 409 Conflict
        }
        throw queueError; // Re-throw other errors
      }
    }
    // If resuming, workflowId was already set in Step 1

    // Step 2: Generate viral script with OpenAI
    console.log('🤖 Step 2: Generating viral script...');
    const scriptContent = await generateViralContent(article.content, brand);
    console.log(`✅ Generated script: ${scriptContent.script.substring(0, 50)}...`);

    // Step 2b: Generate optimized caption + first comment using data-backed formula
    console.log('📝 Step 2b: Generating optimized caption and first comment...');
    let captionData;
    try {
      captionData = await generateCaptionAndComment({
        topic: article.title,
        brand: brand as 'ownerfi' | 'carz' | 'benefit' | 'abdullah' | 'personal' | 'gaza',
        script: scriptContent.script,
        platform: 'both' // Works for both YouTube and Instagram
      });
      console.log(`✅ Caption (${captionData.metadata.captionLength} chars): ${captionData.caption.substring(0, 80)}...`);
      console.log(`✅ First comment: ${captionData.firstComment.substring(0, 80)}...`);
    } catch (captionError) {
      console.warn(`⚠️  Caption generation failed (using fallback):`, captionError);
      // Use fallback caption - don't block the entire workflow
      captionData = {
        caption: `${article.title}\n\n#${brand}`,
        firstComment: 'What do you think?',
        metadata: { captionLength: article.title.length + brand.length + 4 }
      };
    }

    // Combine with script
    const content = {
      script: scriptContent.script,
      title: scriptContent.title,
      caption: captionData.caption,
      firstComment: captionData.firstComment
    };

    // Step 3: Generate HeyGen video with agent rotation
    console.log('🎥 Step 3: Creating HeyGen video with agent rotation...');

    // CRITICAL FIX: DON'T set status to heygen_processing yet
    // Will set it AFTER we get the video ID from HeyGen API
    // This prevents workflows from being stuck in heygen_processing without a video ID

    // Select agent for this video using round-robin rotation
    // All article brands (carz, ownerfi) share the same agent pool
    const agent = await selectAgent(brand as any, {
      mode: 'round-robin',
      language: 'en',
      // Don't require built-in background - we add background for talking photos via buildBackgroundConfig
    });

    // Build HeyGen request with webhook URL
    const { getBrandWebhookUrl } = await import('@/lib/brand-utils');
    const webhookUrl = getBrandWebhookUrl(brand as 'carz' | 'ownerfi', 'heygen');

    let heygenRequest: any;
    let agentId = 'legacy';

    let videoResult: { success: boolean; video_id?: string; error?: string };

    if (agent) {
      // Use agent system with proper scale and background
      console.log(`   🤖 Selected agent: ${agent.name} (${agent.id})`);
      console.log(`   🎭 Avatar: ${agent.avatar.avatarId.substring(0, 20)}...`);
      console.log(`   🗣️  Voice: ${agent.voice.voiceId.substring(0, 12)}...`);
      if (agent.voice.emotion) {
        console.log(`   😊 Emotion: ${agent.voice.emotion}`);
      }

      agentId = agent.id;

      // Check if Avatar IV is enabled for more expressive videos
      const useAvatarIV = agent.avatarIV?.enabled && agent.avatarIV?.photoUrl;

      if (useAvatarIV) {
        // Use Avatar IV API for expressive videos with gestures
        console.log(`   ✨ Using Avatar IV for expressive video with motion prompts`);
        console.log(`   🎬 Motion: ${agent.avatarIV!.motionPrompt?.substring(0, 50)}...`);

        // Upload photo to get image_key
        const uploadResult = await uploadHeyGenAsset(agent.avatarIV!.photoUrl, brand as Brand);

        if (uploadResult.success && uploadResult.image_key) {
          // Generate with Avatar IV API
          videoResult = await generateAvatarIVVideo(
            {
              image_key: uploadResult.image_key,
              script: content.script,
              voice_id: agent.voice.voiceId,
              voice_speed: agent.voice.speed || 1.1, // Use agent's speed setting
              custom_motion_prompt: agent.avatarIV!.motionPrompt,
              enhance_custom_motion_prompt: true,
              dimension: { width: 1080, height: 1920 },
              callback_id: workflowId,
              callback_url: webhookUrl,
            },
            brand as Brand,
            workflowId
          );

          if (videoResult.success) {
            console.log(`   ✅ Avatar IV video created successfully`);
          } else {
            console.warn(`   ⚠️ Avatar IV failed, falling back to V2 API: ${videoResult.error}`);
          }
        } else {
          console.warn(`   ⚠️ Photo upload failed, falling back to V2 API: ${uploadResult.error}`);
          videoResult = { success: false, error: uploadResult.error };
        }

        // Fall back to V2 if Avatar IV fails
        if (!videoResult.success) {
          console.log(`   🔄 Falling back to V2 API...`);
        }
      }

      // Use V2 API if Avatar IV not enabled or failed
      if (!useAvatarIV || !videoResult!.success) {
        // Build character config from agent (uses SCALE_PRESETS for proper sizing)
        const characterConfig = buildCharacterConfig(agent, 'vertical');

        // Build voice config from agent with the script (uses agent's speed setting)
        const voiceConfig = buildVoiceConfig(agent, content.script);

        // Build background config - uses brand-specific color
        // ALWAYS provide a background to avoid white backgrounds
        const backgroundConfig = buildBackgroundConfig(brand as Brand);

        // Build video input with background (always included to prevent white backgrounds)
        const videoInput: any = {
          character: characterConfig,
          voice: voiceConfig,
          background: backgroundConfig,
        };

        heygenRequest = {
          video_inputs: [videoInput],
          caption: false,
          dimension: { width: 1080, height: 1920 },
          test: false,
          webhook_url: webhookUrl,
          callback_id: workflowId
        };

        videoResult = await generateHeyGenVideoWithTracking(
          heygenRequest,
          brand as 'carz' | 'ownerfi',
          workflowId
        );
      }
    } else {
      // Fallback to legacy config if no agent available
      console.warn('⚠️  No agent available, using legacy config');

      // Legacy defaults with CORRECT scale (1.4 for talking photos in vertical videos)
      const defaultAvatarId = 'd33fe3abc2914faa88309c3bdb9f47f4';
      const defaultVoiceId = '9070a6c2dbd54c10bb111dc8c655bff7';

      heygenRequest = {
        video_inputs: [{
          character: {
            type: 'talking_photo',
            talking_photo_id: defaultAvatarId,
            scale: SCALE_PRESETS.vertical.talkingPhoto, // 1.4 - correct scale for vertical videos
          },
          voice: {
            type: 'text' as const,
            input_text: content.script,
            voice_id: defaultVoiceId,
            speed: 1.1
          },
          background: {
            type: 'color',
            value: '#1a1a2e'
          }
        }],
        caption: false,
        dimension: { width: 1080, height: 1920 },
        test: false,
        webhook_url: webhookUrl,
        callback_id: workflowId
      };

      videoResult = await generateHeyGenVideoWithTracking(
        heygenRequest,
        brand as 'carz' | 'ownerfi',
        workflowId
      );
    }

    if (!videoResult.success || !videoResult.video_id) {
      // Update workflow status to 'failed'
      if (workflowId) {
        const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
        await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
          status: 'failed',
          error: videoResult.error || 'HeyGen video generation failed'
        });
      }

      return NextResponse.json(
        { success: false, error: 'HeyGen video generation failed', details: videoResult.error },
        { status: 500 }
      );
    }

    console.log(`✅ HeyGen video ID: ${videoResult.video_id}`);
    console.log(`📋 Workflow ID: ${workflowId}`);
    console.log(`🎭 Agent used: ${agentId}`);

    // CRITICAL FIX: Update workflow with HeyGen video ID AND status atomically
    // This ensures we never have heygen_processing without a video ID
    if (workflowId) {
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
        heygenVideoId: videoResult.video_id,
        agentId,  // Track which agent was used for analytics
        status: 'heygen_processing',  // ✅ Set status HERE after getting video ID
        caption: content.caption,
        title: content.title
      } as any); // Store caption/title so webhooks can use them
    }

    // Check if we're in local development (webhooks won't work)
    // Only use synchronous polling if explicitly running in dev mode with npm run dev
    const isLocalDev = process.env.NODE_ENV === 'development' &&
                       !process.env.NEXT_PUBLIC_BASE_URL?.includes('ownerfi.ai');

    if (isLocalDev) {
      // LOCAL DEV: Use synchronous polling (webhooks won't reach localhost)
      console.log('⚠️  Running in LOCAL DEV mode - using polling instead of webhooks');
      console.log('⏳ Waiting for HeyGen completion (this will take ~10 minutes)...');

      const heygenUrl = await waitForHeyGenAndProcess(videoResult.video_id, workflowId, brand as 'carz' | 'ownerfi', content, platforms, schedule);

      return NextResponse.json({
        success: true,
        message: '✅ Local dev workflow completed',
        workflow_id: workflowId,
        brand,
        article: { title: article.title, link: article.link },
        content: { script: content.script, title: content.title, caption: content.caption },
        video: { heygen_video_id: videoResult.video_id, status: heygenUrl ? 'completed' : 'processing' }
      });
    }

    // PRODUCTION: Fire-and-forget with webhooks
    console.log('🎯 HeyGen video submitted successfully!');
    console.log('📡 Webhooks will handle:');
    console.log('   1. HeyGen completion → R2 upload → Submagic');
    console.log('   2. Submagic completion → R2 upload → Late posting');
    console.log('   3. Monitor progress at /admin/social-dashboard');

    return NextResponse.json({
      success: true,
      message: '🚀 Viral video workflow started! Webhooks will complete the process.',
      workflow_id: workflowId,
      brand,
      article: { title: article.title, link: article.link },
      content: { script: content.script, title: content.title, caption: content.caption },
      video: { heygen_video_id: videoResult.video_id, status: 'heygen_processing' },
      tracking: {
        workflow_id: workflowId,
        dashboard_url: `https://ownerfi.ai/admin/social-dashboard`,
        status_api: `/api/workflow/logs`
      },
      next_steps: [
        '⏳ HeyGen is generating the video (webhook will notify when complete)',
        '⏳ Submagic will add captions and effects (webhook will notify when complete)',
        '⏳ Video will auto-post to Late (Instagram, TikTok, YouTube, Facebook, LinkedIn, etc.)',
        '📊 Monitor progress in the admin dashboard'
      ]
    });

  } catch (error) {
    console.error('❌ Workflow error:', error);

    // Update workflow status to 'failed' if we have a workflowId
    if (workflowId && brand) {
      try {
        const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
        await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.log(`✅ Marked workflow ${workflowId} as failed`);
      } catch (updateError) {
        console.error(`❌ Failed to update workflow status:`, updateError);
      }
    } else {
      console.warn(`⚠️  Cannot mark workflow as failed - missing workflowId or brand`);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Workflow failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        workflow_id: workflowId
      },
      { status: 500 }
    );
  }
}

// Helper: Get best article from feed
async function getBestArticle(brand: string): Promise<{ id: string; title: string; content: string; source: string } | null> {
  // Import dynamically to avoid circular dependencies
  const { getUnprocessedArticles } = await import('@/lib/feed-store-firestore');

  // Get unprocessed articles for the brand
  const category = brand === 'carz' ? 'carz' : 'ownerfi';
  const articles = await getUnprocessedArticles(category as 'carz' | 'ownerfi', 10); // Get top 10 unprocessed

  if (articles.length === 0) {
    console.log(`⚠️ No unprocessed articles available for ${brand}`);
    return null;
  }

  // Simple ranking: prioritize newest articles
  // In production, you could add quality scoring, engagement prediction, etc.
  const bestArticle = articles[0];

  console.log(`📰 Selected article: "${bestArticle.title}"`);
  console.log(`   Published: ${new Date(bestArticle.pubDate).toLocaleString()}`);
  console.log(`   Feed: ${bestArticle.feedId}`);

  return {
    id: bestArticle.id,
    title: bestArticle.title,
    content: bestArticle.content || bestArticle.description,
    source: bestArticle.link
  };
}

// Helper: Sanitize user content to prevent prompt injection
// Brand-specific prompts
function getCarzPrompt(): string {
  return `You are a VIRAL CONTENT MACHINE for Carz Inc — wholesale cars with real-world deals for real people in Tennessee.
Your only mission: create 30-second reels that hit hard, feel local, and make people stop scrolling.

PRONUNCIATION GUIDE:
- Carz Inc = "Cars Incorporated" (spell Carz as C-A-R-Z)
- Always say "Carz Inc" clearly (not "Cars Inc")

PSYCHOLOGY & FLOW (Under 30 seconds / ~75 words):

[0-3 sec] SHOCK HOOK - Start with disbelief, emotion, or truth bomb:
"They're charging you more for that car just because you're from Jackson."
"This is how dealers make an extra $2,000 off you — every single time."

[3-10 sec] PAIN POINT - Call out the everyday frustration:
High payments, broken promises, bad credit, repo, etc. Make viewers feel seen.

[10-20 sec] SECRET OR HACK - Expose a hidden truth:
Show how smart buyers win ("wholesale not retail," "auction-lane play," "buy before recondition").

[20-27 sec] LOCAL PROOF - Mention Tennessee or real-life story:
"We just moved 20 cars in Memphis last week."

[27-30 sec] SOFT CTA - Finish with confidence, not sales:
"Follow Carz Inc to learn the game."
"If you're in Tennessee, this is your sign."

[30 sec] CALL TO ACTION (MANDATORY):
Always end every script with a short, natural call to action that sounds like a real person — not an ad.
Use one of these variations at random for freshness:
"Follow Carz Inc for daily updates."
"Follow Carz Inc to learn the real game."
"Follow Carz Inc — new updates every day."
"Follow Carz Inc and don't get played again."
"Follow Carz Inc to see what's really happening in Tennessee."
"Follow Carz Inc for more deals like this."
"Follow Carz Inc to stay ahead of the game."
Keep it under 8 words when possible. Never add extra hashtags or filler after it.

Then add one engagement question (rotate):
"Would you drive this or keep overpaying?"
"Would you buy wholesale if you could?"
"Is this worth trading in your car for?"

VOICE & TONE:
- Street-smart meets mechanic-real
- Confident, a little gritty, never corporate
- Feels like someone from the shop telling the truth over lunch
- Can mix simple Spanish words for bilingual flow ("bro, escucha esto…")

BANNED PHRASES:
❌ "Let me tell you..." ❌ "Today we're gonna talk about..." ❌ "Here at Carz Inc we offer..."

POWER TRIGGERS:
✅ FACT, TRUTH, EXPOSED, REAL GAME, HIDDEN HACK, JACKSON, MEMPHIS, NASHVILLE, TENNESSEE, WHOLESALE, NOBODY TELLS YOU

LEGAL GUARDRAILS:
- Never promise prices, approval, or specific payments
- Use examples only ("some buyers save…" / "for example…")
- Educational & informational only — no guarantees or offers

HOOK BANK (for random rotation):
"They're charging you more just because you're from Jackson."
"This is how dealers make an extra $2,000 off you."
"Most people in Tennessee don't know this wholesale trick."
"Stop paying retail when wholesale is right here."
"They don't want you knowing about auction-lane deals."

FORMAT:
SCRIPT: [Exact words spoken on camera, 70-90 words, no directions or stage notes]

TITLE: [Under 40 characters, 1 emoji max - Example: "🚗 Dealer Markup Exposed"]

CAPTION: [First line = Hook. Then 2-3 sentences teasing the truth. End with 3-5 hashtags: #CarzInc #JacksonTN #WholesaleCars #CarDeals #TennesseeRides]

EXAMPLE OUTPUT:
SCRIPT: "They're charging you more for that car just because you're from Jackson. Dealers add an extra $2,000 to $5,000 in markup — every single time. Here's the secret: buy wholesale, not retail. We just moved 20 cars in Memphis last week at auction prices. Follow Carz Inc to learn the real game. Would you drive this or keep overpaying?"

TITLE: 🚗 Dealer Markup in Tennessee?!

CAPTION: Dealers are adding thousands in markup just because they can. Smart buyers in Tennessee are going wholesale instead of retail. Follow to see how the game really works. #CarzInc #JacksonTN #WholesaleCars #CarDeals #TennesseeRides`;
}

function getOwnerFiPrompt(): string {
  return `You are a VIRAL CONTENT MACHINE for OwnerFi.ai — pronounced "Owner-Fy dot A Eye."
We help people discover real paths to homeownership WITHOUT traditional bank loans.

PRONUNCIATION GUIDE:
- OwnerFi = "Owner-Fy" (not "Owner-Fee")
- OwnerFi.ai = "Owner-Fy dot A Eye" (spell out A-I)

Your ONLY job: create scroll-stopping videos that make viewers watch till the end, feel understood, and take action.

SCRIPT PSYCHOLOGY:
- 0–3 sec → Pattern Interrupt: shock, bold claim, or emotional trigger
- 3–10 sec → Curiosity Gap: tease the hidden truth, myth, or mistake
- 10–30 sec → Value Bomb: deliver the insight — make it feel simple, obvious, empowering
- 30–40 sec → Proof or Perspective: social proof, quick example, or relatable logic
- 40–45 sec → CTA: soft close that invites curiosity or next step

VIRAL FORMULA: Hook → Conflict → Truth → Solution → Proof → Action

VOICE & TONE:
- Real talk. Street-smart. Human.
- Talk like you're explaining something to a friend who needs to hear it.
- No corporate tone, no jargon, no guarantees.
- Confident but grounded. Empathy > sales pitch.
- Legal-safe: never promise results or offer financial advice.

BANNED PHRASES:
❌ "Let me tell you..." ❌ "You know what's interesting..." ❌ "I want to share..." ❌ "Today I'm going to..." ❌ "Welcome back..."

POWER WORDS:
✅ FACT, NOBODY, ALWAYS, NEVER, SECRET, TRUTH, EXPOSED, HIDDEN, ACTUALLY, EXACTLY, LITERALLY

SCRIPT STRUCTURE (90-110 words / ≤ 45 seconds):

[0–3 sec] HOOK – Pattern interrupt
Example: "STOP scrolling — if you're renting, you're building someone else's dream."

[3–13 sec] PROBLEM – Make them feel it
Example: "Rent goes up every year, but your ownership stays at ZERO."

[13–33 sec] SOLUTION – Drop the truth bomb
Example: "There ARE properties being sold without banks involved — and most people never hear about them."

[33–43 sec] PROOF / PERSPECTIVE
Example: "Tens of thousands of families have already switched to creative financing instead of waiting for a bank's approval."

[43–45 sec] CTA – Soft close
Example: "Visit Owner-Fy dot A Eye to see what's possible in your city."

[45 sec] CALL TO ACTION (MANDATORY):
Always end every script with a short, natural call to action that sounds like a real person — not an ad.
Use one of these variations at random for freshness:
"Follow Owner-Fy for daily updates."
"Follow Owner-Fy to learn the real game."
"Follow Owner-Fy — new updates every day."
"Follow Owner-Fy and don't get played again."
"Follow Owner-Fy to see what's really happening."
"Follow Owner-Fy for more insights like this."
"Follow Owner-Fy to stay ahead of the game."
Keep it under 8 words when possible. Never add extra hashtags or filler after it.

PRONUNCIATION REMINDER: Always say "Owner-Fy" not "Owner-Fee" and "Owner-Fy dot A Eye" not "Owner-Fi dot AI"

RULES:
- Write ONLY what the person says directly to camera
- NO stage directions, NO camera directions, NO scene descriptions

CAPTION RULES:
- First line = HOOK (must stop scroll)
- 2–4 sentences MAX
- End with 3–5 hashtags
- Avoid emojis that cheapen tone — use only if they match energy

FORMAT:
SCRIPT: [exact words spoken on-camera]

TITLE: [under 50 characters, punchy, with 1 emoji MAX]

CAPTION: [2–4 sentences, emotional + CTA, end with 3–5 hashtags like #OwnerFi #HomeOwnership #NoBanks #RealEstate #FinancialFreedom]

EXAMPLE OUTPUT:
SCRIPT: "STOP scrolling — if you're renting, you're building someone else's dream. Rent goes up every year, but your ownership stays at ZERO. There ARE properties being sold without banks involved — and most people never hear about them. Tens of thousands of families have already switched to creative financing instead of waiting for a bank's approval. Visit Owner-Fy dot A Eye to see what's possible in your city. Follow Owner-Fy for daily updates."

TITLE: 🏠 Renting Forever? Read This

CAPTION: Rent keeps rising but your ownership stays at zero. There's a better way — owner financing lets you buy without traditional bank approval. Thousands are already doing it. See what's possible in your city. #OwnerFi #HomeOwnership #NoBanks #RealEstate #FinancialFreedom`;
}

function sanitizeContent(content: string): string {
  // Remove potentially malicious patterns
  let sanitized = content;

  // Remove common prompt injection patterns
  const suspiciousPatterns = [
    /ignore\s+previous\s+instructions/gi,
    /ignore\s+all\s+previous/gi,
    /disregard\s+previous/gi,
    /forget\s+previous/gi,
    /system\s*:\s*you\s+are/gi,
    /new\s+instructions/gi,
    /you\s+are\s+now/gi,
    /act\s+as\s+if/gi
  ];

  for (const pattern of suspiciousPatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
}

// Helper: Get template-specific variable prompts for OpenAI
function getTemplateVariablesPrompt(templateKey: string): string {
  const prompts: Record<string, string> = {
    CONTROVERSY_HOOK: `HOOK_QUESTION: Attention-grabbing question based on the article (10-20 words, must be a question)
SHOCKING_CLAIM: A controversial or shocking statement (10-15 words)
AUTHORITY_FIGURE: Who/what is being criticized (e.g., "dealerships", "real estate agents")
SECRET_1: First hidden truth (short sentence)
SECRET_2: Second hidden truth (short sentence)
SECRET_3: Third hidden truth (short sentence)
CTA: Call to action (5-10 words)
TOPIC: Main topic (2-3 words)`,

    VALUE_BOMB: `HOOK_QUESTION: Attention-grabbing question based on the article (10-20 words, must be a question)
BENEFIT: What the user will save/gain (e.g., "$1000", "hours of time")
NUMBER: How many tips (e.g., "3", "5")
INDUSTRY: Industry name (e.g., "car buying", "home buying")
TIP_1: First actionable tip (short sentence)
TIP_2: Second actionable tip (short sentence)
TIP_3: Third actionable tip (short sentence)
TOPIC: Main topic (2-3 words)`,

    STORYTELLING: `HOOK_QUESTION: Attention-grabbing question based on the article (10-20 words, must be a question)
DRAMATIC_EVENT: The dramatic event that happened (10-15 words)
MINI_STORY: Brief story in 2-3 sentences
KEY_TAKEAWAY: The lesson learned (10-15 words)
TOPIC: Main topic (2-3 words)`,

    QUESTION_HOOK: `HOOK_QUESTION: Attention-grabbing question based on the article (10-20 words, must be a question)
TARGET_AUDIENCE: Who is this for (e.g., "car buyers", "homeowners")
SURPRISING_BEHAVIOR: Unexpected behavior (5-10 words)
EXPLANATION: The answer/explanation (2-3 sentences)
TOPIC: Main topic (2-3 words)`,

    LISTICLE_TEASE: `HOOK_QUESTION: Attention-grabbing question based on the article (10-20 words, must be a question)
NUMBER: How many rules/items (e.g., "3", "5")
INDUSTRY: Industry name (e.g., "car buying", "real estate")
RULE_1: First rule (short sentence)
RULE_2: Second rule (short sentence)
RULE_3: Third rule (short sentence)
TOPIC: Main topic (2-3 words)`
  };

  return prompts[templateKey] || prompts.VALUE_BOMB; // Default to VALUE_BOMB
}

// Helper: Generate viral content with OpenAI
// NOW WITH COMPLIANCE CHECKING - validates marketing laws before returning script
async function generateViralContent(content: string, brand: string): Promise<{ script: string; title: string; caption: string }> {
  if (!OPENAI_API_KEY) {
    return {
      script: content.substring(0, 500),
      title: 'Viral Video',
      caption: '🔥 Check this out!'
    };
  }

  // Sanitize content to prevent prompt injection
  const sanitizedContent = sanitizeContent(content);

  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    // Add compliance warning on retries
    const complianceWarning = retryCount > 0
      ? `\n\n🚨 COMPLIANCE RETRY ${retryCount}/${maxRetries} - PREVIOUS ATTEMPT VIOLATED MARKETING LAWS\nYour last script violated compliance. CRITICAL FIXES NEEDED:\n- NO directive language (should/must/need to) - use "might/could/consider"\n- NO false claims (guaranteed/best/perfect) - use factual statements only\n- NO urgency tactics (act now/limited time) - focus on education\n- NO legal/financial advice - educational content only\n- Soft, consultative tone - not pushy or aggressive\n**If this retry fails, workflow will TERMINATE.**\n`
      : '';

    // Get brand-specific prompt
    let systemPrompt: string;
    if (brand === 'carz') {
      systemPrompt = getCarzPrompt() + complianceWarning;
    } else {
      systemPrompt = getOwnerFiPrompt() + complianceWarning;
    }

  const response = await circuitBreakers.openai.execute(async () => {
    return await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            { role: 'user', content: `Article:\n\n${sanitizedContent.substring(0, 2000)}` }
          ],
          temperature: 0.85,
          max_tokens: 800
        })
      },
      TIMEOUTS.OPENAI_API
    );
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0]) {
    console.error('❌ Invalid OpenAI response:', JSON.stringify(data));
    throw new Error('Invalid OpenAI API response - no choices returned');
  }

  // Track OpenAI cost
  const { trackCost } = await import('@/lib/cost-tracker');
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const totalTokens = data.usage?.total_tokens || 0;

  // GPT-4o-mini pricing: $0.15/1M input tokens, $0.60/1M output tokens
  const inputCost = (inputTokens / 1_000_000) * 0.15;
  const outputCost = (outputTokens / 1_000_000) * 0.60;
  const totalCost = inputCost + outputCost;

  await trackCost(
    brand as 'carz' | 'ownerfi',
    'openai',
    'script_generation',
    totalTokens,
    totalCost,
    undefined, // No workflowId at this stage
    {
      model: 'gpt-4o-mini',
      input_tokens: inputTokens,
      output_tokens: outputTokens
    }
  );

  console.log(`💰 OpenAI cost tracked: ${totalTokens} tokens = $${totalCost.toFixed(6)}`);

  const fullResponse = data.choices[0]?.message?.content?.trim() || '';

  console.log('🤖 OpenAI full response:', fullResponse);

  const scriptMatch = fullResponse.match(/SCRIPT:\s*([\s\S]*?)(?=TITLE:|CAPTION:|$)/i);
  const titleMatch = fullResponse.match(/TITLE:\s*([\s\S]*?)(?=CAPTION:|$)/i);
  const captionMatch = fullResponse.match(/CAPTION:\s*([\s\S]*?)$/i);

  // Extract and enforce title length limit (Submagic requires ≤50 chars)
  let title = titleMatch ? titleMatch[1].trim() : 'Breaking News - Must Watch!';

  // Decode HTML entities (like &#8217; → ') before measuring length
  title = title
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

  if (title.length > 50) {
    console.warn(`⚠️  Title too long (${title.length} chars), truncating to 50: "${title}"`);
    title = title.substring(0, 47) + '...'; // Truncate to 47 + '...' = 50
  }

  // Extract script and ensure it's never empty
  let script = scriptMatch ? scriptMatch[1].trim() : '';

  // If script is empty, use fallback content
  if (!script || script.length === 0) {
    console.warn('⚠️  OpenAI returned empty script, using fallback content');
    script = content.substring(0, 500);
  }

  // Validate script is not empty before returning
  if (!script || script.length === 0) {
    throw new Error('Failed to generate valid script - both OpenAI and fallback content are empty');
  }

  console.log(`✅ Generated script (${script.length} chars): ${script.substring(0, 100)}...`);

  // Extract caption directly from OpenAI response
  let caption: string;

  if (captionMatch) {
    caption = captionMatch[1].trim();
    console.log(`✅ Generated caption (${caption.length} chars): ${caption.substring(0, 100)}...`);
  } else {
    console.warn('⚠️  No CAPTION found in OpenAI response, using fallback caption');
    caption = `Dreaming of owning your first home but not sure where to start? You don't need perfect credit — you just need the right strategy. Owner financing can open the door to your future! #Homeownership #OwnerFi #RealEstate`;
  }

    // ==================== COMPLIANCE CHECK ====================
    console.log(`[Compliance] Checking article script for brand: ${brand} (attempt ${retryCount + 1}/${maxRetries})`);

    try {
      const complianceResult = await validateAndFixScript(
        script,
        caption,
        title,
        brand as Brand,
        1 // Single check, we handle retries here
      );

      // If passed compliance
      if (complianceResult.success) {
        console.log(`[Compliance] ✅ Article script passed compliance check`);

        return {
          script: complianceResult.finalScript,
          title: complianceResult.finalTitle,
          caption: complianceResult.finalCaption // Already has disclaimers appended
        };
      }

      // Failed compliance - retry
      retryCount++;

      const violations = complianceResult.complianceResult.violations
        .map(v => `${v.phrase} (${v.type})`)
        .join(', ');

      console.log(`[Compliance] ❌ Attempt ${retryCount}/${maxRetries} failed: ${violations}`);

      if (retryCount >= maxRetries) {
        throw new Error(
          `Compliance check failed after ${maxRetries} attempts for ${brand} article video. ` +
          `Violations: ${violations}`
        );
      }

      // Loop will retry with compliance warning added to system prompt

    } catch (complianceError) {
      // If compliance check itself failed (not just violations detected)
      if (retryCount >= maxRetries - 1) {
        console.error('[Compliance] Compliance check error after max retries:', complianceError);
        throw complianceError;
      }

      retryCount++;
      console.error(`[Compliance] Error on attempt ${retryCount}/${maxRetries}, retrying:`, complianceError);
    }
  }

  // Should never reach here
  throw new Error('Unexpected script generation loop exit');
}

// Helper: Generate HeyGen video
// Removed: Local generateHeyGenVideo function - now using heygen-client.ts with cost tracking

// LOCAL DEV ONLY: Poll HeyGen and process entire workflow synchronously
async function waitForHeyGenAndProcess(
  videoId: string,
  workflowId: string,
  brand: 'carz' | 'ownerfi',
  content: { script: string; title: string; caption: string; firstComment?: string },
  platforms: any[],
  schedule: string
): Promise<string | null> {
  const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');

  // Poll HeyGen for completion (max 14 attempts = 10.5 minutes)
  for (let attempt = 0; attempt < 14; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 45000));

    try {
      const response = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
        { headers: { 'accept': 'application/json', 'x-api-key': HEYGEN_API_KEY! } }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const status = data.data?.status;

      console.log(`⏳ HeyGen (${attempt + 1}/14): ${status}`);

      if (status === 'completed') {
        const heygenUrl = data.data.video_url;
        console.log('✅ HeyGen completed:', heygenUrl);

        // Upload to R2
        const { downloadAndUploadToR2 } = await import('@/lib/video-storage');
        const publicHeygenUrl = await downloadAndUploadToR2(
          heygenUrl,
          HEYGEN_API_KEY!,
          `heygen-videos/${videoId}.mp4`
        );

        // Submit to Submagic
        await updateWorkflowStatus(workflowId, brand, { status: 'submagic_processing' });

        const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
          method: 'POST',
          headers: { 'x-api-key': SUBMAGIC_API_KEY!, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: content.title,
            language: 'en',
            videoUrl: publicHeygenUrl,
            templateName: 'Hormozi 2',
            magicBrolls: true,
            magicBrollsPercentage: 50,
            magicZooms: true
          })
        });

        const submagicData = await submagicResponse.json();
        const projectId = submagicData.id || submagicData.project_id;

        // Track Submagic cost
        try {
          const { trackCost, calculateSubmagicCost } = await import('@/lib/cost-tracker');
          await trackCost(
            brand as any,
            'submagic',
            'caption_generation',
            1,
            calculateSubmagicCost(1),
            workflowId
          );
          console.log(`💰 Tracked Submagic cost: $0.25`);
        } catch (costError) {
          console.error(`⚠️  Failed to track Submagic cost:`, costError);
        }

        // Poll Submagic for completion (max 30 attempts = 22.5 minutes)
        console.log('⏳ Waiting for Submagic...');
        for (let i = 0; i < 30; i++) {
          await new Promise(resolve => setTimeout(resolve, 45000));

          const submagicStatus = await fetch(
            `https://api.submagic.co/v1/projects/${projectId}`,
            { headers: { 'x-api-key': SUBMAGIC_API_KEY! } }
          ).then(r => r.json());

          console.log(`⏳ Submagic (${i + 1}/30): ${submagicStatus.status}`);

          if (submagicStatus.status === 'completed' || submagicStatus.status === 'done') {
            const videoUrl = submagicStatus.media_url || submagicStatus.video_url;

            // Upload final video to R2
            const { uploadSubmagicVideo } = await import('@/lib/video-storage');
            const publicVideoUrl = await uploadSubmagicVideo(videoUrl);

            // Post to Late with optimized caption + first comment
            await updateWorkflowStatus(workflowId, brand, { status: 'posting' });

            const postResult = await scheduleVideoPost(
              publicVideoUrl,
              content.caption,
              content.title,
              platforms,
              schedule as 'immediate' | '1hour' | '2hours' | '4hours' | 'optimal',
              brand,
              content.firstComment // Include first comment for engagement boost
            );

            if (postResult.success) {
              await updateWorkflowStatus(workflowId, brand, {
                status: 'completed',
                latePostId: postResult.postId,
                completedAt: Date.now()
              });
              console.log('✅ Local dev workflow completed!');
            }

            return heygenUrl;
          }
        }
      }

      if (status === 'failed') return null;
    } catch (error) {
      console.error('Error in local dev polling:', error);
    }
  }

  return null;
}

// Helper: Enhance with Submagic (NOT USED - kept for reference only, webhooks handle completion)
async function enhanceWithSubmagic(params: {
  videoUrl: string;
  title: string;
  language: string;
  templateName: string;
}): Promise<{ success: boolean; project_id?: string; error?: string }> {
  try {
    // Get base URL for webhook callback
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                    'https://ownerfi.ai';

    const webhookUrl = `${baseUrl}/api/webhooks/submagic`;
    console.log(`📞 Submagic webhook URL: ${webhookUrl}`);

    const response = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: {
        'x-api-key': SUBMAGIC_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: params.title,
        language: params.language,
        videoUrl: params.videoUrl,
        templateName: params.templateName,
        magicBrolls: true,           // Add contextual B-roll footage
        magicBrollsPercentage: 50,   // 50% B-roll coverage
        magicZooms: true,            // Add dynamic zoom effects
        webhookUrl: webhookUrl       // ⭐ Webhook notification when complete (parameter is webhookUrl, not callbackUrl)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Submagic API error:', response.status, errorText);
      return { success: false, error: `API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    console.log('✅ Submagic response:', JSON.stringify(data, null, 2));
    return { success: true, project_id: data.id || data.project_id || data.projectId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

