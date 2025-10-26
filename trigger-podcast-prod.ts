#!/usr/bin/env npx tsx
// Trigger podcast generation on production (via dashboard endpoint)

async function triggerPodcast() {
  console.log('🎙️ Triggering Podcast Generation on Production\n');

  try {
    const baseUrl = 'https://ownerfi.ai';
    const url = `${baseUrl}/api/podcast/cron?force=true`;

    console.log(`📡 Calling: ${url}\n`);

    // Call via POST (same as dashboard button)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`Status: ${response.status} ${response.statusText}\n`);

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ Podcast generation started!');
      if (data.episode) {
        console.log(`   Episode: #${data.episode.number}`);
        console.log(`   Title: ${data.episode.title}`);
        console.log(`   Guest: ${data.episode.guest}`);
        console.log(`   Video ID: ${data.episode.video_id}`);
        console.log(`   Workflow ID: ${data.episode.workflow_id}`);
      }
      console.log('\n📊 Monitor progress at: https://ownerfi.ai/admin/social-dashboard');
    } else if (data.skipped) {
      console.log('\n⏭️  Episode generation skipped (not time yet)');
      if (data.stats) {
        console.log('   Stats:', JSON.stringify(data.stats, null, 2));
      }
    } else {
      console.error('\n❌ Podcast generation failed:', data.error);
      if (data.details) {
        console.error('   Details:', data.details);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

triggerPodcast();
