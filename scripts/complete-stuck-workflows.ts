/**
 * Manually complete stuck workflows using HeyGen video IDs
 * This bypasses the broken process-video endpoint
 */

// Failed workflows from the UI (you provided these)
const FAILED_WORKFLOWS = [
  {
    title: 'Seattle median list price at $850K even as price cuts spread',
    heygenId: 'ea2b1c305ed5',
    submagicId: 'ecc596ca-7a8',
    getLateId: '6915041d7515',
    brand: 'ownerfi',
    age: '49m'
  },
  {
    title: 'Trump Proposes 50-Year Mortgages: Potential Benefits and Drawbacks for Homebuyers',
    heygenId: '8c3562e8a4ac',
    submagicId: '8450a822-741',
    getLateId: '691507d05882',
    brand: 'ownerfi',
    age: '19m'
  },
  {
    title: '1298 Gideons Dr Sw Atlanta, GA',
    heygenId: '581591dc4861',
    submagicId: 'e24d9d8a-be1',
    getLateId: '691503f65882',
    brand: 'property',
    age: '39m'
  },
  {
    title: 'BAT Pauses Vuse One Vape Launch Amid FDA Scrutiny',
    heygenId: '4c846d03bddb',
    submagicId: '0b5d8f0f-dac',
    getLateId: '691507f07515',
    brand: 'vassdistro',
    age: '19m'
  },
  {
    title: 'From Broke to CEO',
    heygenId: '6e8190ccffbf',
    getLateId: '6914d5d54129',
    brand: 'abdullah',
    age: '4h'
  },
  {
    title: 'From Broke to CEO',
    heygenId: '0af331590948',
    getLateId: '6914d5d24129',
    brand: 'abdullah',
    age: '5h'
  }
];

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('   Complete Stuck Workflows Manually');
  console.log('═══════════════════════════════════════════\n');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

  for (const workflow of FAILED_WORKFLOWS) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔄 Processing: ${workflow.title}`);
    console.log(`   Brand: ${workflow.brand}`);
    console.log(`   HeyGen ID: ${workflow.heygenId}`);
    console.log(`   Age: ${workflow.age}`);

    try {
      // Fetch HeyGen video directly
      const heygenApiKey = process.env.HEYGEN_API_KEY;
      if (!heygenApiKey) {
        throw new Error('HEYGEN_API_KEY not found in environment');
      }

      console.log(`📥 Fetching HeyGen video...`);
      const heygenResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${workflow.heygenId}`, {
        headers: { 'X-Api-Key': heygenApiKey }
      });

      if (!heygenResponse.ok) {
        throw new Error(`HeyGen API failed: ${heygenResponse.status}`);
      }

      const heygenData = await heygenResponse.json();
      console.log(`   Status: ${heygenData.data?.status}`);

      const videoUrl = heygenData.data?.video_url;
      if (!videoUrl) {
        console.log(`⚠️  No video URL available yet - skipping`);
        continue;
      }

      console.log(`✅ Video URL obtained: ${videoUrl.substring(0, 60)}...`);

      // Now trigger complete-viral endpoint to finish the workflow
      console.log(`📤 Sending to Submagic...`);

      const completeResponse = await fetch(`${baseUrl}/api/workflow/complete-viral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: workflow.brand,
          videoUrl,
          heygenVideoId: workflow.heygenId,
          articleTitle: workflow.title,
        })
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Complete-viral failed: ${errorData.error || completeResponse.statusText}`);
      }

      const result = await completeResponse.json();
      console.log(`✅ SUCCESS:`, result);

    } catch (error) {
      console.error(`❌ ERROR:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n✅ Processing complete!`);
}

main().catch(console.error);
