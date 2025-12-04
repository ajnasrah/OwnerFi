// Test Script Generation with GPT-4
require('dotenv').config({ path: '.env.local' });

// Import using require since we're in .js file
async function testScriptGeneration() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║         PODCAST SCRIPT GENERATION TEST                         ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Dynamically import the ES module
  const { ScriptGenerator } = await import('../lib/script-generator.ts');

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in .env.local');
    process.exit(1);
  }

  try {
    const generator = new ScriptGenerator(OPENAI_API_KEY);

    console.log('📋 Step 1: Listing available guests...\n');
    const guests = generator.listGuests();
    console.log(`Found ${guests.length} guest profiles:`);
    guests.forEach((guest, i) => {
      console.log(`   ${i + 1}. ${guest.name} - ${guest.title}`);
    });

    console.log('\n📝 Step 2: Generating random podcast script...\n');
    const script = await generator.generateScript();

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    GENERATED SCRIPT                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log(`Episode Title: ${script.episode_title}`);
    console.log(`Guest: ${script.guest_name}`);
    console.log(`Topic: ${script.topic}`);
    console.log(`Estimated Duration: ${script.estimated_duration_seconds}s (${Math.ceil(script.estimated_duration_seconds / 60)} min)\n`);

    console.log('Q&A Pairs:\n');
    script.qa_pairs.forEach((pair, i) => {
      console.log(`${i + 1}. Q: ${pair.question}`);
      console.log(`   A: ${pair.answer}\n`);
    });

    console.log('✅ Script generation successful!\n');

    // Test specific guest
    console.log('📝 Step 3: Generating script for specific guest (doctor)...\n');
    const doctorScript = await generator.generateScript('doctor', 3);

    console.log(`Episode Title: ${doctorScript.episode_title}`);
    console.log(`Questions: ${doctorScript.qa_pairs.length}\n`);

    console.log('✅ Specific guest script generation successful!\n');

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST COMPLETE!                              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. OPENAI_API_KEY is set in .env.local');
    console.log('   2. guest-profiles.json exists in podcast/config/');
    console.log('   3. OpenAI API has credits available');
    process.exit(1);
  }
}

testScriptGeneration();
