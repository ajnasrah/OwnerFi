/**
 * List HeyGen Public Avatars with Backgrounds
 * Find avatars suitable for podcasts (sitting at desk, office settings)
 */

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

if (!HEYGEN_API_KEY) {
  console.error('❌ HEYGEN_API_KEY not set');
  process.exit(1);
}

async function listAvatars() {
  console.log('🔍 Fetching HeyGen public avatars...\n');

  try {
    const response = await fetch('https://api.heygen.com/v2/avatars', {
      headers: {
        'x-api-key': HEYGEN_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`HeyGen API error: ${response.status}`);
    }

    const data = await response.json();
    const publicAvatars = data.data?.public_avatars || [];

    console.log(`📊 Found ${publicAvatars.length} public avatars\n`);

    // Filter for avatars that look like they're sitting or have professional backgrounds
    const keywords = ['sitting', 'desk', 'office', 'business', 'professional', 'front', 'studio', 'podcast'];

    const suitableAvatars = publicAvatars.filter((avatar: any) => {
      const name = avatar.avatar_name?.toLowerCase() || '';
      return keywords.some(keyword => name.includes(keyword));
    });

    console.log(`✅ Found ${suitableAvatars.length} avatars with sitting/desk/office/business keywords:\n`);

    suitableAvatars.forEach((avatar: any, index: number) => {
      console.log(`${index + 1}. ${avatar.avatar_id}`);
      console.log(`   Name: ${avatar.avatar_name}`);
      console.log(`   Preview: ${avatar.preview_image_url || 'N/A'}`);
      console.log();
    });

    // Specifically look for male avatars for tech expert
    console.log('\n🔍 Male avatars suitable for tech expert:\n');
    const maleAvatars = suitableAvatars.filter((avatar: any) => {
      const name = avatar.avatar_name?.toLowerCase() || '';
      return (
        // Common male names or indicators
        name.includes('vince') ||
        name.includes('brandon') ||
        name.includes('byron') ||
        name.includes('james') ||
        name.includes('john') ||
        name.includes('mike') ||
        name.includes('david') ||
        name.includes('alex') ||
        name.includes('man') ||
        (name.includes('business') && !name.includes('caroline') && !name.includes('ann'))
      );
    });

    maleAvatars.slice(0, 10).forEach((avatar: any, index: number) => {
      console.log(`${index + 1}. ${avatar.avatar_id}`);
      console.log(`   Name: ${avatar.avatar_name}`);
      console.log();
    });

    // Specifically look for female avatars for fitness trainer
    console.log('\n🔍 Female avatars suitable for fitness trainer:\n');
    const femaleAvatars = suitableAvatars.filter((avatar: any) => {
      const name = avatar.avatar_name?.toLowerCase() || '';
      return (
        name.includes('oxana') ||
        name.includes('caroline') ||
        name.includes('ann') ||
        name.includes('sophia') ||
        name.includes('emily') ||
        name.includes('woman') ||
        (name.includes('business') && (name.includes('caroline') || name.includes('ann')))
      );
    });

    femaleAvatars.slice(0, 10).forEach((avatar: any, index: number) => {
      console.log(`${index + 1}. ${avatar.avatar_id}`);
      console.log(`   Name: ${avatar.avatar_name}`);
      console.log();
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listAvatars();
