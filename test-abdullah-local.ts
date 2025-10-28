/**
 * Local test script for Abdullah content system
 * Tests script generation WITHOUT creating videos
 */

// Load environment variables
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function testAbdullahScriptGeneration() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTING ABDULLAH SCRIPT GENERATION');
  console.log('='.repeat(60) + '\n');

  // Import the generator directly
  const { generateAbdullahDailyContent, validateAbdullahScript } = await import('./src/lib/abdullah-content-generator');

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set in environment');
    process.exit(1);
  }

  console.log('✅ OPENAI_API_KEY found');
  console.log();

  // Generate 1 script for testing
  console.log('🤖 Generating 1 test script...');
  const result = await generateAbdullahDailyContent(OPENAI_API_KEY, new Date());

  const script = result.videos[0]; // Get first video only

  console.log();
  console.log('='.repeat(60));
  console.log('📝 GENERATED SCRIPT');
  console.log('='.repeat(60));
  console.log();
  console.log(`Theme: ${script.theme}`);
  console.log(`Title: ${script.title}`);
  console.log(`Title Length: ${script.title.length} chars (max 45)`);
  console.log();
  console.log(`Script:`);
  console.log(script.script);
  console.log();
  console.log(`Word Count: ${script.script.split(' ').length} words (target 70-90)`);
  console.log();
  console.log(`Caption:`);
  console.log(script.caption);
  console.log();
  console.log(`Hashtags: ${script.hashtags.join(', ')}`);
  console.log();

  // Validate
  const validation = validateAbdullahScript(script);

  console.log('='.repeat(60));
  console.log('✅ VALIDATION');
  console.log('='.repeat(60));
  console.log();

  if (validation.valid) {
    console.log('✅ Script is VALID!');
  } else {
    console.log('❌ Script has ERRORS:');
    validation.errors.forEach(err => console.log(`   - ${err}`));
  }

  console.log();
  console.log('='.repeat(60));
  console.log('✅ TEST COMPLETE');
  console.log('='.repeat(60));
  console.log();

  console.log('Next steps:');
  console.log('1. Review the generated script above');
  console.log('2. If it looks good, run: npm run test-workflow');
  console.log('3. This will create 1 actual video end-to-end');
  console.log();

  return script;
}

testAbdullahScriptGeneration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ TEST FAILED:', error);
    console.error(error.stack);
    process.exit(1);
  });
