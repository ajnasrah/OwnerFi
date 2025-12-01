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
  vertical: {
    talkingPhoto: 1.4,      // Your current setting - works well
    talkingPhotoLarge: 1.5, // More zoomed in
    upperBody: 1.3,
    fullBody: 0.9,
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
  // ABDULLAH AGENTS (Primary)
  // ========================================
  {
    id: 'abdullah-primary',
    name: 'Abdullah (Talking Photo)',
    description: 'Primary Abdullah talking photo - currently in production',
    avatar: {
      avatarId: 'd33fe3abc2914faa88309c3bdb9f47f4',
      avatarType: 'talking_photo',
      scale: SCALE_PRESETS.vertical.talkingPhoto, // 1.4
    },
    voice: {
      voiceId: '9070a6c2dbd54c10bb111dc8c655bff7',
      speed: 1.0,
      emotion: 'Excited', // Use excited emotion for engaging content
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'benefit', 'property', 'abdullah'],
    isActive: true,
    isPrimary: true,
    previewImageUrl: 'https://files2.heygen.ai/avatar/v3/d33fe3abc2914faa88309c3bdb9f47f4/half/2.2/raw_preview_image.webp',
  },
  {
    id: 'abdullah-avatar',
    name: 'Abdullah (Full Avatar)',
    description: 'Abdullah interactive avatar - for variety',
    avatar: {
      avatarId: '8988e02d16544a4286305603244310fc',
      avatarType: 'avatar',
      scale: SCALE_PRESETS.vertical.upperBody,
      talkingStyle: 'expressive',
    },
    voice: {
      voiceId: '33e77b383694491db3160af5a9f9e0ab', // Abdullah voice clone
      speed: 1.0,
      emotion: 'Excited', // Changed to Excited for engaging content
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'benefit', 'property', 'abdullah'],
    isActive: true,
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
    },
    voice: {
      voiceId: '35659e86ce244d8389d525a9648d9c4a', // Carter Lee
      speed: 1.0,
      emotion: 'Excited',
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'benefit', 'property'],
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
    },
    voice: {
      voiceId: 'f38a635bee7a4d1f9b0a654a31d050d2', // Chill Brian
      speed: 1.0,
      emotion: 'Excited', // Changed to Excited for engaging content
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'benefit', 'property'],
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
    },
    voice: {
      voiceId: 'dc491816e53f46eaa466740fbfec09bb', // Adventure Alex - Excited
      speed: 1.0,
      emotion: 'Excited',
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'benefit', 'property'],
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
    },
    voice: {
      voiceId: '42d00d4aac5441279d8536cd6b52c53c', // Hope
      speed: 1.0,
      emotion: 'Excited', // Changed to Excited for engaging content
    },
    voiceLanguage: 'en',
    brands: ['ownerfi', 'benefit', 'property'],
    isActive: true,
    previewImageUrl: 'https://files2.heygen.ai/avatar/v3/c3d1baaebbe84752b7a473373c6cd385_42780/preview_target.webp',
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
  getRecommendedScale,
  buildCharacterConfig,
  buildVoiceConfig,
};
