/**
 * Agent Selection Service
 *
 * Handles intelligent selection of HeyGen agents for video generation.
 * Supports multiple selection strategies:
 * - Round-robin: Evenly distributes usage across agents
 * - Random: Randomly selects from eligible agents
 * - Specific: Uses a pre-assigned agent
 * - Primary: Uses the brand's primary agent
 *
 * Agent usage is tracked in Firestore for persistence across restarts.
 */

import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Brand } from '@/config/constants';
import {
  HeyGenAgent,
  VoiceLanguage,
  HEYGEN_AGENTS,
  getAgentsForBrand,
  getPrimaryAgentForBrand,
  getAgentsByLanguage,
  getAgentById,
} from '@/config/heygen-agents';

// ============================================================================
// Types
// ============================================================================

export type AgentSelectionMode = 'round-robin' | 'random' | 'specific' | 'primary';

export interface AgentSelectionOptions {
  mode?: AgentSelectionMode;
  specificAgentId?: string;         // For 'specific' mode
  language?: VoiceLanguage;         // Filter by language
  excludeAgentIds?: string[];       // Exclude specific agents
  preferExpressive?: boolean;       // Prefer agents with expressive talking style
}

export interface AgentUsageRecord {
  agentId: string;
  usageCount: number;
  lastUsedAt: number;
  brand: Brand;
}

// ============================================================================
// Firestore Collection
// ============================================================================

const AGENT_USAGE_COLLECTION = 'heygen_agent_usage';

// ============================================================================
// Usage Tracking
// ============================================================================

/**
 * Get agent usage record from Firestore
 */
async function getAgentUsage(agentId: string, brand: Brand): Promise<AgentUsageRecord | null> {
  if (!db) return null;

  const docId = `${brand}_${agentId}`;
  const docRef = doc(db, AGENT_USAGE_COLLECTION, docId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return docSnap.data() as AgentUsageRecord;
}

/**
 * Get all agent usage records for a brand
 */
async function getAllAgentUsage(brand: Brand): Promise<Map<string, AgentUsageRecord>> {
  if (!db) return new Map();

  const usageMap = new Map<string, AgentUsageRecord>();

  try {
    const q = query(
      collection(db, AGENT_USAGE_COLLECTION),
      where('brand', '==', brand)
    );

    const snapshot = await getDocs(q);
    snapshot.docs.forEach(doc => {
      const data = doc.data() as AgentUsageRecord;
      usageMap.set(data.agentId, data);
    });
  } catch (error) {
    console.error('Error fetching agent usage:', error);
  }

  return usageMap;
}

/**
 * Increment agent usage count
 */
export async function incrementAgentUsage(agentId: string, brand: Brand): Promise<void> {
  if (!db) return;

  const docId = `${brand}_${agentId}`;
  const docRef = doc(db, AGENT_USAGE_COLLECTION, docId);

  try {
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const current = docSnap.data() as AgentUsageRecord;
      await updateDoc(docRef, {
        usageCount: current.usageCount + 1,
        lastUsedAt: Date.now(),
      });
    } else {
      await setDoc(docRef, {
        agentId,
        brand,
        usageCount: 1,
        lastUsedAt: Date.now(),
      });
    }

    console.log(`📊 Agent usage updated: ${agentId} for ${brand}`);
  } catch (error) {
    console.error('Error updating agent usage:', error);
  }
}

/**
 * Reset all agent usage counts for a brand
 */
export async function resetAgentUsage(brand: Brand): Promise<void> {
  if (!db) return;

  try {
    const q = query(
      collection(db, AGENT_USAGE_COLLECTION),
      where('brand', '==', brand)
    );

    const snapshot = await getDocs(q);

    for (const docSnap of snapshot.docs) {
      await updateDoc(docSnap.ref, {
        usageCount: 0,
        lastUsedAt: null,
      });
    }

    console.log(`🔄 Agent usage reset for brand: ${brand}`);
  } catch (error) {
    console.error('Error resetting agent usage:', error);
  }
}

// ============================================================================
// Agent Selection
// ============================================================================

/**
 * Select an agent for video generation
 *
 * @param brand - The brand generating the video
 * @param options - Selection options
 * @returns Selected agent or null if none available
 */
