import { NextRequest, NextResponse } from 'next/server';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface VideoGenerationRequest {
  rss_url?: string;
  article_content?: string;
  talking_photo_id?: string;
  voice_id?: string;
  scale?: number;
  width?: number;
  height?: number;
  auto_generate_script?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: VideoGenerationRequest = await request.json();

    // Validate API keys
    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: 'HeyGen API key not configured' },
        { status: 500 }
      );
    }

    // Step 1: Get content (from RSS or direct input)
    let content = body.article_content || '';

    if (body.rss_url && !content) {
      console.log('📰 Fetching RSS feed...');
      const rssContent = await fetchRSSFeed(body.rss_url);
      content = rssContent;
    }

    if (!content) {
      return NextResponse.json(
        { error: 'No content provided. Either article_content or rss_url is required' },
        { status: 400 }
      );
    }

    // Step 2: Generate script with OpenAI (if enabled)
    let script = content;

    if (body.auto_generate_script !== false && OPENAI_API_KEY) {
      console.log('🤖 Generating video script with OpenAI...');
      script = await generateScript(content);
      console.log('✅ Script generated:', script.substring(0, 100) + '...');
    }

    // Step 3: Generate HeyGen video
    console.log('🎬 Generating HeyGen video...');
    const videoResult = await generateHeyGenVideo({
      talking_photo_id: body.talking_photo_id || '31c6b2b6306b47a2ba3572a23be09dbc',
      voice_id: body.voice_id || '9070a6c2dbd54c10bb111dc8c655bff7',
      input_text: script,
      scale: body.scale || 1.4,
      width: body.width || 720,
      height: body.height || 1280
    });

    if (!videoResult.success) {
      return NextResponse.json(
        { error: 'Failed to generate video', details: videoResult.error },
        { status: 500 }
      );
    }

    const videoId = videoResult.video_id;
    console.log('✅ Video generation started:', videoId);

    // Step 4: Wait and check status
    console.log('⏳ Waiting for video to complete...');
    const videoUrl = await waitForVideoCompletion(videoId);

    if (!videoUrl) {
      return NextResponse.json(
        {
          success: false,
          message: 'Video generation timed out or failed',
          video_id: videoId,
          check_status_url: `/api/heygen/generate-video?video_id=${videoId}`
        },
        { status: 202 }
      );
    }

    // Success!
    return NextResponse.json({
      success: true,
      video_id: videoId,
      video_url: videoUrl,
      script: script,
      message: 'Video generated successfully'
    });

  } catch (error) {
    console.error('Error in automated video workflow:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Fetch RSS feed
async function fetchRSSFeed(rssUrl: string): Promise<string> {
  try {
    const response = await fetch(rssUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
    }

    const text = await response.text();

    // Simple RSS parsing - extract first article content
    // You might want to use a proper RSS parser library
    const contentMatch = text.match(/<description>(.*?)<\/description>/s);
    const titleMatch = text.match(/<title>(.*?)<\/title>/s);

    const title = titleMatch ? titleMatch[1] : '';
    const description = contentMatch ? contentMatch[1] : '';

    return `${title}\n\n${description}`.substring(0, 5000); // Limit length
  } catch (error) {
    console.error('Error fetching RSS:', error);
    throw new Error('Failed to fetch RSS feed');
  }
}

// Generate script with OpenAI
async function generateScript(content: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    return content.substring(0, 500); // Fallback: just truncate
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional video script writer. Convert the given article into a concise, engaging 30-45 second video script. Make it conversational and suitable for social media. Keep it under 100 words.'
          },
          {
            role: 'user',
            content: `Convert this article into a short video script:\n\n${content.substring(0, 2000)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return content.substring(0, 500); // Fallback
    }

    const data = await response.json();
    const script = data.choices[0]?.message?.content?.trim();

    return script || content.substring(0, 500);
  } catch (error) {
    console.error('Error generating script:', error);
    return content.substring(0, 500); // Fallback
  }
}

// Generate HeyGen video
async function generateHeyGenVideo(params: {
  talking_photo_id: string;
  voice_id: string;
  input_text: string;
  scale: number;
  width: number;
  height: number;
}): Promise<{ success: boolean; video_id?: string; error?: string }> {
  try {
    const response = await fetch('https://api.heygen.com/v2/video/generate', {
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
        test: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: JSON.stringify(errorData) };
    }

    const data = await response.json();
    return {
      success: true,
      video_id: data.data?.video_id || data.video_id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Wait for video completion
async function waitForVideoCompletion(videoId: string, maxAttempts: number = 20): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait 5 seconds between checks
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
      const response = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
        {
          headers: {
            'accept': 'application/json',
            'x-api-key': HEYGEN_API_KEY!,
          },
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const status = data.data?.status;

      console.log(`⏳ Video status (attempt ${attempt + 1}/${maxAttempts}):`, status);

      if (status === 'completed') {
        return data.data.video_url;
      }

      if (status === 'failed') {
        console.error('Video generation failed:', data.data?.error);
        return null;
      }
    } catch (error) {
      console.error('Error checking video status:', error);
    }
  }

  // Timeout
  console.log('⏰ Video generation timeout');
  return null;
}
