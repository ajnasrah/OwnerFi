/**
 * Synthesia Agent Configuration System
 *
 * Mirrors heygen-agents.ts pattern for the Synthesia trial.
 * Manages a pool of Synthesia avatars and voices for video generation.
 *
 * Synthesia API Reference:
 * - 230+ stock avatars available
 * - Aspect ratios: '16:9', '9:16', '1:1'
 * - Voices: multiple languages and styles
 */

import { Brand } from './constants';

// ============================================================================
// Types
// ============================================================================

export interface SynthesiaAgent {
  id: string;
  name: string;
  description?: string;
  avatarId: string;
  voiceId: string;
  brands: Brand[];
  isActive: boolean;
  isPrimary?: boolean;
  previewImageUrl?: string;
}

// ============================================================================
// Agent Pool Configuration
// ============================================================================

/**
 * Synthesia agent pool for trial period.
 * Using stock avatars from Synthesia's library.
 * Avatar/voice IDs will need to be populated from GET /api/synthesia/avatars
 * after the API key is configured.
 */
export const SYNTHESIA_AGENTS: SynthesiaAgent[] = [
  {
    id: 'synthesia-anna',
    name: 'Anna (Synthesia)',
    description: 'Professional female presenter',
    avatarId: 'anna_costume1_cameraA', // Placeholder - update after browsing avatars
    voiceId: 'en-US-JennyNeural',
    brands: ['ownerfi', 'carz', 'benefit', 'personal', 'abdullah', 'realtors'],
    isActive: true,
    isPrimary: true,
  },
  {
    id: 'synthesia-james',
    name: 'James (Synthesia)',
    description: 'Professional male presenter',
    avatarId: 'james_costume1_cameraA', // Placeholder - update after browsing avatars
    voiceId: 'en-US-GuyNeural',
    brands: ['ownerfi', 'carz', 'benefit', 'personal', 'abdullah', 'realtors'],
    isActive: true,
  },
  {
    id: 'synthesia-lisa',
    name: 'Lisa (Synthesia)',
    description: 'Casual female presenter',
    avatarId: 'lisa_costume1_cameraA', // Placeholder - update after browsing avatars
    voiceId: 'en-US-AriaNeural',
    brands: ['ownerfi', 'carz', 'benefit', 'personal', 'abdullah', 'realtors'],
    isActive: true,
  },
  {
    id: 'synthesia-jack',
    name: 'Jack (Synthesia)',
    description: 'Casual male presenter',
    avatarId: 'jack_costume1_cameraA', // Placeholder - update after browsing avatars
    voiceId: 'en-US-DavisNeural',
    brands: ['ownerfi', 'carz', 'benefit', 'personal', 'abdullah', 'realtors'],
    isActive: true,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all active Synthesia agents for a specific brand
 */
export function getSynthesiaAgentsForBrand(brand: Brand): SynthesiaAgent[] {
  return SYNTHESIA_AGENTS.filter(agent =>
    agent.isActive && agent.brands.includes(brand)
  );
}

/**
 * Get primary Synthesia agent for a brand
 */
export function getPrimarySynthesiaAgent(brand: Brand): SynthesiaAgent | undefined {
  return SYNTHESIA_AGENTS.find(agent =>
    agent.isActive && agent.brands.includes(brand) && agent.isPrimary
  );
}

/**
 * Get a Synthesia agent for a brand (primary or round-robin)
 */
let roundRobinIndex = 0;
export function getSynthesiaAgentForBrand(brand: Brand): SynthesiaAgent {
  const agents = getSynthesiaAgentsForBrand(brand);

  if (agents.length === 0) {
    // Fallback to first active agent
    const fallback = SYNTHESIA_AGENTS.find(a => a.isActive);
    if (!fallback) {
      throw new Error('No active Synthesia agents configured');
    }
    return fallback;
  }

  // Round-robin selection
  const agent = agents[roundRobinIndex % agents.length];
  roundRobinIndex++;
  return agent;
}

/**
 * Get agent by ID
 */
export function getSynthesiaAgentById(agentId: string): SynthesiaAgent | undefined {
  return SYNTHESIA_AGENTS.find(agent => agent.id === agentId);
}

/**
 * Build Synthesia clip config from agent and script
 */
export function buildSynthesiaClipConfig(agent: SynthesiaAgent, scriptText: string) {
  return {
    avatarId: agent.avatarId,
    voiceId: agent.voiceId,
    scriptText,
  };
}

export default {
  SYNTHESIA_AGENTS,
  getSynthesiaAgentsForBrand,
  getPrimarySynthesiaAgent,
  getSynthesiaAgentForBrand,
  getSynthesiaAgentById,
  buildSynthesiaClipConfig,
};
