// Complete Viral Video Workflow: RSS → Script → Video → Captions → Social Post
// This is the ONE endpoint to trigger the entire A-Z process

import { NextRequest, NextResponse } from 'next/server';
import { scheduleVideoPost } from '@/lib/metricool-api';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

interface CompleteWorkflowRequest {
  brand: 'carz' | 'ownerfi';
  platforms?: ('instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'threads')[];
  schedule?: 'immediate' | '1hour' | '2hours' | '4hours' | 'optimal';
  talking_photo_id?: string;
  voice_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CompleteWorkflowRequest = await request.json();
    const brand = body.brand || 'ownerfi';
    const platforms = body.platforms || ['instagram', 'tiktok', 'youtube'];
    const schedule = body.schedule || 'immediate';

    console.log('🚀 Starting COMPLETE VIRAL VIDEO WORKFLOW');
    console.log(`   Brand: ${brand}`);
    console.log(`   Platforms: ${platforms.join(', ')}`);
    console.log(`   Schedule: ${schedule}`);

    // Step 1: Get best article from feed
    console.log('📰 Step 1: Fetching best article from RSS...');
    const article = await getBestArticle(brand);

    if (!article) {
      return NextResponse.json(
        { success: false, error: 'No articles available' },
        { status: 404 }
      );
    }

    console.log(`✅ Got article: ${article.title.substring(0, 50)}...`);

    // Step 2: Generate viral script + caption with OpenAI
    console.log('🤖 Step 2: Generating viral script and caption...');
    const content = await generateViralContent(article.content);
    console.log(`✅ Generated: ${content.script.substring(0, 50)}...`);

    // Step 3: Generate HeyGen video
    console.log('🎥 Step 3: Creating HeyGen video...');
    const videoResult = await generateHeyGenVideo({
      talking_photo_id: body.talking_photo_id || '31c6b2b6306b47a2ba3572a23be09dbc',
      voice_id: body.voice_id || '9070a6c2dbd54c10bb111dc8c655bff7',
      input_text: content.script,
      scale: 1.4,
      width: 1080,
      height: 1920
    });

    if (!videoResult.success || !videoResult.video_id) {
      return NextResponse.json(
        { success: false, error: 'HeyGen video generation failed', details: videoResult.error },
        { status: 500 }
      );
    }

    console.log(`✅ HeyGen video ID: ${videoResult.video_id}`);

    // Step 4: Wait for HeyGen completion
    console.log('⏳ Step 4: Waiting for HeyGen video...');
    const heygenUrl = await waitForVideoCompletion(videoResult.video_id, 10);

    if (!heygenUrl) {
      return NextResponse.json(
        { success: false, error: 'HeyGen video timed out', video_id: videoResult.video_id },
        { status: 202 }
      );
    }

    console.log(`✅ HeyGen completed: ${heygenUrl}`);

    // Step 5: Enhance with Submagic
    console.log('✨ Step 5: Adding Submagic captions and effects...');
    const submagicResult = await enhanceWithSubmagic({
      videoUrl: heygenUrl,
      title: content.title,
      language: 'en',
      templateName: 'Hormozi 2'
    });

    if (!submagicResult.success || !submagicResult.project_id) {
      return NextResponse.json(
        { success: false, error: 'Submagic enhancement failed', heygen_url: heygenUrl },
        { status: 500 }
      );
    }

    console.log(`✅ Submagic project: ${submagicResult.project_id}`);

    // Step 6: Wait for Submagic completion
    console.log('⏳ Step 6: Waiting for Submagic enhancement...');
    const finalVideoUrl = await waitForSubmagicCompletion(submagicResult.project_id, 10);

    if (!finalVideoUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'Submagic processing timed out',
          heygen_url: heygenUrl,
          submagic_project_id: submagicResult.project_id
        },
        { status: 202 }
      );
    }

    console.log(`✅ Final video ready: ${finalVideoUrl}`);

    // Step 7: Schedule post to Metricool (brand-specific)
    console.log(`📱 Step 7: Scheduling post to ${platforms.join(', ')} for ${brand === 'carz' ? 'Carz Inc' : 'Prosway'}...`);
    const postResult = await scheduleVideoPost(
      finalVideoUrl,
      content.caption,
      content.title,
      platforms,
      schedule,
      brand // Pass brand for correct Metricool account
    );

    if (!postResult.success) {
      console.error('⚠️ Metricool scheduling failed:', postResult.error);
      // Don't fail the whole workflow - video is still created
    } else {
      console.log(`✅ Scheduled! Post ID: ${postResult.postId}`);
    }

    // SUCCESS! Return complete result
    return NextResponse.json({
      success: true,
      message: '🎉 Complete viral video workflow finished!',
      brand,
      article: {
        title: article.title,
        source: article.source
      },
      content: {
        script: content.script,
        title: content.title,
        caption: content.caption
      },
      video: {
        heygen_video_id: videoResult.video_id,
        heygen_url: heygenUrl,
        submagic_project_id: submagicResult.project_id,
        final_url: finalVideoUrl
      },
      social: {
        platforms,
        scheduled_for: postResult.scheduledFor || 'immediate',
        post_id: postResult.postId,
        success: postResult.success
      }
    });

  } catch (error) {
    console.error('❌ Workflow error:', error);
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
async function getBestArticle(brand: string): Promise<{ title: string; content: string; source: string } | null> {
  // Call your existing feed API
  const response = await fetch(`http://localhost:3000/api/scheduler`);
  const data = await response.json();

  // Simple mock for now - in production, this would rank articles
  return {
    title: 'Sample Article Title',
    content: 'Sample article content that will be converted to viral video...',
    source: 'RSS Feed'
  };
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
          content: `Generate viral video content with SCRIPT, CAPTION, and TITLE.

SCRIPT: 45-60 second dramatic, high-energy script for AI talking head video.
CAPTION: Under 150 chars with emojis for social media.
TITLE: Under 100 chars, clickable and SEO-friendly.

FORMAT:
SCRIPT: [your script]
CAPTION: [your caption]
TITLE: [your title]`
        },
        { role: 'user', content: `Article:\n\n${content.substring(0, 2000)}` }
      ],
      temperature: 0.85,
      max_tokens: 500
    })
  });

  const data = await response.json();
  const fullResponse = data.choices[0]?.message?.content?.trim() || '';

  const scriptMatch = fullResponse.match(/SCRIPT:\s*([\s\S]*?)(?=CAPTION:|$)/i);
  const captionMatch = fullResponse.match(/CAPTION:\s*(.*?)(?=TITLE:|$)/i);
  const titleMatch = fullResponse.match(/TITLE:\s*(.*?)$/i);

  return {
    script: scriptMatch ? scriptMatch[1].trim() : content.substring(0, 500),
    caption: captionMatch ? captionMatch[1].trim() : '🔥 Check this out!',
    title: titleMatch ? titleMatch[1].trim() : 'Viral Video'
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
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: JSON.stringify(errorData) };
    }

    const data = await response.json();
    return { success: true, video_id: data.data?.video_id || data.video_id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper: Wait for HeyGen video completion
async function waitForVideoCompletion(videoId: string, maxAttempts: number = 10): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
      const response = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
        { headers: { 'accept': 'application/json', 'x-api-key': HEYGEN_API_KEY! } }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const status = data.data?.status;

      console.log(`⏳ HeyGen (${attempt + 1}/${maxAttempts}): ${status}`);

      if (status === 'completed') return data.data.video_url;
      if (status === 'failed') return null;
    } catch (error) {
      console.error('Error checking video status:', error);
    }
  }

  return null;
}

// Helper: Enhance with Submagic
async function enhanceWithSubmagic(params: {
  videoUrl: string;
  title: string;
  language: string;
  templateName: string;
}): Promise<{ success: boolean; project_id?: string; error?: string }> {
  try {
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
      return { success: false, error: `API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    return { success: true, project_id: data.id || data.project_id || data.projectId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper: Wait for Submagic completion
async function waitForSubmagicCompletion(projectId: string, maxAttempts: number = 10): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
      const response = await fetch(
        `https://api.submagic.co/v1/projects/${projectId}`,
        { headers: { 'x-api-key': SUBMAGIC_API_KEY! } }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const status = data.status;

      console.log(`⏳ Submagic (${attempt + 1}/${maxAttempts}): ${status}`);

      if (status === 'completed' || status === 'done' || status === 'ready') {
        return data.video_url || data.videoUrl || data.output_url;
      }

      if (status === 'failed' || status === 'error') return null;
    } catch (error) {
      console.error('Error checking Submagic status:', error);
    }
  }

  return null;
}
