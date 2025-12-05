// Test that podcast imports work correctly
import { config } from 'dotenv';
config({ path: '.env.local' });

async function test() {
  console.log('Testing podcast module imports...\n');

  try {
    // Test 1: Import PodcastScheduler
    console.log('1. Testing PodcastScheduler import...');
    const podcastSchedulerModule = await import('../podcast/lib/podcast-scheduler');
    const PodcastScheduler = podcastSchedulerModule.default?.PodcastScheduler || podcastSchedulerModule.PodcastScheduler;

    if (typeof PodcastScheduler !== 'function') {
      throw new Error(`PodcastScheduler is not a function, got: ${typeof PodcastScheduler}`);
    }
    console.log('   ✅ PodcastScheduler imported successfully');

    // Test 2: Import ScriptGenerator
    console.log('2. Testing ScriptGenerator import...');
    const scriptGeneratorModule = await import('../podcast/lib/script-generator');
    const ScriptGenerator = scriptGeneratorModule.default?.ScriptGenerator || scriptGeneratorModule.default || scriptGeneratorModule.ScriptGenerator;

    if (typeof ScriptGenerator !== 'function') {
      throw new Error(`ScriptGenerator is not a function, got: ${typeof ScriptGenerator}`);
    }
    console.log('   ✅ ScriptGenerator imported successfully');

    // Test 3: Instantiate PodcastScheduler
    console.log('3. Testing PodcastScheduler instantiation...');
    const scheduler = new PodcastScheduler();
    console.log('   ✅ PodcastScheduler instantiated');

    // Test 4: Load state from Firestore
    console.log('4. Testing Firestore state loading...');
    await scheduler.loadStateFromFirestore();
    console.log('   ✅ State loaded from Firestore');

    // Test 5: Get stats
    console.log('5. Getting scheduler stats...');
    const stats = scheduler.getStats();
    console.log('   Stats:', JSON.stringify(stats, null, 2));

    // Test 6: Check if should generate
    console.log('6. Checking if should generate episode...');
    const shouldGenerate = scheduler.shouldGenerateEpisode();
    console.log(`   Should generate: ${shouldGenerate}`);

    console.log('\n🎉 All tests passed! Podcast system is functional.');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

test();
