// Quick Test - Generate ONE video and post to all 6 social platforms
// Tests complete flow: Article → Script → HeyGen → Submagic → Metricool → Social Media

async function generateTestVideo() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                  COMPLETE A→Z VIDEO TEST                        ║');
  console.log('║         Article → HeyGen → Submagic → All 6 Platforms          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const testArticle = {
    title: 'Tesla Unveils Revolutionary $25,000 Electric Car',
    content: `Tesla has announced a groundbreaking new electric vehicle priced at just $25,000, making EVs more accessible than ever. The new Model 2 features cutting-edge battery technology, 300+ miles of range, and Tesla's advanced Autopilot system. This could be a game-changer for the automotive industry, bringing sustainable transportation to the masses. CEO Elon Musk stated that this was the company's mission from day one - to accelerate the world's transition to sustainable energy.`
  };

  console.log('📝 Test Article:');
  console.log(`   Title: ${testArticle.title}`);
  console.log(`   Length: ${testArticle.content.length} characters\n`);

  console.log('📤 Starting video generation...\n');

  try {
    const response = await fetch('http://localhost:3000/api/workflow/viral-video-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        article_content: `${testArticle.title}\n\n${testArticle.content}`,
        auto_generate_script: true,
        talking_photo_id: '31c6b2b6306b47a2ba3572a23be09dbc',
        voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
        scale: 1.4,
        width: 1080,
        height: 1920,
        submagic_template: 'Hormozi 2',
        language: 'en'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    console.log('✅ Video generation started!\n');
    console.log('📊 Details:');
    console.log(`   Workflow ID: ${data.workflow_id}`);
    console.log(`   HeyGen Video ID: ${data.heygen_video_id}`);
    console.log(`   Script: ${data.script?.substring(0, 100)}...`);
    console.log(`   Title: ${data.title}`);
    console.log(`   Caption: ${data.caption}`);

    console.log('\n⏳ Monitoring workflow...');
    console.log('   This takes 2-5 minutes. Checking every 10 seconds...\n');

    await monitorWorkflow(data.workflow_id);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

async function monitorWorkflow(workflowId) {
  let attempt = 0;
  const maxAttempts = 60; // 10 minutes

  while (attempt < maxAttempts) {
    attempt++;
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

    try {
      const response = await fetch(`http://localhost:3000/api/workflow/status/${workflowId}`);

      if (response.ok) {
        const workflow = await response.json();
        const time = new Date().toLocaleTimeString();

        console.log(`   [${time}] Status: ${workflow.status}`);

        if (workflow.status === 'complete') {
          console.log('\n╔════════════════════════════════════════════════════════════════╗');
          console.log('║                   ✅ SUCCESS!                                   ║');
          console.log('╚════════════════════════════════════════════════════════════════╝\n');

          console.log('📹 Video URLs:');
          console.log(`   HeyGen: ${workflow.videoUrl || 'N/A'}`);
          console.log(`   Final (with captions): ${workflow.finalVideoUrl || 'N/A'}`);

          console.log('\n📝 Content:');
          console.log(`   Title: ${workflow.title || 'N/A'}`);
          console.log(`   Caption: ${workflow.caption || 'N/A'}`);
          console.log(`   Script: ${workflow.script?.substring(0, 150)}...`);

          if (workflow.metricoolPosted) {
            console.log('\n📱 POSTED TO SOCIAL MEDIA:');
            console.log(`   ✅ Post ID: ${workflow.metricoolPostId}`);
            console.log(`   ✅ Platforms: ${workflow.metricoolPlatforms?.join(', ')}`);
            console.log('\n🎉 Video is now live on all 6 platforms!');
          } else {
            console.log('\n⚠️  Social Media Posting:');
            console.log('   Status: Not posted or failed');
            console.log('   Check: METRICOOL_AUTO_POST in .env.local');
          }

          console.log('\n✅ Test completed successfully!');
          return;
        }

        if (workflow.status === 'failed') {
          console.error(`\n❌ Workflow failed: ${workflow.error}`);
          process.exit(1);
        }
      }
    } catch (error) {
      console.log(`   [${new Date().toLocaleTimeString()}] Monitoring...`);
    }
  }

  console.error('\n❌ Timeout: Workflow took longer than 10 minutes');
  process.exit(1);
}

generateTestVideo();
