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
    const article = await getAndLockArticle(brand as 'carz' | 'ownerfi');

    if (!article) {
      return NextResponse.json(
        { success: false, error: 'No articles available' },
        { status: 404 }
      );
    }

    console.log(`✅ Got and locked article: ${article.title.substring(0, 50)}...`);

    // Add to workflow queue with 'pending' status
    let workflowId: string | undefined;
    if (article.id) {
      const { addWorkflowToQueue } = await import('@/lib/feed-store-firestore');
      const queueItem = await addWorkflowToQueue(article.id, article.title, brand as 'carz' | 'ownerfi');
      workflowId = queueItem.id;
      console.log(`📋 Added to workflow queue: ${workflowId}`);
    }

    // Step 2: Generate viral script + caption with OpenAI
    console.log('🤖 Step 2: Generating viral script and caption...');
    const content = await generateViralContent(article.content);
    console.log(`✅ Generated: ${content.script.substring(0, 50)}...`);

    // Step 3: Generate HeyGen video
    console.log('🎥 Step 3: Creating HeyGen video...');

    // Update workflow status to 'heygen_processing'
    if (workflowId) {
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
        status: 'heygen_processing'
      });
    }

    // NOTE: Both Carz and OwnerFi use the same "me" avatar for viral videos
    // The following avatars are available for PODCAST INTERVIEWEES only:
    // - Personal Trainer (Oxana Yoga): talking_photo_id '5eb1adac973c432f90e07a5807059d55'
    // - Real Estate Agent (Zelena): talking_photo_id 'c308729a2d444a09a98cb29baee73d88', voice 'c4313f9f0b214a7a8189c134736ce897'
    // - Doctor (Sofia): talking_photo_id '1732832799', voice '2e4de8a01f3b4e9c96794045e2f12779'
    // - Automotive Expert (Colton): talking_photo_id '711a1d390a2a4634b5b515d44a631ab3', voice 'dcc89bc2097f47bd93f0c9e8d5e53b5f'
    // - Technology Expert (Vince): talking_photo_id '1727676442', voice '219a23d690fc48c7b3a24ea4a0ac651a'
    // - Financial Advisor (Henry): talking_photo_id '1375223b2cc24ff0a21830fbf5cb45ba', voice '8c0bd8c49b2849dc96f8e89b8eace60'

    const videoResult = await generateHeyGenVideo({
      talking_photo_id: body.talking_photo_id || '31c6b2b6306b47a2ba3572a23be09dbc', // Default "me" avatar
      voice_id: body.voice_id || '9070a6c2dbd54c10bb111dc8c655bff7', // Default voice
      input_text: content.script,
      scale: 1.4,
      width: 1080,
      height: 1920,
      callback_id: workflowId // Pass workflow ID for webhook callback
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

    // Update workflow with HeyGen video ID and store caption/title/template for webhooks
    if (workflowId) {
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
        heygenVideoId: videoResult.video_id,
        caption: content.caption,
        title: content.title,
        captionTemplate: content.templateUsed // For A/B testing analysis
      } as any); // Store caption/title/template so webhooks can use them
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
    CONTROVERSY_HOOK: `SHOCKING_CLAIM: A controversial or shocking statement (10-15 words)
AUTHORITY_FIGURE: Who/what is being criticized (e.g., "dealerships", "real estate agents")
SECRET_1: First hidden truth (short sentence)
SECRET_2: Second hidden truth (short sentence)
SECRET_3: Third hidden truth (short sentence)
CTA: Call to action (5-10 words)
TOPIC: Main topic (2-3 words)`,

    VALUE_BOMB: `BENEFIT: What the user will save/gain (e.g., "$1000", "hours of time")
NUMBER: How many tips (e.g., "3", "5")
INDUSTRY: Industry name (e.g., "car buying", "home buying")
TIP_1: First actionable tip (short sentence)
TIP_2: Second actionable tip (short sentence)
TIP_3: Third actionable tip (short sentence)
TOPIC: Main topic (2-3 words)`,

    STORYTELLING: `DRAMATIC_EVENT: The dramatic event that happened (10-15 words)
MINI_STORY: Brief story in 2-3 sentences
KEY_TAKEAWAY: The lesson learned (10-15 words)
TOPIC: Main topic (2-3 words)`,

    QUESTION_HOOK: `TARGET_AUDIENCE: Who is this for (e.g., "car buyers", "homeowners")
SURPRISING_BEHAVIOR: Unexpected behavior (5-10 words)
EXPLANATION: The answer/explanation (2-3 sentences)
TOPIC: Main topic (2-3 words)`,

    LISTICLE_TEASE: `NUMBER: How many rules/items (e.g., "3", "5")
INDUSTRY: Industry name (e.g., "car buying", "real estate")
RULE_1: First rule (short sentence)
RULE_2: Second rule (short sentence)
RULE_3: Third rule (short sentence)
TOPIC: Main topic (2-3 words)`
  };

  return prompts[templateKey] || prompts.VALUE_BOMB; // Default to VALUE_BOMB
}

