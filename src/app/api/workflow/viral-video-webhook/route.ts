import { NextRequest, NextResponse } from 'next/server';
import { createWorkflow } from '@/lib/workflow-store';
import { randomUUID } from 'crypto';
import {
  fetchWithTimeout,
  retry,
  TIMEOUTS,
  createErrorResponse,
  rateLimiters,
  checkRateLimit
} from '@/lib/api-utils';
import { validateViralVideoRequest, sanitizeHtml } from '@/lib/validation';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ViralVideoRequest {
  rss_url?: string;
  article_content?: string;
  talking_photo_id?: string;
  voice_id?: string;
  scale?: number;
  width?: number;
  height?: number;
  auto_generate_script?: boolean;
  submagic_template?: string;
  language?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = validateViralVideoRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid request',
          validation.errors.map(e => `${e.field}: ${e.message}`).join(', '),
          400
        ),
        { status: 400 }
      );
    }

    const validatedBody = validation.data!;

    // Validate API keys
    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        createErrorResponse('HeyGen API key not configured', undefined, 500),
        { status: 500 }
      );
    }

    console.log('🎬 Starting VIRAL VIDEO workflow (webhook-based)...');

    // Step 1: Get content (from RSS or direct input)
    let content = validatedBody.article_content ? sanitizeHtml(validatedBody.article_content) : '';

    if (validatedBody.rss_url && !content) {
      console.log('📰 Fetching RSS feed...');
      content = sanitizeHtml(await fetchRSSFeed(validatedBody.rss_url));
    }

    if (!content) {
      return NextResponse.json(
        createErrorResponse('No content could be extracted', undefined, 400),
        { status: 400 }
      );
    }

    // Step 2: Generate script, title, and caption with OpenAI (if enabled)
    let script = content;
    let title = 'Viral Video';
    let caption = '';
    let copyrightSafe = true;

    if (validatedBody.auto_generate_script && OPENAI_API_KEY) {
      console.log('🤖 Generating viral script, title, and caption with OpenAI...');
      const generated = await generateViralContent(content);
      script = generated.script;
      title = generated.title;
      caption = generated.caption;
      console.log('✅ Script, title, and caption generated');

      // Copyright safety check
      const { validateCopyrightSafety } = await import('@/lib/copyright-safety');
      const safetyCheck = validateCopyrightSafety(content, script);
      copyrightSafe = safetyCheck.safe;

      if (!safetyCheck.safe) {
        console.warn('⚠️ Copyright safety warning:', safetyCheck.issues);
        console.log('📋 Recommendations:', safetyCheck.recommendations);
      } else {
        console.log(`✅ Copyright safety: ${safetyCheck.score}/100`);
      }
    }

    // Step 3: Generate HeyGen video with webhook
    console.log('🎥 Generating HeyGen video with zoom...');

    const workflowId = randomUUID();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const videoResult = await generateHeyGenVideo({
      talking_photo_id: validatedBody.talking_photo_id || '31c6b2b6306b47a2ba3572a23be09dbc',
      voice_id: validatedBody.voice_id || '9070a6c2dbd54c10bb111dc8c655bff7',
      input_text: script,
      scale: validatedBody.scale || 1.4,
      width: validatedBody.width || 1080,
      height: validatedBody.height || 1920,
      callback_id: workflowId  // HeyGen will send this back in webhook
    });

    if (!videoResult.success) {
      return NextResponse.json(
        { error: 'Failed to generate video', details: videoResult.error },
        { status: 500 }
      );
    }

    const videoId = videoResult.video_id;
    console.log('✅ Video generation started:', videoId);

    // Create workflow in store
    createWorkflow(workflowId, {
      videoId: videoId!,
      script: script,
      title: title,
      caption: caption,
      status: 'heygen_pending'
    });

    // Register for polling backup (in case webhooks don't work)
    const { registerVideoForPolling } = await import('@/lib/video-status-poller');
    registerVideoForPolling(workflowId, videoId!);

    // Return immediately with workflow ID
    return NextResponse.json({
      success: true,
      message: 'Video generation started. Use workflow_id to check status.',
      workflow_id: workflowId,
      heygen_video_id: videoId,
      status_url: `${baseUrl}/api/workflow/viral-video-webhook/status?id=${workflowId}`,
      script: script,
      title: title,
      caption: caption
    });

  } catch (error) {
    console.error('Error in viral video workflow:', error);
    const errorDetails = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      createErrorResponse(
        'Failed to start viral video workflow',
        errorDetails,
        500
      ),
      { status: 500 }
    );
  }
}

// Fetch RSS feed with timeout and retry
async function fetchRSSFeed(rssUrl: string): Promise<string> {
  return retry(
    async () => {
      const response = await fetchWithTimeout(
        rssUrl,
        {},
        TIMEOUTS.RSS_FETCH
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
      }

      const text = await response.text();
    const contentMatch = text.match(/<description>(.*?)<\/description>/s);
    const titleMatch = text.match(/<title>(.*?)<\/title>/s);

    const title = titleMatch ? titleMatch[1] : '';
    const description = contentMatch ? contentMatch[1] : '';

      return `${title}\n\n${description}`.substring(0, 5000);
    },
    {
      maxAttempts: 3,
      backoff: 'exponential',
      onRetry: (attempt, error) => {
        console.log(`RSS fetch retry ${attempt}:`, error.message);
      }
    }
  ).catch(error => {
    console.error('Error fetching RSS after retries:', error);
    throw new Error('Failed to fetch RSS feed after multiple attempts');
  });
}

