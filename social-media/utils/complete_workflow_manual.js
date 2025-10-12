// Complete the workflow manually: HeyGen video → Submagic → Metricool → Social Media

const HEYGEN_VIDEO_URL = 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/2dcdb3a4c6a347988334fb8ef90ee7da.mp4';
const WORKFLOW_ID = '08a5fe1f-0aad-4466-a651-aff85b583691';
const TITLE = "Tesla's $25,000 Electric Car: The Future of Driving!";
const CAPTION = "Tesla just dropped a jaw-dropping electric car for only $25,000! This could change everything for EV adoption. 🚗⚡";
const HASHTAGS = ['Tesla', 'ElectricCar', 'EV', 'CarNews', 'TeslaModel2'];

async function completeWorkflow() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        COMPLETING WORKFLOW MANUALLY                            ║');
  console.log('║        HeyGen → Submagic → Metricool → Social Media            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Submit to Submagic
    console.log('📤 Step 1: Sending video to Submagic for captions...\n');

    const submagicResponse = await fetch('https://api.submagic.co/api/v1/project/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-dea6c999d105de0125dbc463b8ab35e375258a7969cd57ab9911d65b15c14bab'
      },
      body: JSON.stringify({
        video_url: HEYGEN_VIDEO_URL,
        template: 'Hormozi 2',
        language: 'en',
        webhook_url: `http://localhost:3000/api/webhooks/submagic?workflow_id=${WORKFLOW_ID}`
      })
    });

    if (!submagicResponse.ok) {
      const error = await submagicResponse.text();
      throw new Error(`Submagic API error: ${submagicResponse.status} - ${error}`);
    }

    const submagicData = await submagicResponse.json();
    console.log('✅ Submagic project created!');
    console.log(`   Project ID: ${submagicData.project_id || submagicData.id}`);
    console.log('   Processing... (1-2 minutes)\n');

    console.log('⏳ Waiting for Submagic to complete (checking every 15 seconds)...\n');

    // Step 2: Poll Submagic status
    let attempts = 0;
    let finalVideoUrl = null;

    while (attempts < 40 && !finalVideoUrl) {  // 10 minutes max
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds

      try {
        const statusResponse = await fetch(`https://api.submagic.co/api/v1/project/${submagicData.project_id || submagicData.id}`, {
          headers: {
            'Authorization': 'Bearer sk-dea6c999d105de0125dbc463b8ab35e375258a7969cd57ab9911d65b15c14bab'
          }
        });

        if (statusResponse.ok) {
          const status = await statusResponse.json();
          console.log(`   [${new Date().toLocaleTimeString()}] Status: ${status.status || 'processing'}`);

          if (status.status === 'completed' && status.video_url) {
            finalVideoUrl = status.video_url;
            console.log('\n✅ Submagic completed!');
            console.log(`   Final Video URL: ${finalVideoUrl}\n`);
          }
        }
      } catch (error) {
        console.log(`   [${new Date().toLocaleTimeString()}] Checking...`);
      }
    }

    if (!finalVideoUrl) {
      throw new Error('Submagic processing timeout');
    }

    // Step 3: Post to Metricool (all 6 platforms)
    console.log('📱 Step 3: Posting to Metricool (all 6 platforms)...\n');

    const platforms = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'threads'];

    console.log('   Platforms: ' + platforms.join(', '));
    console.log(`   Video: ${finalVideoUrl}`);
    console.log(`   Caption: ${CAPTION}`);
    console.log(`   Hashtags: ${HASHTAGS.join(', ')}\n`);

    const metricoolResponse = await fetch('https://api.metricool.com/v1/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mc-Auth': 'CWYJZYORLGMQRYGAJHAGICULMYKTNPEYBWHGDXICJQMHSAGMJUXFKEECTBURNSXZ'
      },
      body: JSON.stringify({
        userId: '2946453',
        videoUrl: finalVideoUrl,
        caption: `${CAPTION}\n\n${HASHTAGS.map(t => '#' + t).join(' ')}`,
        title: TITLE,
        platforms: platforms,
        type: 'video'
      })
    });

    if (metricoolResponse.ok) {
      const metricoolData = await metricoolResponse.json();
      console.log('✅ Posted to Metricool successfully!');
      console.log(`   Post ID: ${metricoolData.postId || metricoolData.id || 'N/A'}`);
      console.log(`   Status: Scheduled/Posted to all 6 platforms\n`);

      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║                  🎉 SUCCESS! 🎉                                 ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');

      console.log('📊 FINAL RESULTS:\n');
      console.log(`✅ HeyGen Video: ${HEYGEN_VIDEO_URL.substring(0, 80)}...`);
      console.log(`✅ Submagic Video: ${finalVideoUrl.substring(0, 80)}...`);
      console.log(`✅ Metricool Post ID: ${metricoolData.postId || metricoolData.id || 'Check dashboard'}`);
      console.log('\n📱 POSTED TO:');
      platforms.forEach((p, i) => console.log(`   ${i + 1}. ${p.charAt(0).toUpperCase() + p.slice(1)}`));
      console.log('\n🔗 Check your social media accounts - video should be live or scheduled!');
      console.log('🔗 Metricool Dashboard: https://app.metricool.com/\n');

    } else {
      const error = await metricoolResponse.text();
      console.log('⚠️  Metricool posting failed:');
      console.log(`   Status: ${metricoolResponse.status}`);
      console.log(`   Error: ${error}`);
      console.log('\n   But the video is ready! You can post manually:');
      console.log(`   Video URL: ${finalVideoUrl}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

completeWorkflow();
