/**
 * HeyGen Agent Configuration System
 *
 * Manages a pool of HeyGen avatars and voices for video generation.
 * Supports round-robin selection, brand-specific agents, and dynamic configuration.
 *
 * HeyGen API Reference:
 * - Emotions: 'Excited' | 'Friendly' | 'Serious' | 'Soothing' | 'Broadcaster'
 * - Talking Styles: 'stable' | 'expressive' (for regular avatars only, not talking photos)
 * - Scale: 0.5-2.0 (1.0 = default, higher = larger avatar on screen)
 */

import { Brand } from './constants';

// ============================================================================
// Types
// ============================================================================

export type VoiceEmotion = 'Excited' | 'Friendly' | 'Serious' | 'Soothing' | 'Broadcaster';
export type TalkingStyle = 'stable' | 'expressive';
export type AvatarType = 'avatar' | 'talking_photo';
export type VoiceLanguage = 'en' | 'es' | 'both';

export interface HeyGenAgentVoiceConfig {
  voiceId: string;
  speed?: number;          // 0.5 - 1.5, default 1.0
  emotion?: VoiceEmotion;  // Only works with emotion-supporting voices
}

export interface HeyGenAgentAvatarConfig {
  avatarId: string;
  avatarType: AvatarType;
  scale?: number;          // 0.5 - 2.0, default 1.0 (for talking photos, use ~1.4 for vertical videos)
  talkingStyle?: TalkingStyle;  // Only for 'avatar' type, not 'talking_photo'
  offsetX?: number;        // Horizontal offset in pixels
  offsetY?: number;        // Vertical offset in pixels
  hasBuiltInBackground?: boolean;  // True for studio avatars with backgrounds, false for talking photos
}

export interface HeyGenAgent {
  // Identity
  id: string;
  name: string;
  description?: string;

  // Avatar configuration
  avatar: HeyGenAgentAvatarConfig;

  // Voice configuration
  voice: HeyGenAgentVoiceConfig;
  voiceLanguage: VoiceLanguage;

  // Brand and usage settings
  brands: Brand[];         // Which brands can use this agent
  isActive: boolean;
  isPrimary?: boolean;     // Primary agent for a brand (used as default)

  // Tracking (stored in Firestore for persistence)
  usageCount?: number;
  lastUsedAt?: number;

  // Preview URLs (from HeyGen API)
  previewImageUrl?: string;
  previewVideoUrl?: string;
}

// ============================================================================
// Scale Settings Reference
// ============================================================================

/**
 * Scale settings guide for different video dimensions:
 *
 * VERTICAL (1080x1920 - Social Media / Shorts):
 * - Talking Photos: 1.3 - 1.5 (fills frame nicely, head & shoulders visible)
 * - Full-body Avatars: 0.8 - 1.0 (shows full body)
 * - Upper-body Avatars: 1.2 - 1.4 (fills frame)
 *
 * HORIZONTAL (1920x1080 - YouTube / Landscape):
 * - Talking Photos: 1.0 - 1.2 (standard size)
 * - Full-body Avatars: 0.6 - 0.8 (shows full body with background)
 * - Upper-body Avatars: 0.9 - 1.1 (balanced frame)
 *
 * SQUARE (1080x1080 - Instagram Feed):
 * - Talking Photos: 1.1 - 1.3 (centered nicely)
 * - Upper-body Avatars: 1.0 - 1.2 (fills frame)
 */

export const SCALE_PRESETS = {
  // For vertical social media videos (9:16)
  // Based on guide: Talking Photos 1.3-1.5, Upper-body 1.2-1.4, Full-body 0.8-1.0
  vertical: {
    talkingPhoto: 1.4,      // Good visibility without cutting off head
    talkingPhotoLarge: 1.5, // Slightly larger for emphasis
    upperBody: 1.3,         // Upper body visible with good framing
    fullBody: 0.9,          // Full body visible in frame
  },
  // For horizontal videos (16:9)
  horizontal: {
    talkingPhoto: 1.1,
    upperBody: 1.0,
    fullBody: 0.7,
  },
  // For square videos (1:1)
  square: {
    talkingPhoto: 1.2,
    upperBody: 1.1,
    fullBody: 0.8,
  }
} as const;