export async function selectAgent(
  brand: Brand,
  options: AgentSelectionOptions = {}
): Promise<HeyGenAgent | null> {
  const {
    mode = 'round-robin',
    specificAgentId,
    language,
    excludeAgentIds = [],
    preferExpressive = true,
  } = options;

  console.log(`🤖 Selecting agent for ${brand} (mode: ${mode}, language: ${language || 'any'})`);

  // Handle specific agent request
  if (mode === 'specific' && specificAgentId) {
    const agent = getAgentById(specificAgentId);
    if (agent && agent.isActive && agent.brands.includes(brand)) {
      console.log(`   ✅ Using specific agent: ${agent.name}`);
      await incrementAgentUsage(agent.id, brand);
      return agent;
    }
    console.warn(`   ⚠️  Specific agent ${specificAgentId} not available, falling back to round-robin`);
  }

  // Handle primary agent request
  if (mode === 'primary') {
    const primary = getPrimaryAgentForBrand(brand);
    if (primary) {
      // If language specified, check it matches
      if (!language || primary.voiceLanguage === language || primary.voiceLanguage === 'both') {
        console.log(`   ✅ Using primary agent: ${primary.name}`);
        await incrementAgentUsage(primary.id, brand);
        return primary;
      }
    }
    console.warn(`   ⚠️  Primary agent not available for ${language || 'any'} language, falling back to round-robin`);
  }

  // Get eligible agents
  let eligibleAgents = language
    ? getAgentsByLanguage(language, brand)
    : getAgentsForBrand(brand);

  // Filter out excluded agents
  if (excludeAgentIds.length > 0) {
    eligibleAgents = eligibleAgents.filter(a => !excludeAgentIds.includes(a.id));
  }

  // If no eligible agents, return null
  if (eligibleAgents.length === 0) {
    console.error(`   ❌ No eligible agents found for ${brand} (language: ${language || 'any'})`);
    return null;
  }

  // If only one eligible agent, use it
  if (eligibleAgents.length === 1) {
    const agent = eligibleAgents[0];
    console.log(`   ✅ Only one eligible agent: ${agent.name}`);
    await incrementAgentUsage(agent.id, brand);
    return agent;
  }

  // Handle random selection
  if (mode === 'random') {
    const randomIndex = Math.floor(Math.random() * eligibleAgents.length);
    const agent = eligibleAgents[randomIndex];
    console.log(`   🎲 Randomly selected: ${agent.name}`);
    await incrementAgentUsage(agent.id, brand);
    return agent;
  }

  // Round-robin selection (default)
  const usageMap = await getAllAgentUsage(brand);

  // Add usage data to agents
  const agentsWithUsage = eligibleAgents.map(agent => {
    const usage = usageMap.get(agent.id);
    return {
      agent,
      usageCount: usage?.usageCount || 0,
      lastUsedAt: usage?.lastUsedAt || 0,
    };
  });

  // Sort by usage count (ascending) then by last used (ascending)
  agentsWithUsage.sort((a, b) => {
    if (a.usageCount !== b.usageCount) {
      return a.usageCount - b.usageCount;
    }
    return a.lastUsedAt - b.lastUsedAt;
  });

  // Optionally prefer expressive agents when counts are equal
  if (preferExpressive) {
    // Among agents with lowest usage count, prefer expressive ones
    const lowestCount = agentsWithUsage[0].usageCount;
    const lowestCountAgents = agentsWithUsage.filter(a => a.usageCount === lowestCount);

    const expressiveAgents = lowestCountAgents.filter(
      a => a.agent.avatar.talkingStyle === 'expressive'
    );

    if (expressiveAgents.length > 0) {
      const selected = expressiveAgents[0].agent;
      console.log(`   ✅ Round-robin selected (expressive preferred): ${selected.name} (used ${lowestCount} times)`);
      await incrementAgentUsage(selected.id, brand);
      return selected;
    }
  }

  // Select agent with lowest usage
  const selected = agentsWithUsage[0].agent;
  console.log(`   ✅ Round-robin selected: ${selected.name} (used ${agentsWithUsage[0].usageCount} times)`);
  await incrementAgentUsage(selected.id, brand);
  return selected;
}

/**
 * Get agent statistics for a brand
 */
export async function getAgentStats(brand: Brand): Promise<{
  totalAgents: number;
  activeAgents: number;
  usage: Array<{ agent: HeyGenAgent; usageCount: number; lastUsedAt: number }>;
}> {
  const allAgents = HEYGEN_AGENTS.filter(a => a.brands.includes(brand));
  const activeAgents = allAgents.filter(a => a.isActive);
  const usageMap = await getAllAgentUsage(brand);

  const usage = allAgents.map(agent => {
    const record = usageMap.get(agent.id);
    return {
      agent,
      usageCount: record?.usageCount || 0,
      lastUsedAt: record?.lastUsedAt || 0,
    };
  }).sort((a, b) => b.usageCount - a.usageCount);

  return {
    totalAgents: allAgents.length,
    activeAgents: activeAgents.length,
    usage,
  };
}

/**
 * Preview agent selection without incrementing usage
 * Useful for debugging and admin UI
 */
export async function previewAgentSelection(
  brand: Brand,
  options: AgentSelectionOptions = {}
): Promise<{
  selectedAgent: HeyGenAgent | null;
  eligibleAgents: Array<{ agent: HeyGenAgent; usageCount: number }>;
  reason: string;
}> {
  const { language } = options;

  let eligibleAgents = language
    ? getAgentsByLanguage(language, brand)
    : getAgentsForBrand(brand);

  if (options.excludeAgentIds) {
    eligibleAgents = eligibleAgents.filter(a => !options.excludeAgentIds!.includes(a.id));
  }

  const usageMap = await getAllAgentUsage(brand);

  const agentsWithUsage = eligibleAgents.map(agent => ({
    agent,
    usageCount: usageMap.get(agent.id)?.usageCount || 0,
  })).sort((a, b) => a.usageCount - b.usageCount);

  if (agentsWithUsage.length === 0) {
    return {
      selectedAgent: null,
      eligibleAgents: [],
      reason: `No eligible agents for ${brand} with language ${language || 'any'}`,
    };
  }

  return {
    selectedAgent: agentsWithUsage[0].agent,
    eligibleAgents: agentsWithUsage,
    reason: `Would select ${agentsWithUsage[0].agent.name} (used ${agentsWithUsage[0].usageCount} times)`,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  selectAgent,
  incrementAgentUsage,
  resetAgentUsage,
  getAgentStats,
  previewAgentSelection,
};
