/**
 * Test Round-Robin Agent Selection
 */

import 'dotenv/config';
import { selectAgent, getAgentStats, resetAgentUsage } from '../src/lib/agent-selector';

async function main() {
  console.log('🔄 Testing Round-Robin Selection\n');

  // Reset usage first for clean test
  console.log('Resetting usage counts...');
  await resetAgentUsage('benefit');

  console.log('\nMaking 6 selections to test round-robin:\n');

  for (let i = 1; i <= 6; i++) {
    const agent = await selectAgent('benefit', { mode: 'round-robin', language: 'en' });
    if (agent) {
      console.log(`${i}. ${agent.name}`);
      console.log(`   Emotion: ${agent.voice.emotion}`);
      console.log(`   Scale: ${agent.avatar.scale}`);
      console.log(`   Type: ${agent.avatar.avatarType}`);
    }
  }

  console.log('\n--- Usage after 6 selections ---\n');
  const stats = await getAgentStats('benefit');
  stats.usage.forEach(item => {
    console.log(`  ${item.agent.name}: ${item.usageCount} uses`);
  });

  console.log('\n✅ Done!');
}

main().catch(console.error);
