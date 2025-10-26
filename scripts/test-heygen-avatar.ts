/**
 * Test HeyGen Avatar ID
 * Usage: npx tsx scripts/test-heygen-avatar.ts <avatar_id>
 */

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

if (!HEYGEN_API_KEY) {
  console.error('❌ HEYGEN_API_KEY not found in environment');
  process.exit(1);
}

const avatarId = process.argv[2];

if (!avatarId) {
  console.error('❌ Usage: npx tsx scripts/test-heygen-avatar.ts <avatar_id>');
  console.error('\nExample: npx tsx scripts/test-heygen-avatar.ts 31c6b2b6306b47a2ba3572a23be09dbc');
  process.exit(1);
}

async function testAvatar() {
  console.log(`🔍 Testing HeyGen avatar ID: ${avatarId}\n`);

  try {
    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': HEYGEN_API_KEY!,
      },
      body: JSON.stringify({
        test: true, // Test mode - doesn't generate actual video
        video_inputs: [{
          character: {
            type: 'talking_photo',
            talking_photo_id: avatarId,
            scale: 1.4,
            talking_photo_style: 'square'
          },
          voice: {
            type: 'text',
            input_text: 'Test message',
            voice_id: '9070a6c2dbd54c10bb111dc8c655bff7'
          }
        }],
        dimension: { width: 1080, height: 1920 }
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Avatar ID is VALID!');
      console.log(`📹 Test video ID: ${data.data?.video_id || 'N/A'}`);
      console.log('\nYou can use this avatar ID in your .env.local:');
      console.log(`BENEFIT_AVATAR_ID=${avatarId}`);
    } else {
      console.error('❌ Avatar ID is INVALID or error occurred:');
      console.error(JSON.stringify(data, null, 2));

      if (data.error?.code === 'photar_not_found') {
        console.error('\n💡 This avatar ID does not exist in your HeyGen account.');
        console.error('   Visit https://app.heygen.com/avatars to see your available avatars.');
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

testAvatar();
