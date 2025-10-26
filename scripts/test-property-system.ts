/**
 * Test Property Video System End-to-End
 * Usage: node --env-file=.env.local -r tsx/register scripts/test-property-system.ts
 */

async function testPropertySystem() {
  console.log('🏡 Property Video System Test\n');
  console.log('='.repeat(60));

  // Check 1: Environment Variables
  console.log('\n1. Checking Environment Variables...');
  const requiredVars = [
    'HEYGEN_API_KEY',
    'OPENAI_API_KEY',
    'NEXT_PUBLIC_BASE_URL'
  ];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value) {
      console.log(`   ✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`   ❌ ${varName}: Not set`);
    }
  }

  // Check 2: List HeyGen Avatars
  console.log('\n2. Listing HeyGen Avatars...');
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  if (!HEYGEN_API_KEY) {
    console.log('   ❌ HEYGEN_API_KEY not configured');
  } else {
    try {
      const response = await fetch('https://api.heygen.com/v2/avatars', {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': HEYGEN_API_KEY
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Found ${data.data?.avatars?.length || 0} avatars`);

        // List talking photos
        const talkingPhotos = data.data?.avatars?.filter((a: any) =>
          a.avatar_type === 'talking_photo'
        ) || [];

        console.log(`   📸 Talking Photos: ${talkingPhotos.length}`);
        talkingPhotos.slice(0, 5).forEach((avatar: any) => {
          console.log(`      - ${avatar.avatar_name}: ${avatar.avatar_id}`);
        });
      } else {
        console.log(`   ❌ API Error: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error}`);
    }
  }

  // Check 3: Property Queue Status
  console.log('\n3. Checking Property Queue Status...');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${baseUrl}/api/property/populate-queue`);
    const data = await response.json();

    if (data.success) {
      console.log(`   ✅ Queue Status:`);
      console.log(`      Total: ${data.stats?.total || 0} properties`);
      console.log(`      Queued: ${data.stats?.queued || 0}`);
      console.log(`      Processing: ${data.stats?.processing || 0}`);
      console.log(`      Rotation Days: ${data.rotationDays || 0}`);

      if (data.stats?.nextProperty) {
        console.log(`      Next: ${data.stats.nextProperty.address}`);
      }
    } else {
      console.log(`   ⚠️  Queue: ${data.message}`);
    }
  } catch (error) {
    console.log(`   ❌ Failed to check queue: ${error}`);
  }

  // Check 4: Property Video Workflows
  console.log('\n4. Checking Recent Property Video Workflows...');

  try {
    const response = await fetch(`${baseUrl}/api/property/workflows/logs`);
    const data = await response.json();

    if (data.success) {
      console.log(`   ✅ Found ${data.workflows?.length || 0} workflows`);

      if (data.workflows && data.workflows.length > 0) {
        console.log('\n   Recent Workflows:');
        data.workflows.slice(0, 3).forEach((w: any, i: number) => {
          console.log(`   ${i + 1}. ${w.address || 'Unknown'}`);
          console.log(`      Status: ${w.status}`);
          console.log(`      Created: ${new Date(w.createdAt).toLocaleString()}`);
          if (w.error) {
            console.log(`      Error: ${w.error}`);
          }
        });
      }
    } else {
      console.log(`   ⚠️  ${data.error || 'Failed to fetch workflows'}`);
    }
  } catch (error) {
    console.log(`   ❌ Failed to check workflows: ${error}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ System check complete!\n');
}

testPropertySystem().catch(console.error);
