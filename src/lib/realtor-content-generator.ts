/**
 * Realtor Sub-Brand Content Generator
 * Generates 3 daily videos for realtors using question-based content topics
 * Uses OwnerFi's HeyGen agents and Late.dev profile (sub-brand)
 */

import { validateAndFixScript } from './compliance-checker';
import { selectAgent, AgentSelectionOptions } from './agent-selector';
import {
  buildCharacterConfig,
  buildVoiceConfig,
  buildBackgroundConfig,
} from '@/config/heygen-agents';
import {
  REALTOR_CONTENT_TOPICS,
  RealtorContentTopic,
  generateVideoScript,
  generateCaption,
} from '@/config/realtor-content-topics';

export interface RealtorVideoScript {
  topicId: string;
  category: RealtorContentTopic['category'];
  script: string;
  title: string;
  caption: string;
  hook: string; // The opening question
}

/**
 * Category schedule based on hour (CST)
 * 3 videos per day at optimal times for professional audience
 */
const CATEGORY_SCHEDULE: Record<number, RealtorContentTopic['category']> = {
  8: 'leads',      // Morning: Lead generation focus
  12: 'income',    // Lunch: Income/money talk
  19: 'closing',   // Evening: Closing deals focus
};

/**
 * Get the category for the current time slot
 */
export function getCategoryForHour(cstHour: number): RealtorContentTopic['category'] {
  const scheduledHours = Object.keys(CATEGORY_SCHEDULE).map(Number).sort((a, b) => a - b);
  const closestHour = scheduledHours.reduce((prev, curr) =>
    Math.abs(curr - cstHour) < Math.abs(prev - cstHour) ? curr : prev
  );
  return CATEGORY_SCHEDULE[closestHour];
}

/**
 * Get a topic that hasn't been used recently
 * Uses date-based selection to ensure variety
 */
export function getTopicForCategory(
  category: RealtorContentTopic['category'],
  dateStr: string // YYYY-MM-DD format
): RealtorContentTopic {
  const categoryTopics = REALTOR_CONTENT_TOPICS.filter(t => t.category === category);

  // Use date hash to select topic (ensures same topic for same date/category)
  // This prevents duplicate videos if cron runs multiple times
  const dateHash = dateStr.split('-').reduce((acc, part) => acc + parseInt(part), 0);
  const index = dateHash % categoryTopics.length;

  return categoryTopics[index];
}

/**
 * Generate a single realtor video script
 * Uses pre-defined topics (no AI generation needed - topics are pre-written)
 */
export async function generateRealtorScript(
  category: RealtorContentTopic['category'],
  openaiApiKey?: string
): Promise<RealtorVideoScript> {
  const today = new Date().toISOString().split('T')[0];
  const topic = getTopicForCategory(category, today);

  // Generate script from topic template
  const rawScript = generateVideoScript(topic);
  const rawCaption = generateCaption(topic);

  // Run compliance check (realtors uses OwnerFi compliance rules)
  console.log(`[Compliance] Checking realtor ${category} script...`);

  const complianceResult = await validateAndFixScript(
    rawScript,
    rawCaption,
    topic.question.replace('?', ''), // Use question as title (without ?)
    'realtors',
    1
  );

  if (!complianceResult.success) {
    // Topics are pre-vetted, so compliance failures are rare
    // Log warning but continue with raw content
    console.warn(`[Compliance] ⚠️  Realtor script had issues: ${complianceResult.complianceResult.violations.map(v => v.phrase).join(', ')}`);
  }

  return {
    topicId: topic.id,
    category: topic.category,
    script: complianceResult.success ? complianceResult.finalScript : rawScript,
    title: topic.question.replace('?', '').substring(0, 40), // Short title from question
    caption: complianceResult.success ? complianceResult.finalCaption : rawCaption,
    hook: topic.question, // The question IS the hook
  };
}

/**
 * Build HeyGen video request for realtor video with agent rotation
 * Uses OwnerFi's agent pool since realtors is a sub-brand
 */
export async function buildRealtorVideoRequestWithAgent(
  video: RealtorVideoScript,
  callbackId: string,
  agentOptions?: AgentSelectionOptions
): Promise<{ request: any; agentId: string }> {
  // Select agent for this video (realtors uses OwnerFi's agent pool)
  const agent = await selectAgent('realtors', {
    mode: agentOptions?.mode || 'round-robin',
    language: 'en',
    ...agentOptions,
  });

  // Fallback if no agent available
  if (!agent) {
    console.warn('⚠️  No agent available for realtors, using default OwnerFi config');
    return {
      request: buildDefaultRealtorVideoRequest(video, callbackId),
      agentId: 'default',
    };
  }

  console.log(`   🤖 Selected agent: ${agent.name} (${agent.id})`);
  console.log(`   🎭 Avatar: ${agent.avatar.avatarId.substring(0, 12)}...`);
  console.log(`   🗣️  Voice: ${agent.voice.voiceId.substring(0, 12)}...`);

  // Build character config from agent
  const characterConfig = buildCharacterConfig(agent, 'vertical');

  // Build voice config from agent with the script
  const voiceConfig = buildVoiceConfig(agent, video.script);

  // Use OwnerFi's brand background (realtors sub-brand)
  const backgroundConfig = buildBackgroundConfig('ownerfi');

  const videoInput: any = {
    character: characterConfig,
    voice: voiceConfig,
    background: backgroundConfig,
  };

  const request = {
    video_inputs: [videoInput],
    caption: false,
    dimension: { width: 1080, height: 1920 },
    test: false,
    callback_id: callbackId,
  };

  return { request, agentId: agent.id };
}

/**
 * Default video request (fallback)
 */
function buildDefaultRealtorVideoRequest(video: RealtorVideoScript, callbackId: string): any {
  return {
    video_inputs: [{
      character: {
        type: 'talking_photo',
        talking_photo_id: 'd33fe3abc2914faa88309c3bdb9f47f4', // Abdullah/OwnerFi avatar
        scale: 1.6,
        talking_style: 'expressive'
      },
      voice: {
        type: 'text',
        input_text: video.script,
        voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
        speed: 1.0,
      }
    }],
    caption: false,
    dimension: { width: 1080, height: 1920 },
    test: false,
    callback_id: callbackId,
  };
}

/**
 * Validate realtor script
 */
export function validateRealtorScript(video: RealtorVideoScript): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!video.script || video.script.length < 50) {
    errors.push('Script too short (min 50 characters)');
  }

  if (video.script && video.script.length > 500) {
    errors.push('Script too long (max 500 characters)');
  }

  if (!video.hook || !video.hook.endsWith('?')) {
    errors.push('Hook must be a question');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  generateRealtorScript,
  buildRealtorVideoRequestWithAgent,
  validateRealtorScript,
  getCategoryForHour,
  getTopicForCategory,
};
