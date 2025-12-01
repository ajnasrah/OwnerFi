/**
 * Test Agent Selection System
 * Verifies the round-robin agent selection and HeyGen configuration
 */

import 'dotenv/config';
import { selectAgent, previewAgentSelection, getAgentStats } from '../src/lib/agent-selector';
import { HEYGEN_AGENTS, buildCharacterConfig, buildVoiceConfig } from '../src/config/heygen-agents';

async function main() {
  console.log('\n🤖 Testing HeyGen Agent Selection System\n');
  console.log('='.repeat(60));

  // Show all configured agents
  console.log('\n📋 CONFIGURED AGENTS:\n');
  HEYGEN_AGENTS.forEach((agent, i) => {
    const status = agent.isActive ? '✅' : '❌';
    const primary = agent.isPrimary ? ' (PRIMARY)' : '';
    console.log(`${i + 1}. ${status} ${agent.name}${primary}`);
    console.log(`   ID: ${agent.id}`);
    console.log(`   Avatar: ${agent.avatar.avatarType} - ${agent.avatar.avatarId.substring(0, 20)}...`);
    console.log(`   Scale: ${agent.avatar.scale}`);
    console.log(`   Voice: ${agent.voice.voiceId.substring(0, 20)}...`);
    console.log(`   Emotion: ${agent.voice.emotion || 'none'}`);
    console.log(`   Language: ${agent.voiceLanguage}`);
    console.log(`   Brands: ${agent.brands.join(', ')}`);
    console.log('');
  });

  // Preview selection for benefit brand
  console.log('='.repeat(60));
  console.log('\n🎯 AGENT SELECTION PREVIEW (benefit brand):\n');

  const preview = await previewAgentSelection('benefit', { language: 'en' });

  if (preview.selectedAgent) {
    console.log(`Would select: ${preview.selectedAgent.name}`);
    console.log(`Reason: ${preview.reason}`);
  } else {
    console.log('No agent available!');
    console.log(`Reason: ${preview.reason}`);
  }

  console.log('\nEligible agents (sorted by usage):');
  preview.eligibleAgents.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.agent.name} - used ${item.usageCount} times`);
  });

  // Get usage stats
  console.log('\n='.repeat(60));
  console.log('\n📊 USAGE STATS:\n');

  const stats = await getAgentStats('benefit');
  console.log(`Total agents: ${stats.totalAgents}`);
  console.log(`Active agents: ${stats.activeAgents}`);
  console.log('\nUsage by agent:');
  stats.usage.forEach(item => {
    const lastUsed = item.lastUsedAt
      ? new Date(item.lastUsedAt).toLocaleString()
      : 'never';
    console.log(`  ${item.agent.name}: ${item.usageCount} uses (last: ${lastUsed})`);
  });

  // Test actual selection (this will increment usage)
  console.log('\n='.repeat(60));
  console.log('\n🎲 TESTING ACTUAL SELECTION:\n');

  const selectedAgent = await selectAgent('benefit', {
    mode: 'round-robin',
    language: 'en',
  });

  if (selectedAgent) {
    console.log(`Selected: ${selectedAgent.name}`);
    console.log(`ID: ${selectedAgent.id}`);

    // Build the HeyGen request configs
    console.log('\n📤 HeyGen Request Configuration:');

    const characterConfig = buildCharacterConfig(selectedAgent, 'vertical');
    console.log('\nCharacter config:');
    console.log(JSON.stringify(characterConfig, null, 2));

    const voiceConfig = buildVoiceConfig(selectedAgent, 'Test script here');
    console.log('\nVoice config:');
    console.log(JSON.stringify(voiceConfig, null, 2));
  } else {
    console.log('❌ No agent selected!');
  }

  console.log('\n='.repeat(60));
  console.log('\n✅ Test complete!\n');
}

main().catch(console.error);
