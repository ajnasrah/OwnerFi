// Test the webhook-based viral video workflow

async function testViralVideoWebhook() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║     VIRAL VIDEO WORKFLOW - WEBHOOK-BASED (NO POLLING)        ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('🎬 Testing Webhook-Based Viral Video Workflow\n');
  console.log('How it works:');
  console.log('  1. ✅ Submit request → Get workflow_id immediately');
  console.log('  2. 🔔 HeyGen sends webhook when video is ready');
  console.log('  3. 🔔 System automatically sends to Submagic');
  console.log('  4. 🔔 Submagic sends webhook when complete');
  console.log('  5. ✅ Poll status endpoint to check progress\n');

  const requestBody = {
    rss_url: 'https://www.motor1.com/rss/reviews/all/',
    auto_generate_script: true,
    talking_photo_id: '31c6b2b6306b47a2ba3572a23be09dbc',
    voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
    scale: 1.4,
    width: 1080,
    height: 1920,
    submagic_template: 'Hormozi 2',
    language: 'en'
  };

  console.log('📤 Request:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n🚀 Sending to: http://localhost:3000/api/workflow/viral-video-webhook\n');

  try {
    // Step 1: Start workflow
    const response = await fetch('http://localhost:3000/api/workflow/viral-video-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (!result.success) {
      console.log('\n❌ Error:', result.error || result.message);
      if (result.details) {
        console.log('   Details:', result.details);
      }
      return;
    }

    console.log('✅ Workflow started!\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('              WORKFLOW INITIATED                   ');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('📝 Workflow ID:', result.workflow_id);
    console.log('🎥 HeyGen Video ID:', result.heygen_video_id);
    console.log('📊 Status URL:', result.status_url);
    console.log('📝 Script:', result.script);

    console.log('\n⏳ Webhooks will handle the rest automatically!');
    console.log('   You can now close this script and check status later.\n');

    // Step 2: Poll status every 30 seconds
    console.log('🔍 Monitoring workflow status...\n');

    const workflowId = result.workflow_id;
    const statusUrl = result.status_url;
    const maxChecks = 20; // Check for up to 10 minutes (20 × 30s)

    for (let i = 0; i < maxChecks; i++) {
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds

      const statusResponse = await fetch(statusUrl);
      const status = await statusResponse.json();

      console.log(`[${new Date().toLocaleTimeString()}] Status: ${status.status}`);
      console.log(`   ${status.message}`);

      if (status.heygen_video_url && !status.final_video_url) {
        console.log(`   HeyGen Video: ${status.heygen_video_url}`);
      }

      if (status.status === 'complete') {
        console.log('\n🎉 SUCCESS! VIRAL VIDEO CREATED!\n');

        console.log('═══════════════════════════════════════════════════');
        console.log('                    RESULTS                        ');
        console.log('═══════════════════════════════════════════════════\n');

        console.log('📝 Script:');
        console.log('   ' + status.script + '\n');

        console.log('🎥 HeyGen Video (with zoom):');
        console.log('   Video ID:', status.heygen_video_id);
        console.log('   URL:', status.heygen_video_url);
        console.log('   Scale: 1.4 (zoomed in)\n');

        console.log('✨ Submagic Enhanced Video:');
        console.log('   Project ID:', status.submagic_project_id);
        console.log('   Final Video URL:', status.final_video_url);
        console.log('   Editor URL:', status.submagic_editor_url);

        console.log('\n📥 Download Videos:');
        console.log('   HeyGen (original):');
        console.log(`     curl -o "heygen_video.mp4" "${status.heygen_video_url}"`);
        console.log('   Submagic (viral-ready):');
        console.log(`     curl -o "viral_video.mp4" "${status.final_video_url}"`);

        console.log('\n✏️  Edit Further (Optional):');
        console.log('   Open in Submagic editor:', status.submagic_editor_url);

        console.log('\n🎯 Ready to Post:');
        console.log('   • Instagram Reels');
        console.log('   • TikTok');
        console.log('   • YouTube Shorts');
        console.log('   • Facebook Reels');

        console.log('\n💰 Benefits of Webhook Approach:');
        console.log('   • No constant polling = Less API calls');
        console.log('   • Get notified immediately when ready');
        console.log('   • More reliable and efficient');
        console.log('   • Can check status anytime via API');

        break;
      }

      if (status.status === 'failed') {
        console.log('\n❌ Workflow failed:', status.error);
        break;
      }
    }

    console.log('\n✅ Done monitoring. Check status anytime at:');
    console.log('   ' + statusUrl);

  } catch (error) {
    console.error('\n❌ Request failed:', error.message);

    console.log('\n🔍 Make sure:');
    console.log('   1. Dev server is running: npm run dev');
    console.log('   2. Endpoint exists at: src/app/api/workflow/viral-video-webhook/route.ts');
    console.log('   3. Webhook endpoints are configured');
    console.log('   4. NEXT_PUBLIC_BASE_URL is set (for production)');
  }
}

testViralVideoWebhook();
