// HeyGen V2 API Video Generator for Owner Finance Benefit Videos
// Single-scene informational videos with CTA

import { BenefitPoint } from './benefit-content';

interface VideoScene {
  character: {
    type: string;
    avatar_id?: string;
    talking_photo_id?: string;
    scale?: number;
    talking_photo_style?: string;
    talking_style?: string;
    avatar_style?: string;
  };
  voice: {
    type: string;
    voice_id?: string;
    input_text: string;
    speed?: number;
  };
  background?: {
    type: string;
    value: string;
  };
}

interface HeyGenVideoRequest {
  video_inputs: VideoScene[];
  dimension?: {
    width: number;
    height: number;
  };
  title?: string;
  caption?: boolean;
  callback_id?: string;
  webhook_url?: string; // CRITICAL: HeyGen webhook callback URL
}

interface HeyGenVideoResponse {
  error: any;
  data: {
    video_id: string;
  };
}

// Avatar configuration for benefit videos
export interface BenefitAvatarConfig {
  avatar_type: 'avatar' | 'talking_photo';
  avatar_id: string;
  voice_id: string;
  scale: number;
  background_color: string;
}

// Default avatar configuration (same as Carz/OwnerFi/Podcast)
// Uses Abdullah avatar for all benefit videos
const DEFAULT_BUYER_AVATAR: BenefitAvatarConfig = {
  avatar_type: 'avatar',
  avatar_id: '8988e02d16544a4286305603244310fc', // Abdullah avatar (same as other brands)
  voice_id: '9070a6c2dbd54c10bb111dc8c655bff7', // Default voice
  scale: 1.4,
  background_color: '#059669' // Green for buyers
};

