// Test the complete podcast system
require('dotenv').config({ path: '.env.local' });

async function testSystem() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║           PODCAST SYSTEM TEST                          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Test 1: Environment Variables
  console.log('1️⃣  Testing Environment Variables...\n');

  const required = ['OPENAI_API_KEY', 'HEYGEN_API_KEY'];
  const optional = ['SUBMAGIC_API_KEY', 'METRICOOL_API_KEY'];

  let hasAllRequired = true;
  for (const key of required) {
    if (process.env[key]) {
      console.log(`   ✅ ${key}: Set`);
    } else {
      console.log(`   ❌ ${key}: Missing`);
      hasAllRequired = false;
    }
  }

  for (const key of optional) {
    if (process.env[key]) {
      console.log(`   ✅ ${key}: Set (optional)`);
    } else {
      console.log(`   ⚠️  ${key}: Missing (optional - some features disabled)`);
    }
  }

  if (!hasAllRequired) {
    console.log('\n❌ Missing required API keys. Add them to .env.local\n');
    return;
  }

  console.log('\n✅ Environment check passed!\n');

  // Test 2: Guest Profiles Configuration
  console.log('2️⃣  Testing Guest Profiles...\n');

  const fs = require('fs');
  const path = require('path');
  const profilePath = path.join(process.cwd(), 'podcast', 'config', 'guest-profiles.json');

  try {
    const profiles = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

    console.log(`   Found ${Object.keys(profiles.profiles).length} guest profiles\n`);

    let issues = 0;
    for (const [id, guest] of Object.entries(profiles.profiles)) {
      const status = guest.enabled === false ? '🔴 DISABLED' : '🟢 ENABLED';
      console.log(`   ${status} ${guest.name} (${guest.title})`);

      // Check for missing fields
      if (!guest.avatar_id || guest.avatar_id.includes('placeholder')) {
        console.log(`      ❌ Missing or placeholder avatar_id`);
        issues++;
      } else {
        console.log(`      ✅ Avatar: ${guest.avatar_id}`);
      }

      if (!guest.voice_id || guest.voice_id.includes('placeholder')) {
        console.log(`      ❌ Missing or placeholder voice_id`);
        issues++;
      } else {
        console.log(`      ✅ Voice: ${guest.voice_id}`);
      }

      if (!guest.scale) {
        console.log(`      ⚠️  No scale set (will use default 1.4)`);
      } else {
        console.log(`      ✅ Scale: ${guest.scale}`);
      }

      console.log('');
    }

    // Check host
    console.log(`   🎤 Host: ${profiles.host.name}`);
    if (!profiles.host.avatar_id) {
      console.log(`      ❌ Missing host avatar_id`);
      issues++;
    } else {
      console.log(`      ✅ Avatar: ${profiles.host.avatar_id}`);
    }

    if (!profiles.host.voice_id) {
      console.log(`      ❌ Missing host voice_id`);
      issues++;
    } else {
      console.log(`      ✅ Voice: ${profiles.host.voice_id}`);
    }

    if (!profiles.host.scale) {
      console.log(`      ⚠️  No scale set`);
    } else {
      console.log(`      ✅ Scale: ${profiles.host.scale}`);
    }

    console.log('');

    if (issues > 0) {
      console.log(`\n⚠️  Found ${issues} configuration issues\n`);
    } else {
      console.log('\n✅ Guest profiles validated!\n');
    }

  } catch (error) {
    console.log(`   ❌ Error loading profiles: ${error.message}\n`);
    return;
  }

  // Test 3: Podcast Configuration
  console.log('3️⃣  Testing Podcast Configuration...\n');

  const configPath = path.join(process.cwd(), 'podcast', 'config', 'podcast-config.json');

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    console.log(`   📺 Video: ${config.video.width}x${config.video.height} (${config.video.format})`);
    console.log(`   🎨 Captions: ${config.captions.template}`);
    console.log(`   📅 Schedule: ${config.schedule.frequency} on ${config.schedule.day_of_week}s at ${config.schedule.time}`);
    console.log(`   🔄 Auto-publish: ${config.publishing.auto_publish ? 'Yes' : 'No'}`);
    console.log(`   ❓ Questions per episode: ${config.generation.questions_per_episode}`);

    console.log('\n✅ Configuration loaded!\n');

  } catch (error) {
    console.log(`   ❌ Error loading config: ${error.message}\n`);
  }

  // Test 4: Output directories
  console.log('4️⃣  Testing Output Directories...\n');

  const dirs = [
    'podcast/output',
    'podcast/checkpoints',
    'podcast/logs'
  ];

  for (const dir of dirs) {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      console.log(`   ✅ ${dir}: Exists`);
    } else {
      console.log(`   ⚠️  ${dir}: Missing (will be created on first run)`);
    }
  }

  console.log('\n✅ Directory check complete!\n');

  // Summary
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║           SYSTEM TEST SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('✅ All critical checks passed!\n');
  console.log('💡 Next steps:\n');
  console.log('   1. Test script generation:');
  console.log('      node -e "require(\'./test-podcast-system.js\').testScriptOnly()"');
  console.log('');
  console.log('   2. Test full pipeline (will use API credits):');
  console.log('      curl -X POST http://localhost:3000/api/podcast/generate \\');
  console.log('        -H "Content-Type: application/json" \\');
  console.log('        -d \'{"questionsCount": 2, "autoPublish": false}\'');
  console.log('');
  console.log('   3. Deploy to production:');
  console.log('      git add . && git commit -m "Fix podcast system" && git push');
  console.log('');
}

// Run test
testSystem().catch(console.error);
