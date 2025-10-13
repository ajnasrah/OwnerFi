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

    // Mark article as being processed and add to workflow queue
    let workflowId: string | undefined;
    if (article.id) {
      const { markArticleProcessed, addWorkflowToQueue } = await import('@/lib/feed-store-firestore');
      await markArticleProcessed(article.id, brand as 'carz' | 'ownerfi');

      // Add to workflow queue with 'pending' status
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
      height: 1920
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

    // Update workflow with HeyGen video ID
    if (workflowId) {
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
        heygenVideoId: videoResult.video_id
      });
    }

    // Step 4: Wait for HeyGen completion
    console.log('⏳ Step 4: Waiting for HeyGen video...');
    const heygenUrl = await waitForVideoCompletion(videoResult.video_id, 14);

    if (!heygenUrl) {
      return NextResponse.json(
        { success: false, error: 'HeyGen video timed out', video_id: videoResult.video_id },
        { status: 202 }
      );
    }

    console.log(`✅ HeyGen completed: ${heygenUrl}`);

    // Step 4.5: Upload HeyGen video to Firebase for public access
    console.log('☁️  Step 4.5: Uploading HeyGen video to public storage...');
    const { downloadAndUploadVideo } = await import('@/lib/video-storage');
    const publicHeygenUrl = await downloadAndUploadVideo(
      heygenUrl,
      HEYGEN_API_KEY!,
      `heygen-videos/${videoResult.video_id}.mp4`
    );
    console.log(`✅ Public HeyGen URL: ${publicHeygenUrl}`);

    // Step 5: Enhance with Submagic (using public URL)
    console.log('✨ Step 5: Adding Submagic captions and effects...');

    // Update workflow status to 'submagic_processing'
    if (workflowId) {
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
        status: 'submagic_processing'
      });
    }

    const submagicResult = await enhanceWithSubmagic({
      videoUrl: publicHeygenUrl, // Use public URL instead of auth-required HeyGen URL
      title: content.title,
      language: 'en',
      templateName: 'Hormozi 2'
    });

    if (!submagicResult.success || !submagicResult.project_id) {
      // Update workflow status to 'failed'
      if (workflowId) {
        const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
        await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
          status: 'failed',
          error: submagicResult.error || 'Submagic enhancement failed'
        });
      }

      return NextResponse.json(
        { success: false, error: 'Submagic enhancement failed', heygen_url: heygenUrl },
        { status: 500 }
      );
    }

    console.log(`✅ Submagic project: ${submagicResult.project_id}`);

    // Update workflow with Submagic project ID
    if (workflowId) {
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
        submagicVideoId: submagicResult.project_id
      });
    }

    // Step 6: Wait for Submagic completion
    console.log('⏳ Step 6: Waiting for Submagic enhancement...');
    const finalVideoUrl = await waitForSubmagicCompletion(submagicResult.project_id, 14);

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

    console.log(`✅ Submagic video ready: ${finalVideoUrl}`);

    // Step 7: Upload Submagic video to R2 for permanent public URL
    console.log('☁️  Step 7: Uploading Submagic video to R2 for Metricool...');
    const { uploadSubmagicVideo } = await import('@/lib/video-storage');
    const publicVideoUrl = await uploadSubmagicVideo(finalVideoUrl);
    console.log(`✅ Public R2 URL: ${publicVideoUrl}`);

    // Step 8: Schedule post to Metricool (brand-specific)
    console.log(`📱 Step 8: Scheduling post to ${platforms.join(', ')} for ${brand === 'carz' ? 'Carz Inc' : 'Prosway'}...`);

    // Update workflow status to 'posting'
    if (workflowId) {
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
        status: 'posting'
      });
    }

    const postResult = await scheduleVideoPost(
      publicVideoUrl, // Use Submagic URL directly (trusted domain)
      content.caption,
      content.title,
      platforms,
      schedule,
      brand // Pass brand for correct Metricool account
    );

    if (!postResult.success) {
      console.error('⚠️ Metricool scheduling failed:', postResult.error);

      // Update workflow status to 'failed' but still return video URLs
      if (workflowId) {
        const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
        await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
          status: 'failed',
          error: postResult.error || 'Metricool scheduling failed'
        });
      }
    } else {
      console.log(`✅ Scheduled! Post ID: ${postResult.postId}`);

      // Update workflow status to 'completed'
      if (workflowId) {
        const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
        await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
          status: 'completed',
          metricoolPostId: postResult.postId,
          completedAt: Date.now()
        });
      }
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
        heygen_public_url: publicHeygenUrl,
        submagic_project_id: submagicResult.project_id,
        submagic_url: finalVideoUrl,
        public_url: publicVideoUrl
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
          content: `You are a viral video script writer. Generate a single-person talking head video script.

IMPORTANT RULES:
- Write ONLY what the person says directly to camera - no scene descriptions, no cuts, no "[Opening shot]" directions
- 45-60 seconds of continuous speech (approximately 120-150 words)
- High energy, dramatic, attention-grabbing delivery
- Start with a hook that stops the scroll
- Use short punchy sentences
- Written in FIRST PERSON as if YOU are speaking to the audience
- NO stage directions, NO camera directions, NO scene descriptions

FORMAT:
SCRIPT: [the exact words the AI avatar will speak - nothing else]

TITLE: [50-100 characters, attention-grabbing headline with emojis]

CAPTION: [Engaging social media post with:
- Strong opening hook (1-2 sentences)
- Key value points (2-3 bullets or short sentences)
- Call to action
- 5-10 relevant hashtags at the end
- Use emojis strategically
- 200-300 characters total]

EXAMPLE GOOD OUTPUT:
SCRIPT: "Listen up because what I'm about to tell you will change everything you know about car insurance..."

TITLE: 🚗 Dealerships Don't Want You to Know THIS About Insurance!

CAPTION: Car dealerships are hiding something BIG from you 👀

When you finance a vehicle, they're making money THREE ways:
• Marked up interest rates
• Extended warranty commissions
• Insurance kickbacks

Don't let them take advantage! Watch to learn how to save thousands 💰

#CarInsurance #DealershipSecrets #FinanceTips #SaveMoney #AutoInsurance #CarBuying #SmartShopping #ConsumerRights #MoneyTips #InsuranceHacks

EXAMPLE BAD SCRIPT:
"[Opening shot of person in office] Today we're going to talk about car insurance. [Cut to B-roll of cars]"`
        },
        { role: 'user', content: `Article:\n\n${content.substring(0, 2000)}` }
      ],
      temperature: 0.85,
      max_tokens: 800
    })
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

  return {
    script: scriptMatch ? scriptMatch[1].trim() : content.substring(0, 500),
    title: titleMatch ? titleMatch[1].trim() : 'Breaking News - Must Watch!',
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
async function waitForVideoCompletion(videoId: string, maxAttempts: number = 14): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 45000)); // 45 seconds × 14 = 10.5 minutes

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
        templateName: params.templateName,
        magicBrolls: true,           // Add contextual B-roll footage
        magicBrollsPercentage: 50,   // 50% B-roll coverage
        magicZooms: true             // Add dynamic zoom effects
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

// Helper: Wait for Submagic completion
async function waitForSubmagicCompletion(projectId: string, maxAttempts: number = 14): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 45000)); // 45 seconds × 14 = 10.5 minutes

    try {
      const response = await fetch(
        `https://api.submagic.co/v1/projects/${projectId}`,
        { headers: { 'x-api-key': SUBMAGIC_API_KEY! } }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const status = data.status;

      console.log(`⏳ Submagic (${attempt + 1}/${maxAttempts}): ${status}`);
      console.log(`   Full response:`, JSON.stringify(data, null, 2));

      if (status === 'completed' || status === 'done' || status === 'ready') {
        // Priority order: media_url (direct downloadable), video_url, download_url, then fallbacks
        const videoUrl = data.media_url || data.mediaUrl || data.video_url || data.videoUrl || data.download_url || data.downloadUrl || data.output_url || data.url || data.resultUrl || data.result_url;
        console.log(`   Found video URL: ${videoUrl}`);
        return videoUrl;
      }

      if (status === 'failed' || status === 'error') return null;
    } catch (error) {
      console.error('Error checking Submagic status:', error);
    }
  }

  return null;
}