// Generate viral script, title, and caption with OpenAI
async function generateViralContent(content: string): Promise<{ script: string; title: string; caption: string }> {
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured, using fallback content');
    return {
      script: content.substring(0, 500),
      title: 'Viral Video',
      caption: content.substring(0, 150)
    };
  }

  // Check rate limit
  if (!checkRateLimit(rateLimiters.openai)) {
    console.warn('OpenAI rate limit reached, using fallback');
    return {
      script: content.substring(0, 500),
      title: 'Viral Video',
      caption: content.substring(0, 150)
    };
  }

  return retry(
    async () => {
      const response = await fetchWithTimeout(
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
            content: `You are a viral video content creator. You will generate THREE things:

1. SCRIPT: Take the following news article and turn it into a 45–60 second dramatic, high-energy script for a talking AI reel.

COPYRIGHT SAFETY RULES (CRITICAL - MUST FOLLOW):
- DO NOT copy or paraphrase the article text directly
- Extract ONLY the core FACTS (prices, dates, specs, events)
- Present facts in COMPLETELY NEW WORDS with your own structure
- Add ORIGINAL commentary and analysis (your perspective, not the article's)
- Start with "According to [Source Name]" to credit the source
- Transform the purpose: news article → your commentary & analysis
- Example: Instead of "The car features sleek design" → "This just dropped at $40K - here's why that's INSANE!"

Tone & Style Rules:
- READING LEVEL: 5th grade - use simple words, short sentences, clear ideas
- Avoid big words - say "use" not "utilize", "help" not "facilitate", "buy" not "purchase"
- Keep sentences under 15 words each
- Start with a bold, loud, emotional question or exclamation that grabs attention FAST
- Speak as if talking to a friend — urgent, surprised, excited, conversational
- Use short sentences, dramatic pacing, and tons of energy throughout
- Sprinkle in exclamation points, shocking statements, and urgent phrases like "You won't believe this!", "Here's the crazy part!", "This changes everything!"
- The script should sound natural for speech, not like an article or ad
- ALWAYS credit the source at the beginning: "According to [Source Name]..."
- Add YOUR OWN analysis: "Let me break this down...", "Here's what this means for YOU...", "The crazy part is..."
- End with a punchy one-liner takeaway that leaves viewers shocked, inspired, or ready to comment
- Length: 45–60 seconds when spoken fast and energetically

Example (5th grade level):
BAD: "The vehicle incorporates innovative technological features."
GOOD: "This car has cool new tech that you'll LOVE!"

BAD: "Homeowners should consider refinancing opportunities."
GOOD: "You could save $500 a month! Here's how!"

2. CAPTION: Create a short, punchy caption under 150 characters that makes people want to click/watch. Include relevant emojis.

3. TITLE: Create a YouTube Shorts title (under 100 characters) that's clickable and SEO-friendly.

OUTPUT FORMAT (MUST FOLLOW EXACTLY):
SCRIPT: [your script here]
CAPTION: [your caption here]
TITLE: [your title here]`
          },
          {
            role: 'user',
            content: `Article:\n\n${content.substring(0, 2000)}`
          }
        ],
        temperature: 0.7,  // Reduced for faster, more consistent generation
        max_tokens: 400    // Reduced for faster generation
      })
        },
        TIMEOUTS.OPENAI_GENERATE
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const fullResponse = data.choices[0]?.message?.content?.trim() || '';

      // Parse the response
      const scriptMatch = fullResponse.match(/SCRIPT:\s*([\s\S]*?)(?=CAPTION:|$)/i);
      const captionMatch = fullResponse.match(/CAPTION:\s*(.*?)(?=TITLE:|$)/i);
      const titleMatch = fullResponse.match(/TITLE:\s*(.*?)$/i);

      const script = scriptMatch ? scriptMatch[1].trim() : content.substring(0, 500);
      const caption = captionMatch ? captionMatch[1].trim() : content.substring(0, 150);
      const title = titleMatch ? titleMatch[1].trim() : 'Viral Video';

      return { script, title, caption };
    },
    {
      maxAttempts: 2,  // Only retry once for OpenAI
      backoff: 'exponential',
      onRetry: (attempt, error) => {
        console.log(`OpenAI retry ${attempt}:`, error.message);
      }
    }
  ).catch(error => {
    console.error('Error generating viral content after retries:', error);
    // Return fallback instead of throwing
    return {
      script: content.substring(0, 500),
      title: 'Viral Video',
      caption: content.substring(0, 150)
    };
  });
}

// Generate HeyGen video with callback_id for webhook tracking
async function generateHeyGenVideo(params: {
  talking_photo_id: string;
  voice_id: string;
  input_text: string;
  scale: number;
  width: number;
  height: number;
  callback_id: string;
}): Promise<{ success: boolean; video_id?: string; error?: string }> {
  // Check rate limit
  if (!checkRateLimit(rateLimiters.heygen)) {
    return {
      success: false,
      error: 'HeyGen rate limit exceeded. Please try again later.'
    };
  }

  return retry(
    async () => {
      const response = await fetchWithTimeout(
        'https://api.heygen.com/v2/video/generate',
        {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': HEYGEN_API_KEY!,
          },
      body: JSON.stringify({
        video_inputs: [
          {
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
          }
        ],
        caption: false,
        dimension: {
          width: params.width,
          height: params.height
        },
        test: false,
        callback_id: params.callback_id  // HeyGen sends this back in webhook
      })
        },
        TIMEOUTS.HEYGEN_SUBMIT
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HeyGen API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return {
        success: true,
        video_id: data.data?.video_id || data.video_id
      };
    },
    {
      maxAttempts: 3,
      backoff: 'exponential',
      onRetry: (attempt, error) => {
        console.log(`HeyGen retry ${attempt}:`, error.message);
      }
    }
  ).catch(error => {
    console.error('Error generating HeyGen video after retries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  });
}
