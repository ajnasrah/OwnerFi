import { NextRequest, NextResponse } from 'next/server';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

interface ViralVideoRequest {
  rss_url?: string;
  article_content?: string;
  talking_photo_id?: string;
  voice_id?: string;
  scale?: number;
  width?: number;
  height?: number;
  auto_generate_script?: boolean;
  submagic_template?: string; // e.g., "Hormozi 2", "MrBeast", etc.
  language?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ViralVideoRequest = await request.json();

    // Validate API keys
    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: 'HeyGen API key not configured' },
        { status: 500 }
      );
    }

    if (!SUBMAGIC_API_KEY) {
      return NextResponse.json(
        { error: 'Submagic API key not configured' },
        { status: 500 }
      );
    }

    console.log('🎬 Starting VIRAL VIDEO workflow...');

    // Step 1: Get content (from RSS or direct input)
    let content = body.article_content || '';

    if (body.rss_url && !content) {
      console.log('📰 Fetching RSS feed...');
      content = await fetchRSSFeed(body.rss_url);
    }

    if (!content) {
      return NextResponse.json(
        { error: 'No content provided. Either article_content or rss_url is required' },
        { status: 400 }
      );
    }

    // Step 2: Generate script, title, and caption with OpenAI (if enabled)
    let script = content;
    let title = 'Viral Video';
    let caption = '';

    if (body.auto_generate_script !== false && OPENAI_API_KEY) {
      console.log('🤖 Generating viral script, title, and caption with OpenAI...');
      const generated = await generateViralContent(content);
      script = generated.script;
      title = generated.title;
      caption = generated.caption;
      console.log('✅ Script, title, and caption generated');
    }

    // Step 3: Generate HeyGen video with zoom
    console.log('🎥 Generating HeyGen video with zoom...');
    const videoResult = await generateHeyGenVideo({
      talking_photo_id: body.talking_photo_id || '31c6b2b6306b47a2ba3572a23be09dbc',
      voice_id: body.voice_id || '9070a6c2dbd54c10bb111dc8c655bff7',
      input_text: script,
      scale: body.scale || 1.4,
      width: body.width || 1080,
      height: body.height || 1920
    });

    if (!videoResult.success) {
      return NextResponse.json(
        { error: 'Failed to generate video', details: videoResult.error },
        { status: 500 }
      );
    }

    const videoId = videoResult.video_id;
    console.log('✅ Video generation started:', videoId);

    // Step 4: Wait for HeyGen video to complete
    console.log('⏳ Waiting for HeyGen video to complete...');
    const videoUrl = await waitForVideoCompletion(videoId, 10); // 10 attempts × 30s = 5 minutes

    if (!videoUrl) {
      return NextResponse.json(
        {
          success: false,
          message: 'HeyGen video generation timed out',
          video_id: videoId
        },
        { status: 202 }
      );
    }

    console.log('✅ HeyGen video completed:', videoUrl);

    // Step 5: Send to Submagic for viral enhancements
    console.log('✨ Sending to Submagic for captions, effects, and cuts...');
    const submagicResult = await enhanceWithSubmagic({
      videoUrl: videoUrl,
      title: `Viral Video - ${new Date().toISOString()}`,
      language: body.language || 'en',
      templateName: body.submagic_template || 'Hormozi 2'
    });

    if (!submagicResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Submagic enhancement failed',
          heygen_video_url: videoUrl,
          error: submagicResult.error
        },
        { status: 500 }
      );
    }

    console.log('✅ Submagic project created:', submagicResult.project_id);

    // Step 6: Wait for Submagic to complete
    console.log('⏳ Waiting for Submagic to complete enhancement...');
    const finalVideoUrl = await waitForSubmagicCompletion(submagicResult.project_id);

    if (!finalVideoUrl) {
      return NextResponse.json(
        {
          success: false,
          message: 'Submagic processing timed out',
          heygen_video_url: videoUrl,
          submagic_project_id: submagicResult.project_id,
          check_url: `https://app.submagic.co/projects/${submagicResult.project_id}`
        },
        { status: 202 }
      );
    }

    // Success! Return the final viral video
    return NextResponse.json({
      success: true,
      message: 'Viral video created successfully! 🎉',
      script: script,
      title: title,
      caption: caption,
      heygen_video_id: videoId,
      heygen_video_url: videoUrl,
      submagic_project_id: submagicResult.project_id,
      final_video_url: finalVideoUrl,
      submagic_editor_url: `https://app.submagic.co/projects/${submagicResult.project_id}`,
      features_applied: {
        ai_captions: true,
        sound_effects: true,
        dynamic_cuts: true,
        viral_template: body.submagic_template || 'Hormozi 2'
      }
    });

  } catch (error) {
    console.error('Error in viral video workflow:', error);
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
    const contentMatch = text.match(/<description>(.*?)<\/description>/s);
    const titleMatch = text.match(/<title>(.*?)<\/title>/s);

    const title = titleMatch ? titleMatch[1] : '';
    const description = contentMatch ? contentMatch[1] : '';

    return `${title}\n\n${description}`.substring(0, 5000);
  } catch (error) {
    console.error('Error fetching RSS:', error);
    throw new Error('Failed to fetch RSS feed');
  }
}

