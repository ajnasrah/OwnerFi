// Complete Viral Video Workflow: RSS → Script → Video → Captions → Social Post
// This is the ONE endpoint to trigger the entire A-Z process

import { NextRequest, NextResponse } from 'next/server';
import { scheduleVideoPost } from '@/lib/late-api'; // Switched from Metricool to Late
import { circuitBreakers, fetchWithTimeout, TIMEOUTS } from '@/lib/api-utils';
import { CompleteWorkflowRequestSchema, safeParse } from '@/lib/validation-schemas';
import { ERROR_MESSAGES } from '@/config/constants';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const rawBody = await request.json();
    const validation = safeParse(CompleteWorkflowRequestSchema, rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.MISSING_REQUIRED_FIELD,
          details: validation.errors.join(', ')
        },
        { status: 400 }
      );
    }

    const body = validation.data;
    const brand = body.brand;
    const platforms = body.platforms;
    const schedule = body.schedule;

    console.log('🚀 Starting COMPLETE VIRAL VIDEO WORKFLOW');
    console.log(`   Brand: ${brand}`);
    console.log(`   Platforms: ${platforms.join(', ')}`);
    console.log(`   Schedule: ${schedule}`);

    // Step 1: Get and lock best article from feed (prevents race conditions)
    console.log('📰 Step 1: Fetching and locking best article from RSS...');
    const { getAndLockArticle } = await import('@/lib/feed-store-firestore');
    const article = await getAndLockArticle(brand as 'carz' | 'ownerfi' | 'vassdistro');

    if (!article) {
      return NextResponse.json(
        { success: false, error: 'No articles available' },
        { status: 404 }
      );
    }

    console.log(`✅ Got and locked article: ${article.title.substring(0, 50)}...`);

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
      console.warn(`⚠️  Article has short content (${contentLength} chars): ${article.title}`);
      console.warn(`   This may not generate a good video. Consider using feeds with longer articles.`);
      // Allow it to proceed for now, but log the warning
    }

    // Add to workflow queue with 'pending' status
    let workflowId: string | undefined;
    if (article.id) {
      const { addWorkflowToQueue } = await import('@/lib/feed-store-firestore');
      const queueItem = await addWorkflowToQueue(article.id, article.title, brand as 'carz' | 'ownerfi' | 'vassdistro');
      workflowId = queueItem.id;
      console.log(`📋 Added to workflow queue: ${workflowId}`);
    }

    // Step 2: Generate viral script + caption with OpenAI
    console.log('🤖 Step 2: Generating viral script and caption...');
    const content = await generateViralContent(article.content, brand);
    console.log(`✅ Generated: ${content.script.substring(0, 50)}...`);

    // Step 3: Generate HeyGen video
    console.log('🎥 Step 3: Creating HeyGen video...');

    // Update workflow status to 'heygen_processing'
    if (workflowId) {
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi' | 'vassdistro', {
        status: 'heygen_processing'
      });
    }

    // NOTE: Avatar and voice configuration by brand:
    // - Carz & OwnerFi: Default "me" avatar (31c6b2b6306b47a2ba3572a23be09dbc)
    // - Vass Distro: Custom avatar (feec83b62d9e48478a988eec5730154c), voice (d2f4f24783d04e22ab49ee8fdc3715e0)
    // The following avatars are available for PODCAST INTERVIEWEES only:
    // - Personal Trainer (Oxana Yoga): talking_photo_id '5eb1adac973c432f90e07a5807059d55'
    // - Real Estate Agent (Zelena): talking_photo_id 'c308729a2d444a09a98cb29baee73d88', voice 'c4313f9f0b214a7a8189c134736ce897'
    // - Doctor (Sofia): talking_photo_id '1732832799', voice '2e4de8a01f3b4e9c96794045e2f12779'
    // - Automotive Expert (Colton): talking_photo_id '711a1d390a2a4634b5b515d44a631ab3', voice 'dcc89bc2097f47bd93f0c9e8d5e53b5f'
    // - Technology Expert (Vince): talking_photo_id '1727676442', voice '219a23d690fc48c7b3a24ea4a0ac651a'
    // - Financial Advisor (Henry): talking_photo_id '1375223b2cc24ff0a21830fbf5cb45ba', voice '8c0bd8c49b2849dc96f8e89b8eace60'

    // Get brand-specific avatar and voice defaults
    let defaultAvatarId = 'd33fe3abc2914faa88309c3bdb9f47f4'; // Abdullah motion-enabled avatar for Carz/OwnerFi/Benefit/Property/Podcast
    let defaultVoiceId = '9070a6c2dbd54c10bb111dc8c655bff7'; // Default voice
    let avatarType: 'avatar' | 'talking_photo' = 'talking_photo'; // Motion-enabled avatar is talking_photo type

    if (brand === 'vassdistro') {
      defaultAvatarId = '6764a52c1b734750a0fba6ab6caa9cd9'; // VassDistro motion-enabled avatar
      defaultVoiceId = '9070a6c2dbd54c10bb111dc8c655bff7'; // Use same voice as other brands
      avatarType = 'talking_photo'; // VassDistro uses talking_photo (motion-enabled)
    }

    const videoResult = await generateHeyGenVideo({
      avatar_id: body.avatar_id || defaultAvatarId,
      avatar_type: avatarType,
      voice_id: body.voice_id || defaultVoiceId,
      input_text: content.script,
      scale: 1.0,
      width: 1080,
      height: 1920,
      callback_id: workflowId, // Pass workflow ID for webhook callback
      brand: brand as 'carz' | 'ownerfi' | 'vassdistro' // Pass brand for brand-specific webhook
    });

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

    // Update workflow with HeyGen video ID and store caption/title for webhooks
    if (workflowId) {
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
        heygenVideoId: videoResult.video_id,
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
        article: { title: article.title, source: article.source },
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
      article: { title: article.title, source: article.source },
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
    // Note: workflowId may not be in scope here, so we'll need to handle this differently

    return NextResponse.json(
      {
        success: false,
        error: 'Workflow failed',
        details: error instanceof Error ? error.message : 'Unknown error'
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
function getVassDistroPrompt(): string {
  return `You are a VIRAL CONTENT MACHINE for Vass Distro — we help vape shop owners find the best wholesale deals, stay ahead of market changes, and protect their profits.

Your ONLY job: Create fast-paced, scroll-stopping videos (under 30 seconds) that make vape business owners go, "Wait… what?"

AUDIENCE:
Independent vape shop owners, distributors, wholesalers — people who care about:
• Margins & profit per SKU
• Regulation updates
• New products & brand drops
• Supplier advantages
• Retail growth hacks

SCRIPT PSYCHOLOGY:
- First 2 seconds: Pattern interrupt (bold claim or shock)
- Next 8 seconds: Curiosity gap (the insider hook)
- Next 15 seconds: Value bomb (news + takeaway)
- Final 5 seconds: Soft call-to-action

VIRAL FORMULA: Hook → Pain → Truth → Proof → Action

VOICE & TONE:
- Raw. Real. Street-smart.
- Talking shop owner to shop owner.
- No fluff, no corporate talk, no scripts.
- Think: "insider sharing a secret over coffee."

BANNED PHRASES:
❌ "Let me tell you…"
❌ "Today I'm going to…"
❌ "Welcome back…"
❌ "If you think about it…"

POWER WORDS (use these):
✅ FACT, SECRET, TRUTH, EXPOSED, HIDDEN, WHOLESALE, PROFIT, MARGIN, REAL, REGULATION, UPDATE, DROP, TREND, DEALER

SCRIPT STRUCTURE (30 seconds max / ≈ 70–80 words):

[0–2 sec] HOOK: Pattern interrupt
"Vape shops are losing 20% margins — here's why."
"This new regulation just flipped the wholesale game."

[2–10 sec] PAIN / CURIOSITY: Build tension
"Most stores are stuck with bad distributors and don't even know it."

[10–25 sec] VALUE BOMB / PROOF: Drop the insight from the RSS article
"The truth: distributors are cutting prices to clear inventory before Q4 — smart shops are stacking now."

[25–30 sec] CTA:
"Follow Vass Distro for insider wholesale updates that keep you profitable."

RULES:
- Write ONLY what the person says directly to camera - no scene descriptions, no cuts, no directions
- Written as a CONTENT CREATOR sharing insights - NOT impersonating the article's author
- NO stage directions, NO camera directions, NO scene descriptions

CAPTION RULES:
- First line: Hook that matches video
- 2 sentences max + 1 takeaway line
- Conversational & confident
- End with 3–5 hashtags
Example: #VapeWholesale #B2BDeals #VapeIndustry #VapeShops #ProfitHack

RSS ARTICLE USAGE:
Use the provided RSS article summary as your source.
Pull ONE key insight or stat and reframe it as an insider secret or alert for vape business owners.
Never quote directly; paraphrase naturally with authority.

FORMAT:
SCRIPT: [the exact words the AI avatar will speak - nothing else]

TITLE: [30-40 characters MAXIMUM including emojis - MUST be under 50 chars - attention-grabbing headline]

CAPTION: [2-3 sentences + 3-5 hashtags at the end]

EXAMPLE OUTPUT:
SCRIPT: "Vape shops are bleeding margins right now. The FDA just approved three new brands, but most wholesalers aren't telling you which ones have the best profit potential. Here's what the smart shops know: Brand X is dropping next week with 40% margins. Stock up now before everyone catches on. Follow Vass Distro for the insider edge."

TITLE: 💨 New FDA Approvals = Profit 📈

CAPTION: New FDA approvals just dropped and most vape shops are missing the profit window. Smart owners are already stocking up on the high-margin winners. Stay ahead of the game. #VapeWholesale #VapeIndustry #B2BDeals #VapeShops #ProfitMargins`;
}

function getOwnerFiPrompt(): string {
  return `You are a VIRAL CONTENT MACHINE for OwnerFi - we help people become homeowners WITHOUT traditional bank loans.

Your ONLY job: Create scroll-stopping videos that make people watch till the end.

SCRIPT PSYCHOLOGY:
- First 3 seconds = Pattern interrupt (shock, controversy, bold claim)
- Next 10 seconds = Curiosity gap (tease the secret/hack/truth)
- Middle 20 seconds = Value bomb (the actual insight)
- Last 10 seconds = Call to action (soft, not salesy)

VIRAL FORMULA: Hook → Conflict → Solution → Proof → Action

VOICE & TONE:
- Raw, authentic, real talk - like telling your best friend a secret
- No corporate BS, no sales pitch
- Confident but not arrogant
- Street smart meets industry insider

BANNED PHRASES:
❌ "Let me tell you..." ❌ "You know what's interesting..." ❌ "I want to share..." ❌ "Today I'm going to..." ❌ "Welcome back..."

POWER WORDS (use these):
✅ FACT, NOBODY, ALWAYS, NEVER, SECRET, TRUTH, EXPOSED, HIDDEN, ACTUALLY, EXACTLY, LITERALLY

SCRIPT STRUCTURE (90-110 words, 45 seconds max):

[0-3 sec] HOOK - Pattern interrupt:
"STOP. If you're paying rent, you're being played."
"Banks don't want you to know this..."

[3-13 sec] PROBLEM - Make them feel it:
Show the pain point, build tension

[13-33 sec] SOLUTION - Value bomb:
Drop the knowledge, simple and actionable

[33-43 sec] PROOF - Quick validation:
Social proof/stats

[43-45 sec] CTA - Soft close:
"Check ownerfi.ai" or "Follow for more"

RULES:
- Write ONLY what the person says directly to camera
- NO stage directions, NO camera directions, NO scene descriptions

CAPTION RULES:
- First line = Hook
- 2-3 sentences MAXIMUM
- End with 3-5 hashtags

FORMAT:
SCRIPT: [the exact words the AI avatar will speak]

TITLE: [30-45 characters MAXIMUM including emojis - MUST be under 50 chars]

CAPTION: [2-4 sentence ready-to-post caption with 3-5 hashtags]`;
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

  // Get brand-specific prompt
  const systemPrompt = brand === 'vassdistro'
    ? getVassDistroPrompt()
    : getOwnerFiPrompt();

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

  return {
    script,
    title,
    caption
  };
}

// Helper: Generate HeyGen video
async function generateHeyGenVideo(params: {
  avatar_id: string;
  avatar_type: 'avatar' | 'talking_photo';
  voice_id: string;
  input_text: string;
  scale: number;
  width: number;
  height: number;
  callback_id?: string;
  brand?: 'carz' | 'ownerfi' | 'vassdistro';
}): Promise<{ success: boolean; video_id?: string; error?: string }> {
  try {
    // Use brand-specific webhook URL from configuration
    const { getBrandWebhookUrl } = await import('@/lib/brand-utils');
    const brand = params.brand || 'ownerfi'; // Default to ownerfi for backwards compatibility
    const webhookUrl = getBrandWebhookUrl(brand, 'heygen');
    console.log(`📞 HeyGen webhook URL (${brand}): ${webhookUrl}`);

    // Build character based on avatar type
    console.log(`🎭 Avatar Config for ${brand}:`, {
      avatar_id: params.avatar_id,
      avatar_type: params.avatar_type,
      voice_id: params.voice_id
    });

    const character: any = {
      type: params.avatar_type,
      scale: params.scale
    };

    if (params.avatar_type === 'avatar') {
      character.avatar_id = params.avatar_id;
      character.avatar_style = 'normal';
    } else {
      character.talking_photo_id = params.avatar_id;
      character.talking_style = 'expressive';
      character.matting = true; // Remove background
    }

    console.log(`📹 HeyGen Character Object:`, JSON.stringify(character, null, 2));

    const requestBody: any = {
      video_inputs: [{
        character,
        voice: {
          type: 'text',
          input_text: params.input_text,
          voice_id: params.voice_id,
          speed: 1.1
        }
      }],
      caption: false,
      dimension: { width: params.width, height: params.height },
      test: false
    };

    // Add webhook callback if callback_id provided
    if (params.callback_id) {
      requestBody.webhook_url = webhookUrl;
      requestBody.callback_id = params.callback_id;
    }

    // Use circuit breaker to prevent cascading failures
    return await circuitBreakers.heygen.execute(async () => {
      const response = await fetchWithTimeout(
        'https://api.heygen.com/v2/video/generate',
        {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': HEYGEN_API_KEY!,
          },
          body: JSON.stringify(requestBody)
        },
        TIMEOUTS.HEYGEN_API
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HeyGen API error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return { success: true, video_id: data.data?.video_id || data.video_id };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// LOCAL DEV ONLY: Poll HeyGen and process entire workflow synchronously
async function waitForHeyGenAndProcess(
  videoId: string,
  workflowId: string,
  brand: 'carz' | 'ownerfi',
  content: { script: string; title: string; caption: string },
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

            // Post to Late
            await updateWorkflowStatus(workflowId, brand, { status: 'posting' });

            const postResult = await scheduleVideoPost(
              publicVideoUrl,
              content.caption,
              content.title,
              platforms,
              schedule,
              brand
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

