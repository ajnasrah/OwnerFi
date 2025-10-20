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

// Default avatars for seller and buyer videos
const DEFAULT_AVATARS: Record<'seller' | 'buyer', BenefitAvatarConfig> = {
  seller: {
    avatar_type: 'talking_photo',
    avatar_id: 'Wayne_public_3_20240711', // Professional male avatar
    voice_id: '1bd001e7e50f421d891986aad5158bc8', // Professional male voice
    scale: 1.4,
    background_color: '#1e3a8a' // Deep blue for sellers
  },
  buyer: {
    avatar_type: 'talking_photo',
    avatar_id: 'Kayla_public_2_20240108', // Friendly female avatar
    voice_id: '2d5b0e6cf36f42589658ee24c6e481c2', // Friendly female voice
    scale: 1.4,
    background_color: '#059669' // Green for buyers
  }
};

export class BenefitVideoGenerator {
  private apiKey: string;
  private apiUrl: string = 'https://api.heygen.com/v2/video/generate';
  private dimension = { width: 1080, height: 1920 }; // Vertical for mobile

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate video script from benefit point with CTA
   */
  private generateScript(benefit: BenefitPoint): string {
    const intro = benefit.audience === 'seller'
      ? "Attention home sellers!"
      : "Attention home buyers!";

    const cta = "Visit ownerfi.ai to see owner-financed properties in your area today.";

    return `${intro} ${benefit.shortDescription} ${cta}`;
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

    // Build video script with CTA
    const script = this.generateScript(benefit);

    console.log(`Script: ${script.substring(0, 100)}...`);

    // Build video scene
    const videoScene = this.buildVideoScene(script, avatarConfig);

    // Prepare HeyGen API request
    const request: HeyGenVideoRequest = {
      video_inputs: [videoScene], // Single scene
      dimension: this.dimension,
      title: benefit.title,
      caption: false, // We'll add captions via Submagic
      callback_id: workflowId // Use workflow ID for webhook tracking
    };

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
   * Call HeyGen V2 API to generate video
   */
  private async callHeyGenAPI(request: HeyGenVideoRequest): Promise<HeyGenVideoResponse> {
    console.log('\n📤 Sending request to HeyGen API...');

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ API Error Response:', error);
      throw new Error(`HeyGen API request failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log('📥 API Response received');
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
