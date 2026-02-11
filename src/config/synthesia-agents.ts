/**
 * Synthesia Agent Configuration System
 *
 * 3 avatars rotating across all brands via round-robin.
 * All confirmed working via live API test (Feb 2026).
 * Using avatar default voices and default backgrounds.
 */

import { Brand } from './constants';

export interface SynthesiaAgent {
  id: string;
  name: string;
  avatarId: string;
  voiceId?: string; // UUID — omit to use avatar's default voice
  brands: Brand[];
  isActive: boolean;
}

const ALL_BRANDS: Brand[] = ['ownerfi', 'carz', 'benefit', 'personal', 'abdullah', 'realtors', 'gaza'];

export const SYNTHESIA_AGENTS: SynthesiaAgent[] = [
  {
    id: 'synthesia-1',
    name: 'Synthesia Avatar 1',
    avatarId: 'a4ec11ca-f2f7-41e7-b9fe-f77b64e94fbe',
    brands: ALL_BRANDS,
    isActive: true,
  },
  {
    id: 'synthesia-2',
    name: 'Synthesia Avatar 2',
    avatarId: 'b78cab87-5f8b-45d0-8c4b-b96c82c770af',
    brands: ALL_BRANDS,
    isActive: true,
  },
  {
    id: 'synthesia-3',
    name: 'Synthesia Avatar 3',
    avatarId: '2cd8bfce-6be9-4922-b508-e1194bc49731',
    brands: ALL_BRANDS,
    isActive: true,
  },
];

let roundRobinIndex = 0;

export function getSynthesiaAgentForBrand(brand: Brand): SynthesiaAgent {
  const agents = SYNTHESIA_AGENTS.filter(a => a.isActive && a.brands.includes(brand));

  if (agents.length === 0) {
    const fallback = SYNTHESIA_AGENTS.find(a => a.isActive);
    if (!fallback) throw new Error('No active Synthesia agents configured');
    return fallback;
  }

  const agent = agents[roundRobinIndex % agents.length];
  roundRobinIndex++;
  return agent;
}

export function buildSynthesiaClipConfig(agent: SynthesiaAgent, scriptText: string) {
  return {
    avatarId: agent.avatarId,
    scriptText,
    ...(agent.voiceId ? { voiceId: agent.voiceId } : {}),
  };
}
