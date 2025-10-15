// Complete Viral Video Workflow: RSS → Script → Video → Captions → Social Post
// This is the ONE endpoint to trigger the entire A-Z process

import { NextRequest, NextResponse } from 'next/server';
import { scheduleVideoPost } from '@/lib/metricool-api';
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

    const videoResult = await generateHeyGenVideo({
      talking_photo_id: body.talking_photo_id || '31c6b2b6306b47a2ba3572a23be09dbc',
      voice_id: body.voice_id || '9070a6c2dbd54c10bb111dc8c655bff7',
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
    console.log('   2. Submagic completion → R2 upload → Metricool posting');
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
        '⏳ Video will auto-post to Metricool (Instagram, TikTok, YouTube)',
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

// Helper: Generate viral content with OpenAI
async function generateViralContent(content: string): Promise<{ script: string; title: string; caption: string }> {
  if (!OPENAI_API_KEY) {
    return {
      script: content.substring(0, 500),
      title: 'Viral Video',
      caption: '🔥 Check this out!'
    };
  }

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
              content: `You are a viral video script writer. Generate a single-person talking head video script.

IMPORTANT RULES:
- Write ONLY what the person says directly to camera - no scene descriptions, no cuts, no "[Opening shot]" directions
- MUST be under 45 seconds of continuous speech (approximately 90-110 words MAXIMUM)
- High energy, dramatic, attention-grabbing delivery
- Start with a hook that stops the scroll
- Use short punchy sentences
- Written in FIRST PERSON as if YOU are speaking to the audience
- NO stage directions, NO camera directions, NO scene descriptions

FORMAT:
SCRIPT: [the exact words the AI avatar will speak - nothing else]

TITLE: [30-45 characters MAXIMUM including emojis - MUST be under 50 chars - attention-grabbing headline]

CAPTION: [Engaging social media post with:
- Strong opening hook (1-2 sentences)
- Key value points (2-3 bullets or short sentences)
- Call to action
- 3-5 relevant hashtags at the end
- Use emojis strategically
- STRICT LIMIT: 280 characters maximum (including hashtags and emojis)
- Keep it concise and punchy!]

EXAMPLE GOOD OUTPUT:
SCRIPT: "Listen up because what I'm about to tell you will change everything you know about car insurance..."

TITLE: 🚗 Dealerships Don't Want You to Know THIS About Insurance!

CAPTION: Dealerships hide 3 ways they profit when you finance 👀 Marked up rates, warranty kickbacks, and insurance cuts. Don't get played! 💰

#CarInsurance #DealershipSecrets #FinanceTips #SaveMoney

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

  const scriptMatch = fullResponse.match(/SCRIPT:\s*([\s\S]*?)(?=TITLE:|CAPTION:|$)/i);
  const titleMatch = fullResponse.match(/TITLE:\s*([\s\S]*?)(?=CAPTION:|$)/i);
  const captionMatch = fullResponse.match(/CAPTION:\s*([\s\S]*?)$/i);

  // Extract and enforce title length limit (Submagic requires ≤50 chars)
  let title = titleMatch ? titleMatch[1].trim() : 'Breaking News - Must Watch!';
  if (title.length > 50) {
    console.warn(`⚠️  Title too long (${title.length} chars), truncating to 50: "${title}"`);
    title = title.substring(0, 47) + '...'; // Truncate to 47 + '...' = 50
  }

  return {
    script: scriptMatch ? scriptMatch[1].trim() : content.substring(0, 500),
    title,
    caption: captionMatch ? captionMatch[1].trim() : 'Breaking news you need to see! 🔥\n\nThis changes everything. Click to watch the full story.\n\n#BreakingNews #MustWatch #Viral #Trending'
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

            // Post to Metricool
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
                metricoolPostId: postResult.postId,
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