// Helper: Generate viral content with OpenAI
async function generateViralContent(content: string): Promise<{ script: string; title: string; caption: string; templateUsed?: string }> {
  if (!OPENAI_API_KEY) {
    return {
      script: content.substring(0, 500),
      title: 'Viral Video',
      caption: '🔥 Check this out!'
    };
  }

  // Import caption templates for A/B testing
  const { getRandomTemplate, generateCaption, CAPTION_TEMPLATES, getPlatformHashtags } = await import('@/lib/caption-templates');

  // Select random template for A/B testing
  const templateKey = getRandomTemplate();
  const template = CAPTION_TEMPLATES[templateKey];

  console.log(`🧪 A/B Test: Using "${template.name}" caption template`);
  console.log(`   Expected metrics: ${template.expectedMetrics.engagement} engagement, ${template.expectedMetrics.shares} shares`);

  // Sanitize content to prevent prompt injection
  const sanitizedContent = sanitizeContent(content);

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
              content: `You are a viral video script writer. Generate a single-person talking head video script and extract key content variables for social media.

IMPORTANT RULES:
- Write ONLY what the person says directly to camera - no scene descriptions, no cuts, no "[Opening shot]" directions
- MUST be under 45 seconds of continuous speech (approximately 90-110 words MAXIMUM)
- High energy, dramatic, attention-grabbing delivery
- Start with a hook that stops the scroll
- Use short punchy sentences
- Written in FIRST PERSON as if YOU are speaking to the audience
- NO stage directions, NO camera directions, NO scene descriptions

CAPTION RULES (CRITICAL):
- Keep CONTENT_VARIABLES extremely concise and short
- Each variable should be SHORT - captions will be truncated to 150 chars total INCLUDING hashtags
- Focus on punchy, impactful phrases, not long explanations
- Example: "Save $1000" NOT "You can potentially save up to one thousand dollars"

FORMAT:
SCRIPT: [the exact words the AI avatar will speak - nothing else]

TITLE: [30-45 characters MAXIMUM including emojis - MUST be under 50 chars - attention-grabbing headline]

CONTENT_VARIABLES: [Extract these variables from the article - KEEP EACH ONE SHORT AND PUNCHY]
${getTemplateVariablesPrompt(templateKey)}

EXAMPLE GOOD OUTPUT:
SCRIPT: "Listen up because what I'm about to tell you will change everything you know about car insurance..."

TITLE: 🚗 Dealerships Don't Want You to Know THIS

CONTENT_VARIABLES:
SHOCKING_CLAIM: Dealerships markup your insurance by 30%
AUTHORITY_FIGURE: dealerships
SECRET_1: They get kickbacks from insurers
SECRET_2: Marked up rates boost their profit
SECRET_3: You're paying 30% more than you should
CTA: Ask for a quote before signing
TOPIC: Car Insurance

EXAMPLE BAD SCRIPT:
"[Opening shot of person in office] Today we're going to talk about car insurance. [Cut to B-roll of cars]"`
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

  const scriptMatch = fullResponse.match(/SCRIPT:\s*([\s\S]*?)(?=TITLE:|CONTENT_VARIABLES:|$)/i);
  const titleMatch = fullResponse.match(/TITLE:\s*([\s\S]*?)(?=CONTENT_VARIABLES:|$)/i);
  const variablesMatch = fullResponse.match(/CONTENT_VARIABLES:\s*([\s\S]*?)$/i);

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

  // Parse content variables and generate caption from template
  let caption: string;
  const variables: Record<string, string> = {};

  if (variablesMatch) {
    const variablesText = variablesMatch[1].trim();
    const lines = variablesText.split('\n');

    for (const line of lines) {
      const match = line.match(/^([A-Z_]+):\s*(.+)$/);
      if (match) {
        variables[match[1]] = match[2].trim();
      }
    }

    console.log(`🧪 Extracted ${Object.keys(variables).length} template variables`);

    // Determine brand from content to generate platform-specific hashtags
    const brand = content.toLowerCase().includes('car') ? 'carz' : 'ownerfi';
    const topic = variables['TOPIC'] || 'Tips';

    // Generate hashtags separately (will be appended by Late API, not embedded in template)
    const hashtags = getPlatformHashtags(brand, 'instagram', topic);

    // Remove [HASHTAGS] placeholder from template or replace with empty string
    // Hashtags will be added by Late API at the END, not in the middle
    variables['HASHTAGS'] = ''; // Don't embed hashtags in template

    // Generate caption from template
    try {
      caption = generateCaption(templateKey, variables);

      // Remove any trailing whitespace and the empty hashtag line
      caption = caption.replace(/\n\n\s*$/g, '').trim();

      // Append hashtags at the END
      caption = `${caption}\n\n${hashtags}`;

      console.log(`✅ Generated caption from "${template.name}" template (${caption.length} chars)`);
      console.log(`   Hashtags: ${hashtags}`);
    } catch (error) {
      console.error('❌ Failed to generate caption from template:', error);
      // Fallback to default caption with hashtags
      caption = `Breaking news you need to see! 🔥\n\nThis changes everything. Click to watch the full story.\n\n${hashtags}`;
    }
  } else {
    console.warn('⚠️  No CONTENT_VARIABLES found in OpenAI response, using fallback caption');
    const brand = content.toLowerCase().includes('car') ? 'carz' : 'ownerfi';
    const fallbackHashtags = getPlatformHashtags(brand, 'instagram', 'BreakingNews');
    caption = `Breaking news you need to see! 🔥\n\nThis changes everything. Click to watch the full story.\n\n${fallbackHashtags}`;
  }

  return {
    script,
    title,
    caption,
    templateUsed: templateKey
  };
}

// Helper: Generate HeyGen video
async function generateHeyGenVideo(params: {
  talking_photo_id: string;
  voice_id: string;
  input_text: string;
  scale: number;
  width: number;
  height: number;
  callback_id?: string;
}): Promise<{ success: boolean; video_id?: string; error?: string }> {
  try {
    // Get base URL for webhook callback
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                    'https://ownerfi.ai';

    const webhookUrl = `${baseUrl}/api/webhooks/heygen`;
    console.log(`📞 HeyGen webhook URL: ${webhookUrl}`);

    const requestBody: any = {
      video_inputs: [{
        character: {
          type: 'talking_photo',
          talking_photo_id: params.talking_photo_id,
          scale: params.scale,
          talking_photo_style: 'square',
          talking_style: 'expressive'
        },
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

