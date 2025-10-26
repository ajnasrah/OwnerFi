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

// Get default avatars from environment variables
const getDefaultAvatars = (): Record<'seller' | 'buyer', BenefitAvatarConfig> => {
  // Use your own avatar and voice from environment variables
  const defaultAvatarId = process.env.BENEFIT_AVATAR_ID || process.env.HEYGEN_AVATAR_ID || '';
  const defaultVoiceId = process.env.BENEFIT_VOICE_ID || process.env.HEYGEN_VOICE_ID || '';
  const defaultAvatarType = (process.env.BENEFIT_AVATAR_TYPE || 'talking_photo') as 'avatar' | 'talking_photo';

  return {
    seller: {
      avatar_type: defaultAvatarType,
      avatar_id: process.env.BENEFIT_SELLER_AVATAR_ID || defaultAvatarId,
      voice_id: process.env.BENEFIT_SELLER_VOICE_ID || defaultVoiceId,
      scale: Number(process.env.BENEFIT_SELLER_SCALE || '1.4'),
      background_color: process.env.BENEFIT_SELLER_BG_COLOR || '#1e3a8a' // Deep blue for sellers
    },
    buyer: {
      avatar_type: defaultAvatarType,
      avatar_id: process.env.BENEFIT_BUYER_AVATAR_ID || defaultAvatarId,
      voice_id: process.env.BENEFIT_BUYER_VOICE_ID || defaultVoiceId,
      scale: Number(process.env.BENEFIT_BUYER_SCALE || '1.4'),
      background_color: process.env.BENEFIT_BUYER_BG_COLOR || '#059669' // Green for buyers
    }
  };
};

const DEFAULT_AVATARS = getDefaultAvatars();

export class BenefitVideoGenerator {
  private apiKey: string;
  private apiUrl: string = 'https://api.heygen.com/v2/video/generate';
  private dimension = { width: 1080, height: 1920 }; // Vertical for mobile

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate video script from benefit point using OpenAI (Abdullah Brand style)
   */
  private async generateScript(benefit: BenefitPoint): Promise<string> {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    // Fallback if no OpenAI key
    if (!OPENAI_API_KEY) {
      const intro = benefit.audience === 'seller'
        ? "Attention home sellers!"
        : "Attention home buyers!";
      const cta = "Visit ownerfi.ai to see owner-financed properties in your area today.";
      return `${intro} ${benefit.shortDescription} ${cta}`;
    }

    // Get current day for theme
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];

    // Build Abdullah Brand prompt
    const prompt = `Generate a 30-second talking-head script for Abdullah (cartoon avatar) about "${benefit.title}" targeting ${benefit.audience}s.

Today is ${today}.

Topic Context: ${benefit.shortDescription}

${today === 'Tuesday' ? 'Focus: Money & Ownership' : ''}
${today === 'Sunday' ? 'Focus: Faith & Grounding' : ''}
${today === 'Wednesday' ? 'Focus: Community & Relationships' : ''}
${today === 'Thursday' ? 'Focus: Entrepreneurship & Action' : ''}
${today === 'Friday' ? 'Focus: Reflection & Real Talk' : ''}
${today === 'Monday' ? 'Focus: Mindset & Motivation' : ''}
${today === 'Saturday' ? 'Focus: Freedom & Lifestyle' : ''}

CRITICAL REQUIREMENTS:
- 80-110 words maximum (30 seconds)
- Start with a natural, thought-provoking question related to owner financing
- Calm, confident, relatable tone - no hype, no jargon
- Connect to universal human insight (not just selling)
- End with a short, memorable takeaway
- MUST include: "Visit ownerfi.ai" as natural CTA

OUTPUT FORMAT:
Return ONLY the script text (no labels, no formatting, just the words Abdullah will speak).

DISCLAIMER REQUIRED AT END:
"This content is for educational purposes only. Do your own research and make decisions that fit your situation."`;

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
              content: `You are Abdullah, a grounded, motivational entrepreneur who helps people think differently about money, mindset, and community. You write 30-second scripts for a cartoon avatar that connect real estate/owner financing topics to universal human insights. Your tone is calm, confident, and relatable - never hype, never salesy.`
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

      console.log('✅ Generated Abdullah Brand script:', script.substring(0, 100) + '...');
      return script;

    } catch (error) {
      console.error('⚠️  OpenAI script generation failed, using fallback:', error);
      // Fallback to simple script
      const intro = benefit.audience === 'seller'
        ? "Attention home sellers!"
        : "Attention home buyers!";
      const cta = "Visit ownerfi.ai to see owner-financed properties in your area today.";
      return `${intro} ${benefit.shortDescription} ${cta}`;
    }
  }

  /**
   * Generate a single-scene benefit video
   */
  async generateBenefitVideo(
    benefit: BenefitPoint,
    workflowId: string,
    customAvatar?: BenefitAvatarConfig
  ): Promise<string> {
    console.log(`\nGenerating benefit video: ${benefit.title}`);
    console.log(`Audience: ${benefit.audience.toUpperCase()}`);

    // Get avatar config (custom or default based on audience)
    const avatarConfig = customAvatar || DEFAULT_AVATARS[benefit.audience];

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
  estimateVideoDuration(benefit: BenefitPoint): number {
    const script = this.generateScript(benefit);
    const wordCount = script.split(' ').length;
    // Average speaking rate: 150 words per minute
    return Math.ceil((wordCount / 150) * 60);
  }
}

export default BenefitVideoGenerator;