export class BenefitVideoGenerator {
  private apiKey: string;
  private apiUrl: string = 'https://api.heygen.com/v2/video/generate';
  private dimension = { width: 1080, height: 1920 }; // Vertical for mobile

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate video script from benefit point using OpenAI (OwnerFi Buyer-Focused System)
   * BUYER-ONLY: This system only generates scripts for buyers
   */
  private async generateScript(benefit: BenefitPoint): Promise<string> {
    // ENFORCE BUYER-ONLY
    if (benefit.audience !== 'buyer') {
      throw new Error('This system is BUYER-ONLY. Seller benefits are not supported.');
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    // Fallback if no OpenAI key
    if (!OPENAI_API_KEY) {
      const cta = "See what's possible at OwnerFi.ai";
      return `Attention home buyers! ${benefit.shortDescription} ${cta}`;
    }

    // Get current day for theme
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];

    // Daily theme guidance for content variety
    const dailyThemes = {
      'Monday': 'Credit Myths - Debunk common credit score myths that stop people from trying',
      'Tuesday': 'Real Stories - Share inspiring transformation stories of renters becoming homeowners',
      'Wednesday': 'How It Works - Explain owner financing process in simple, relatable terms',
      'Thursday': 'Money Mindset - Challenge limiting beliefs about homeownership and affordability',
      'Friday': 'Quick Wins - Share actionable tips buyers can implement immediately',
      'Saturday': 'Comparison - Show owner financing vs traditional bank loans side-by-side',
      'Sunday': 'Vision & Hope - Paint the picture of homeownership lifestyle and freedom'
    };

    const todayTheme = dailyThemes[today as keyof typeof dailyThemes];

    // Build OwnerFi Buyer-Focused prompt
    const prompt = `Generate a video script about "${benefit.title}" for buyers who can't qualify for traditional bank loans.

TODAY'S THEME (${today}): ${todayTheme}

TOPIC CONTEXT: ${benefit.shortDescription}

YOUR ROLE:
You are the official social-media scriptwriter for OwnerFi, a platform that helps people become homeowners without traditional banks using owner financing.

YOUR GOAL:
Make everyday renters stop scrolling and realize — they can actually own a home through owner financing.

STYLE RULES:
- Reading level: 5th grade — short, clear, natural sentences
- Tone: Friendly, confident, motivational — like a big brother giving real talk
- Length: 30 seconds max (≈90 words)
- Structure: Hook → Story/Insight → Soft CTA
- Hook (first 3 seconds): Use shock, surprise, or emotion to grab attention
- CTA: End with "See what's possible at OwnerFi.ai" or "Find homes like this for free at OwnerFi.ai"
- Do NOT promise approvals, prices, or guarantees
- All content must be 100% original and copyright-safe
- NEVER use phrases like "Let me tell you," "You won't believe this," or "I'm going to share"
- Keep it conversational — written to be spoken, not read

OUTPUT FORMAT:
Return ONLY the script text in this structure:

🎯 [Hook - 3-5 seconds of shock/surprise/emotion]
💡 [Main message - 15-20 seconds of insight/story]
🏁 [Soft CTA - 5 seconds with OwnerFi.ai]

EXAMPLE OUTPUT:
🎯 "Think you need perfect credit to buy a home? Nope — that's the old way."
💡 "With owner financing, you can buy directly from the seller. No bank hoops, no long waits, just steady income and a down payment. It's how thousands of families finally got keys in their hands."
🏁 "Search owner-finance homes near you — free at OwnerFi.ai."`;

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
              content: `You are the official social-media scriptwriter for OwnerFi, a platform that helps people become homeowners without traditional banks using owner financing.

Your only job: Create short, 30-second max (≈90-word) video scripts that explain, inspire, and educate buyers who think homeownership is out of reach.

GOAL: Make everyday renters stop scrolling and realize — they can actually own a home through owner financing.

STYLE: Friendly, confident, motivational — like a big brother giving real talk. 5th-grade reading level. No hype, no jargon. Always end with "See what's possible at OwnerFi.ai" or similar.

NEVER promise approvals, prices, or guarantees. All content must be 100% original and copyright-safe.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.85,
          max_tokens: 300
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const script = data.choices[0]?.message?.content?.trim();

      if (!script) {
        throw new Error('No script generated');
      }

      console.log(`✅ Generated OwnerFi Buyer script (${today} - ${todayTheme.split('-')[0].trim()}):`, script.substring(0, 100) + '...');
      return script;

    } catch (error) {
      console.error('⚠️  OpenAI script generation failed, using fallback:', error);
      // Fallback to simple buyer-focused script
      const cta = "See what's possible at OwnerFi.ai";
      return `Think you can't buy a home? ${benefit.shortDescription} ${cta}`;
    }
  }

  /**
   * Generate a single-scene benefit video (BUYER-ONLY)
   */
  async generateBenefitVideo(
    benefit: BenefitPoint,
    workflowId: string,
    customAvatar?: BenefitAvatarConfig
  ): Promise<string> {
    // ENFORCE BUYER-ONLY
    if (benefit.audience !== 'buyer') {
      throw new Error('This system is BUYER-ONLY. Seller benefits are not supported.');
    }

    console.log(`\nGenerating BUYER benefit video: ${benefit.title}`);
    console.log(`Audience: BUYERS (renters who want to become homeowners)`);

    // Get avatar config (custom or default buyer avatar)
    const avatarConfig = customAvatar || DEFAULT_BUYER_AVATAR;

    // Build video script with CTA (now async with OpenAI)
    const script = await this.generateScript(benefit);

    console.log(`Script: ${script.substring(0, 100)}...`);

    // Build video scene
    const videoScene = this.buildVideoScene(script, avatarConfig);

    // Get webhook URL using brand-utils
    const { getBrandWebhookUrl } = await import('@/lib/brand-utils');
    const webhookUrl = getBrandWebhookUrl('benefit', 'heygen');

    // Prepare HeyGen API request
    const request: HeyGenVideoRequest = {
      video_inputs: [videoScene], // Single scene
      dimension: this.dimension,
      title: benefit.title,
      caption: false, // We'll add captions via Submagic
      callback_id: workflowId, // Use workflow ID for webhook tracking
      webhook_url: webhookUrl // CRITICAL: Must include webhook callback
    };

    console.log(`📞 Webhook URL: ${webhookUrl}`);

    // Call HeyGen API
    const response = await this.callHeyGenAPI(request);

    if (response.error) {
      const errorMessage = typeof response.error === 'string'
        ? response.error
        : JSON.stringify(response.error);
      throw new Error(`HeyGen API error: ${errorMessage}`);
    }

    if (!response.data || !response.data.video_id) {
      throw new Error('HeyGen API did not return a video ID');
    }

    const videoId = response.data.video_id;
    console.log(`✅ Video generation started. Video ID: ${videoId}`);

    return videoId;
  }

  /**
   * Build video scene for HeyGen API
   */
  private buildVideoScene(script: string, avatarConfig: BenefitAvatarConfig): VideoScene {
    const character: any = {
      type: avatarConfig.avatar_type,
      scale: avatarConfig.scale || 1.4
    };

    // Add avatar_id or talking_photo_id based on type
    if (avatarConfig.avatar_type === 'avatar') {
      character.avatar_id = avatarConfig.avatar_id;
      character.avatar_style = 'normal';
    } else {
      character.talking_photo_id = avatarConfig.avatar_id;
      character.talking_photo_style = 'square';
      character.talking_style = 'expressive';
    }

    const voice: any = {
      type: 'text',
      input_text: script,
      speed: 1.0 // Normal speaking speed for clarity
    };

    // Add voice_id if provided
    if (avatarConfig.voice_id) {
      voice.voice_id = avatarConfig.voice_id;
    }

    return {
      character,
      voice,
      background: {
        type: 'color',
        value: avatarConfig.background_color
      }
    };
  }

  /**
   * Call HeyGen V2 API to generate video (with circuit breaker & timeout)
   */
  private async callHeyGenAPI(request: HeyGenVideoRequest): Promise<HeyGenVideoResponse> {
    console.log('\n📤 Sending request to HeyGen API...');
    console.log('Request body:', JSON.stringify(request, null, 2));

    // Use circuit breaker and timeout for reliability (same as Carz/OwnerFi)
    const { circuitBreakers, fetchWithTimeout, TIMEOUTS } = await import('@/lib/api-utils');

    const response = await circuitBreakers.heygen.execute(async () => {
      return await fetchWithTimeout(
        this.apiUrl,
        {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': this.apiKey
          },
          body: JSON.stringify(request)
        },
        TIMEOUTS.HEYGEN_API
      );
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);

      // Try to parse as JSON for better error messages
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      throw new Error(`HeyGen API request failed: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log('📥 API Response received');
    console.log('Full response:', JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Estimate video duration (for planning)
   */
  async estimateVideoDuration(benefit: BenefitPoint): Promise<number> {
    const script = await this.generateScript(benefit);
    const wordCount = script.split(' ').length;
    // Average speaking rate: 150 words per minute
    return Math.ceil((wordCount / 150) * 60);
  }
}

export default BenefitVideoGenerator;