// ============================================================================
// Agent Pool Configuration
// ============================================================================

/**
 * Master agent pool
 * Add new agents here to make them available for selection
 */
export const HEYGEN_AGENTS: HeyGenAgent[] = [
  // ========================================
  // ABDULLAH AGENTS (DISABLED - no longer used for article videos)
  // ========================================
  {
    id: 'abdullah-primary',
    name: 'Abdullah (Talking Photo)',
    description: 'Primary Abdullah talking photo - DISABLED',
    avatar: {
      avatarId: 'd33fe3abc2914faa88309c3bdb9f47f4',
      avatarType: 'talking_photo',
      scale: SCALE_PRESETS.vertical.talkingPhoto, // 1.4
      hasBuiltInBackground: false, // Talking photos need explicit background
    },
    voice: {
      voiceId: '9070a6c2dbd54c10bb111dc8c655bff7',
      speed: 1.0,
      emotion: 'Excited', // Use excited emotion for engaging content
    },
    voiceLanguage: 'en',
    brands: ['abdullah'], // Only for Abdullah personal brand, not article videos
    isActive: false, // DISABLED
    isPrimary: true,
    previewImageUrl: 'https://files2.heygen.ai/avatar/v3/d33fe3abc2914faa88309c3bdb9f47f4/half/2.2/raw_preview_image.webp',
  },
  {
    id: 'abdullah-avatar',
    name: 'Abdullah (Full Avatar)',
    description: 'Abdullah interactive avatar - DISABLED',
    avatar: {
      avatarId: '8988e02d16544a4286305603244310fc',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive',
      hasBuiltInBackground: true, // Studio avatar with built-in background
    },
    voice: {
      voiceId: '33e77b383694491db3160af5a9f9e0ab', // Abdullah voice clone
      speed: 1.0,
      emotion: 'Excited', // Changed to Excited for engaging content
    },
    voiceLanguage: 'en',
    brands: ['abdullah'], // Only for Abdullah personal brand, not article videos
    isActive: false, // DISABLED
    isPrimary: false,
    previewImageUrl: 'https://files2.heygen.ai/avatar/v3/8988e02d16544a4286305603244310fc/full/2.2/preview_target.webp',
  },

  // ========================================
  // DIVERSE MALE AGENTS
  // ========================================
  {
    id: 'aditya-brown-blazer',
    name: 'Aditya (Brown Blazer)',
    description: 'Professional male avatar in brown blazer',
    avatar: {
      avatarId: 'Aditya_public_4',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive',
      hasBuiltInBackground: true, // Studio avatar with built-in background
      offsetY: 50, // Move avatar down to keep head in frame
    },
    voice: {
      voiceId: '35659e86ce244d8389d525a9648d9c4a', // Carter Lee
      speed: 1.0,
      emotion: 'Excited',
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'carz', 'vassdistro', 'benefit', 'property', 'personal', 'abdullah'],
    isActive: true,
    previewImageUrl: 'https://files2.heygen.ai/avatar/v3/17ad4b824e5a47e8b4f61e6a9cd346e7_62180/preview_target.webp',
  },
  {
    id: 'adrian-blue-sweater',
    name: 'Adrian (Blue Sweater)',
    description: 'Casual male avatar in blue sweater',
    avatar: {
      avatarId: 'Adrian_public_20240312',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive',
      hasBuiltInBackground: true, // Studio avatar with built-in background
      offsetY: 50, // Move avatar down to keep head in frame
    },
    voice: {
      voiceId: 'f38a635bee7a4d1f9b0a654a31d050d2', // Chill Brian
      speed: 1.0,
      emotion: 'Excited', // Changed to Excited for engaging content
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'carz', 'vassdistro', 'benefit', 'property', 'personal', 'abdullah'],
    isActive: true,
    previewImageUrl: 'https://files2.heygen.ai/avatar/v3/3e3d8f2231e44f73af86ff2f68b7649a_14947/preview_talk_4.webp',
  },

  // ========================================
  // DIVERSE FEMALE AGENTS
  // ========================================
  {
    id: 'abigail-expressive',
    name: 'Abigail (Expressive)',
    description: 'Expressive female avatar - upper body',
    avatar: {
      avatarId: 'Abigail_expressive_2024112501',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive',
      hasBuiltInBackground: true, // Studio avatar with built-in background
      offsetY: 50, // Move avatar down to keep head in frame
    },
    voice: {
      voiceId: 'dc491816e53f46eaa466740fbfec09bb', // Adventure Alex - Excited
      speed: 1.0,
      emotion: 'Excited',
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'carz', 'vassdistro', 'benefit', 'property', 'personal', 'abdullah'],
    isActive: true,
    previewImageUrl: 'https://files2.heygen.ai/avatar/v3/1ad51ab9fee24ae88af067206e14a1d8_44250/preview_target.webp',
  },
  {
    id: 'adriana-biztalk',
    name: 'Adriana (Business)',
    description: 'Professional female avatar in business attire',
    avatar: {
      avatarId: 'Adriana_BizTalk_Front_public',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive',
      hasBuiltInBackground: true, // Studio avatar with built-in background
      offsetY: 50, // Move avatar down to keep head in frame
    },
    voice: {
      voiceId: '42d00d4aac5441279d8536cd6b52c53c', // Hope
      speed: 1.0,
      emotion: 'Excited', // Changed to Excited for engaging content
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'carz', 'vassdistro', 'benefit', 'property', 'personal', 'abdullah'],
    isActive: true,
    previewImageUrl: 'https://files2.heygen.ai/avatar/v3/c3d1baaebbe84752b7a473373c6cd385_42780/preview_target.webp',
  },

  // ========================================
  // ADDITIONAL DIVERSE AGENTS
  // ========================================
  {
    id: 'josh-casual',
    name: 'Josh (Casual)',
    description: 'Young casual male avatar - DISABLED (avatar no longer available)',
    avatar: {
      avatarId: 'Josh_public_lite2_20230714',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive',
      hasBuiltInBackground: true,
    },
    voice: {
      voiceId: 'f38a635bee7a4d1f9b0a654a31d050d2', // Chill Brian
      speed: 1.0,
      emotion: 'Friendly',
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'carz', 'vassdistro', 'benefit', 'property', 'personal', 'abdullah'],
    isActive: false, // DISABLED - avatar not found in HeyGen
  },
  {
    id: 'kayla-casual',
    name: 'Kayla (Casual)',
    description: 'Young casual female avatar - DISABLED (avatar no longer available)',
    avatar: {
      avatarId: 'Kayla-inkhead-20220820',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive',
      hasBuiltInBackground: true,
    },
    voice: {
      voiceId: 'dc491816e53f46eaa466740fbfec09bb', // Adventure Alex
      speed: 1.0,
      emotion: 'Excited',
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'carz', 'vassdistro', 'benefit', 'property', 'personal', 'abdullah'],
    isActive: false, // DISABLED - avatar not found in HeyGen
  },
  {
    id: 'edward-business',
    name: 'Edward (Business)',
    description: 'Professional male avatar in suit - DISABLED (avatar no longer available)',
    avatar: {
      avatarId: 'Edward_public_pro2_20230608',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive',
      hasBuiltInBackground: true,
    },
    voice: {
      voiceId: '35659e86ce244d8389d525a9648d9c4a', // Carter Lee
      speed: 1.0,
      emotion: 'Excited',
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'carz', 'vassdistro', 'benefit', 'property', 'personal', 'abdullah'],
    isActive: false, // DISABLED - avatar not found in HeyGen
  },
  {
    id: 'susan-professional',
    name: 'Susan (Professional)',
    description: 'Professional female avatar',
    avatar: {
      avatarId: 'Susan_public_2_20240328',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive',
      hasBuiltInBackground: true,
      offsetY: 50, // Move avatar down to keep head in frame
    },
    voice: {
      voiceId: '42d00d4aac5441279d8536cd6b52c53c', // Hope
      speed: 1.0,
      emotion: 'Friendly',
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'carz', 'vassdistro', 'benefit', 'property', 'personal', 'abdullah'],
    isActive: true,
  },
  {
    id: 'tyler-hoodie',
    name: 'Tyler (Hoodie)',
    description: 'Casual male in hoodie',
    avatar: {
      avatarId: 'Tyler-incasualsuit-20220721',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive',
      hasBuiltInBackground: true,
      offsetY: 50, // Move avatar down to keep head in frame
    },
    voice: {
      voiceId: 'f38a635bee7a4d1f9b0a654a31d050d2', // Chill Brian
      speed: 1.0,
      emotion: 'Excited',
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'carz', 'vassdistro', 'benefit', 'property', 'personal', 'abdullah'],
    isActive: true,
  },
  {
    id: 'anna-teacher',
    name: 'Anna (Teacher)',
    description: 'Friendly female teacher avatar',
    avatar: {
      avatarId: 'Anna_public_3_20240108',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive',
      hasBuiltInBackground: true,
      offsetY: 50, // Move avatar down to keep head in frame
    },
    voice: {
      voiceId: 'dc491816e53f46eaa466740fbfec09bb', // Adventure Alex
      speed: 1.0,
      emotion: 'Friendly',
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'carz', 'vassdistro', 'benefit', 'property', 'personal', 'abdullah'],
    isActive: true,
  },

  // ========================================
  // GAZA AGENTS (Serious/Dramatic tone for humanitarian news)
  // ========================================
  {
    id: 'gaza-newsreader-male',
    name: 'David (News Reader)',
    description: 'Professional male newsreader for serious humanitarian news',
    avatar: {
      avatarId: 'Adrian_public_20240312', // Using Adrian for serious news
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'stable', // Stable for serious news delivery
      hasBuiltInBackground: true, // Studio avatar with built-in background
      offsetY: 50, // Move avatar down to keep head in frame
    },
    voice: {
      voiceId: 'f38a635bee7a4d1f9b0a654a31d050d2', // Chill Brian
      speed: 0.95, // Slightly slower for serious tone
      emotion: 'Serious', // Serious emotion for humanitarian content
    },
    voiceLanguage: 'en',
    brands: ['gaza'],
    isActive: true,
    isPrimary: true,
    previewImageUrl: 'https://files2.heygen.ai/avatar/v3/3e3d8f2231e44f73af86ff2f68b7649a_14947/preview_talk_4.webp',
  },
  {
    id: 'gaza-newsreader-female',
    name: 'Sarah (News Anchor)',
    description: 'Professional female news anchor for empathetic humanitarian coverage',
    avatar: {
      avatarId: 'Adriana_BizTalk_Front_public', // Professional female avatar
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'stable', // Stable for serious news delivery
      hasBuiltInBackground: true, // Studio avatar with built-in background
      offsetY: 50, // Move avatar down to keep head in frame
    },
    voice: {
      voiceId: '42d00d4aac5441279d8536cd6b52c53c', // Hope
      speed: 0.95,
      emotion: 'Soothing', // Soothing emotion for empathetic delivery
    },
    voiceLanguage: 'en',
    brands: ['gaza'],
    isActive: true,
    isPrimary: false,
    previewImageUrl: 'https://files2.heygen.ai/avatar/v3/c3d1baaebbe84752b7a473373c6cd385_42780/preview_target.webp',
  },
  {
    id: 'gaza-correspondent',
    name: 'Aditya (Correspondent)',
    description: 'Field correspondent style for breaking news coverage',
    avatar: {
      avatarId: 'Aditya_public_4',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive', // Slightly more expressive for urgent news
      hasBuiltInBackground: true, // Studio avatar with built-in background
      offsetY: 50, // Move avatar down to keep head in frame
    },
    voice: {
      voiceId: '35659e86ce244d8389d525a9648d9c4a', // Carter Lee
      speed: 1.0,
      emotion: 'Serious', // Serious for news correspondent
    },
    voiceLanguage: 'en',
    brands: ['gaza'],
    isActive: true,
    isPrimary: false,
    previewImageUrl: 'https://files2.heygen.ai/avatar/v3/17ad4b824e5a47e8b4f61e6a9cd346e7_62180/preview_target.webp',
  },
  {
    id: 'gaza-humanitarian',
    name: 'Abigail (Humanitarian)',
    description: 'Compassionate presenter for emotional humanitarian stories',
    avatar: {
      avatarId: 'Abigail_expressive_2024112501',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive',
      hasBuiltInBackground: true, // Studio avatar with built-in background
      offsetY: 50, // Move avatar down to keep head in frame
    },
    voice: {
      voiceId: 'dc491816e53f46eaa466740fbfec09bb', // Adventure Alex
      speed: 0.95,
      emotion: 'Soothing', // Soothing for humanitarian stories
    },
    voiceLanguage: 'en',
    brands: ['gaza'],
    isActive: true,
    isPrimary: false,
    previewImageUrl: 'https://files2.heygen.ai/avatar/v3/1ad51ab9fee24ae88af067206e14a1d8_44250/preview_target.webp',
  },

  // ========================================
  // SPANISH AGENTS
  // ========================================
  {
    id: 'abdullah-spanish',
    name: 'Abdullah (Spanish)',
    description: 'Abdullah with Spanish voice for Spanish property videos',
    avatar: {
      avatarId: 'd33fe3abc2914faa88309c3bdb9f47f4',
      avatarType: 'talking_photo',
      scale: SCALE_PRESETS.vertical.talkingPhoto,
      hasBuiltInBackground: false, // Talking photos need explicit background
    },
    voice: {
      // Will need to get a Spanish voice ID - placeholder for now
      voiceId: '9070a6c2dbd54c10bb111dc8c655bff7', // TODO: Replace with Spanish voice
      speed: 1.0,
      emotion: 'Excited',
    },
    voiceLanguage: 'es',
    brands: ['ownerfi', 'property'],
    isActive: false, // Enable when Spanish voice is configured
    isPrimary: true,
    previewImageUrl: 'https://files2.heygen.ai/avatar/v3/d33fe3abc2914faa88309c3bdb9f47f4/half/2.2/raw_preview_image.webp',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all active agents for a specific brand
 */
export function getAgentsForBrand(brand: Brand): HeyGenAgent[] {
  return HEYGEN_AGENTS.filter(agent =>
    agent.isActive && agent.brands.includes(brand)
  );
}

/**
 * Get primary agent for a brand
 */
export function getPrimaryAgentForBrand(brand: Brand): HeyGenAgent | undefined {
  return HEYGEN_AGENTS.find(agent =>
    agent.isActive && agent.brands.includes(brand) && agent.isPrimary
  );
}

/**
 * Get agents by language
 */
export function getAgentsByLanguage(language: VoiceLanguage, brand?: Brand): HeyGenAgent[] {
  return HEYGEN_AGENTS.filter(agent => {
    const languageMatch = agent.voiceLanguage === language || agent.voiceLanguage === 'both';
    const brandMatch = !brand || agent.brands.includes(brand);
    return agent.isActive && languageMatch && brandMatch;
  });
}

/**
 * Get agent by ID
 */
export function getAgentById(agentId: string): HeyGenAgent | undefined {
  return HEYGEN_AGENTS.find(agent => agent.id === agentId);
}

/**
 * Get agents with built-in backgrounds (studio avatars)
 * These are HeyGen's pre-built avatars that include their own studio backgrounds
 * Use these when you want the avatar's natural background instead of a solid color
 */
export function getAgentsWithBuiltInBackground(brand?: Brand): HeyGenAgent[] {
  return HEYGEN_AGENTS.filter(agent => {
    const hasBackground = agent.avatar.hasBuiltInBackground === true;
    const brandMatch = !brand || agent.brands.includes(brand);
    return agent.isActive && hasBackground && brandMatch;
  });
}

/**
 * Get agents without built-in backgrounds (talking photos)
 * These need an explicit background color or image specified
 */
export function getAgentsWithoutBuiltInBackground(brand?: Brand): HeyGenAgent[] {
  return HEYGEN_AGENTS.filter(agent => {
    const needsBackground = agent.avatar.hasBuiltInBackground !== true;
    const brandMatch = !brand || agent.brands.includes(brand);
    return agent.isActive && needsBackground && brandMatch;
  });
}

/**
 * Get recommended scale for video dimensions
 */
export function getRecommendedScale(
  avatarType: AvatarType,
  videoDimension: 'vertical' | 'horizontal' | 'square'
): number {
  const presets = SCALE_PRESETS[videoDimension];

  if (avatarType === 'talking_photo') {
    return presets.talkingPhoto;
  }

  // For regular avatars, use upper body as default
  return presets.upperBody;
}

/**
 * Build HeyGen video request character config from agent
 */
export function buildCharacterConfig(agent: HeyGenAgent, videoDimension: 'vertical' | 'horizontal' | 'square' = 'vertical') {
  const scale = agent.avatar.scale || getRecommendedScale(agent.avatar.avatarType, videoDimension);

  const baseConfig: Record<string, any> = {
    type: agent.avatar.avatarType,
    scale,
  };

  // Add avatar ID based on type
  if (agent.avatar.avatarType === 'talking_photo') {
    baseConfig.talking_photo_id = agent.avatar.avatarId;
  } else {
    baseConfig.avatar_id = agent.avatar.avatarId;
    // Only add talking_style for regular avatars
    if (agent.avatar.talkingStyle) {
      baseConfig.talking_style = agent.avatar.talkingStyle;
    }
  }

  // Add offset if specified
  if (agent.avatar.offsetX !== undefined) {
    baseConfig.offset_x = agent.avatar.offsetX;
  }
  if (agent.avatar.offsetY !== undefined) {
    baseConfig.offset_y = agent.avatar.offsetY;
  }

  return baseConfig;
}

/**
 * Build HeyGen video request voice config from agent
 */
export function buildVoiceConfig(agent: HeyGenAgent, inputText: string) {
  const config: Record<string, any> = {
    type: 'text',
    voice_id: agent.voice.voiceId,
    input_text: inputText,
    speed: agent.voice.speed || 1.0,
  };

  // Add emotion if specified
  if (agent.voice.emotion) {
    config.emotion = agent.voice.emotion;
  }

  return config;
}

/**
 * Build HeyGen video request background config from agent
 * Returns undefined if agent has built-in background (studio avatars)
 * Returns a color background config if agent needs explicit background (talking photos)
 */
export function buildBackgroundConfig(
  agent: HeyGenAgent,
  fallbackColor: string = '#1a1a2e'
): { type: 'color'; value: string } | undefined {
  // Studio avatars have built-in backgrounds - don't specify a background
  if (agent.avatar.hasBuiltInBackground) {
    return undefined;
  }

  // Talking photos need an explicit background
  return {
    type: 'color',
    value: fallbackColor
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  HEYGEN_AGENTS,
  SCALE_PRESETS,
  getAgentsForBrand,
  getPrimaryAgentForBrand,
  getAgentsByLanguage,
  getAgentById,
  getAgentsWithBuiltInBackground,
  getAgentsWithoutBuiltInBackground,
  getRecommendedScale,
  buildCharacterConfig,
  buildVoiceConfig,
  buildBackgroundConfig,
};