// Generate viral script, title, and caption with OpenAI
async function generateViralContent(content: string): Promise<{ script: string; title: string; caption: string }> {
  if (!OPENAI_API_KEY) {
    return {
      script: content.substring(0, 500),
      title: 'Viral Video',
      caption: content.substring(0, 150)
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

Tone & Style Rules:
- Start with a bold, loud, emotional question or exclamation that grabs attention FAST (like breaking news or a viral moment)
- Speak as if addressing the audience directly — urgent, surprised, intense, conversational
- Use short sentences, dramatic pacing, and tons of energy throughout
- Sprinkle in exclamation points, shocking statements, and urgent phrases like "You won't believe this!", "Here's the crazy part!", "This changes everything!"
- The script should sound natural for speech, not like an article or ad
- No sources, links, or citations
- End with a punchy one-liner takeaway that leaves viewers shocked, inspired, or ready to comment
- Length: 45–60 seconds when spoken fast and energetically

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
        temperature: 0.85,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return {
        script: content.substring(0, 500),
        title: 'Viral Video',
        caption: content.substring(0, 150)
      };
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

  } catch (error) {
    console.error('Error generating viral content:', error);
    return {
      script: content.substring(0, 500),
      title: 'Viral Video',
      caption: content.substring(0, 150)
    };
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

// Wait for HeyGen video completion
async function waitForVideoCompletion(videoId: string, maxAttempts: number = 10): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 30000)); // Check every 30 seconds

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

      console.log(`⏳ HeyGen status (${attempt + 1}/${maxAttempts}):`, status);

      if (status === 'completed') {
        console.log('🎉 HeyGen video completed! URL:', data.data.video_url);
        return data.data.video_url;
      }

      if (status === 'failed') {
        console.error('HeyGen video generation failed:', data.data?.error);
        return null;
      }
    } catch (error) {
      console.error('Error checking video status:', error);
    }
  }

  return null;
}

// Send video to Submagic for enhancement
async function enhanceWithSubmagic(params: {
  videoUrl: string;
  title: string;
  language: string;
  templateName: string;
}): Promise<{ success: boolean; project_id?: string; error?: string }> {
  try {
    console.log('📤 Sending to Submagic API...');

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
        templateName: params.templateName
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Submagic API error:', response.status, errorText);
      return { success: false, error: `API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    console.log('✅ Submagic response:', data);

    return {
      success: true,
      project_id: data.id || data.project_id || data.projectId
    };
  } catch (error) {
    console.error('Error calling Submagic API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Wait for Submagic to complete processing
async function waitForSubmagicCompletion(projectId: string, maxAttempts: number = 10): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 30000)); // Check every 30 seconds

    try {
      const response = await fetch(
        `https://api.submagic.co/v1/projects/${projectId}`,
        {
          headers: {
            'x-api-key': SUBMAGIC_API_KEY!,
          },
        }
      );

      if (!response.ok) {
        console.log(`⏳ Submagic not ready yet (${attempt + 1}/${maxAttempts})`);
        continue;
      }

      const data = await response.json();
      const status = data.status;

      console.log(`⏳ Submagic status (${attempt + 1}/${maxAttempts}):`, status);

      if (status === 'completed' || status === 'done' || status === 'ready') {
        return data.video_url || data.videoUrl || data.output_url;
      }

      if (status === 'failed' || status === 'error') {
        console.error('Submagic processing failed');
        return null;
      }
    } catch (error) {
      console.error('Error checking Submagic status:', error);
    }
  }

  return null;
}
