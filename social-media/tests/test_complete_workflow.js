// Complete End-to-End Workflow Test
// Tests: RSS → AI Script → HeyGen → Submagic → Metricool → Social Media

const API_BASE = 'http://localhost:3000';

async function testCompleteWorkflow() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║         COMPLETE WORKFLOW TEST A→Z                             ║');
  console.log('║         RSS → HeyGen → Submagic → Social Media                 ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Get a queued article
    console.log('📋 Step 1: Getting a queued article...\n');
    const statusResponse = await fetch(`${API_BASE}/api/scheduler`);
    const status = await statusResponse.json();

    if (!status.success) {
      throw new Error('Failed to get scheduler status');
    }

    const carzPending = status.scheduler.stats.carz.queuePending;
    const ownerfiPending = status.scheduler.stats.ownerfi.queuePending;

    console.log(`   Carz videos in queue: ${carzPending}`);
    console.log(`   OwnerFi videos in queue: ${ownerfiPending}`);

    if (carzPending === 0 && ownerfiPending === 0) {
      throw new Error('No videos in queue! Run: node test_rss_scheduler.js first');
    }

    // Choose category with queued items
    const category = carzPending > 0 ? 'carz' : 'ownerfi';
    console.log(`\n   ✅ Using category: ${category.toUpperCase()}\n`);

    // Step 2: Manually trigger video generation for ONE article
    console.log('🎬 Step 2: Getting article from queue...\n');

    // Get the article details (we'll need to create an endpoint or directly access)
    console.log('   Note: This will use the scheduler\'s normal process');
    console.log('   The scheduler will pick the next scheduled video\n');

    // Step 3: Force process the queue now (ignore schedule)
    console.log('⚡ Step 3: Force processing queue (bypass schedule)...\n');
    const processResponse = await fetch(`${API_BASE}/api/scheduler/process-now`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true })
    });

    if (!processResponse.ok) {
      // If endpoint doesn't exist, we'll create it
      console.log('   ⚠️  Force process endpoint not found');
      console.log('   Using manual video generation instead...\n');

      // Manual generation with sample article
      return await manualVideoGeneration(category);
    }

    const processData = await processResponse.json();
    console.log('   ✅ Video generation started!');
    console.log(`   Workflow ID: ${processData.workflowId}`);
    console.log(`   Video ID: ${processData.videoId}\n`);

    // Step 4: Monitor progress
    await monitorWorkflow(processData.workflowId);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. Server is running: npm run dev');
    console.log('   2. Scheduler is started: node test_rss_scheduler.js');
    console.log('   3. Videos are in queue');
    process.exit(1);
  }
}

async function manualVideoGeneration(category) {
  console.log('🎬 Generating test video manually...\n');

  const testArticles = {
    carz: {
      title: 'Tesla Unveils Revolutionary $25,000 Electric Car',
      content: 'Tesla has announced a groundbreaking new electric vehicle priced at just $25,000, making EVs more accessible than ever. The new Model 2 features cutting-edge battery technology, 300+ miles of range, and Tesla\'s advanced Autopilot system. This could be a game-changer for the automotive industry, bringing sustainable transportation to the masses. CEO Elon Musk stated that this was the company\'s mission from day one - to accelerate the world\'s transition to sustainable energy.'
    },
    ownerfi: {
      title: 'Mortgage Rates Drop to 5-Year Low - Perfect Time to Buy',
      content: 'Mortgage rates have plummeted to their lowest levels in five years, presenting an incredible opportunity for homebuyers. The average 30-year fixed rate is now at 5.2%, down from 7.8% last year. This dramatic decrease could save buyers hundreds of dollars per month on their mortgage payments. Real estate experts predict this window won\'t last long, as the Fed signals potential rate increases in Q2. For first-time buyers and those looking to refinance, now might be the perfect time to act.'
    }
  };

  const article = testArticles[category];

  console.log(`   Title: ${article.title}`);
  console.log(`   Length: ${article.content.length} characters\n`);

  console.log('📤 Sending to video generation API...\n');

  const response = await fetch(`${API_BASE}/api/workflow/viral-video-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      article_content: `${article.title}\n\n${article.content}`,
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
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  console.log('   ✅ Video generation started!');
  console.log(`   Workflow ID: ${data.workflow_id}`);
  console.log(`   HeyGen Video ID: ${data.heygen_video_id}\n`);

  // Monitor the workflow
  await monitorWorkflow(data.workflow_id);
}

async function monitorWorkflow(workflowId) {
  console.log('👀 Step 4: Monitoring workflow progress...\n');
  console.log('   This will take 2-5 minutes. Please wait...\n');

  let attempts = 0;
  const maxAttempts = 60; // 10 minutes max

  while (attempts < maxAttempts) {
    attempts++;

    // Wait 10 seconds between checks
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check workflow status (we'll need to create this endpoint)
    try {
      const response = await fetch(`${API_BASE}/api/workflow/status/${workflowId}`);

      if (response.ok) {
        const workflow = await response.json();

        console.log(`   [${new Date().toLocaleTimeString()}] Status: ${workflow.status}`);

        if (workflow.status === 'complete') {
          console.log('\n╔════════════════════════════════════════════════════════════════╗');
          console.log('║                                                                ║');
          console.log('║                  ✅ WORKFLOW COMPLETE!                          ║');
          console.log('║                                                                ║');
          console.log('╚════════════════════════════════════════════════════════════════╝\n');

          console.log('📊 Results:');
          console.log(`   HeyGen Video: ${workflow.videoUrl || 'N/A'}`);
          console.log(`   Final Video: ${workflow.finalVideoUrl || 'N/A'}`);
          console.log(`   Caption: ${workflow.caption || 'N/A'}`);
          console.log(`   Title: ${workflow.title || 'N/A'}`);

          if (workflow.metricoolPosted) {
            console.log(`\n   ✅ Posted to social media!`);
            console.log(`   Post ID: ${workflow.metricoolPostId}`);
            console.log(`   Platforms: ${workflow.metricoolPlatforms?.join(', ') || 'N/A'}`);
          } else {
            console.log(`\n   ⚠️  Auto-posting disabled or failed`);
          }

          console.log('\n✅ Complete workflow successful!');
          return;
        }

        if (workflow.status === 'failed') {
          throw new Error(`Workflow failed: ${workflow.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      // Endpoint might not exist, continue monitoring
    }
  }

  throw new Error('Workflow timeout - took longer than 10 minutes');
}

// Run if this is the main module
if (require.main === module) {
  testCompleteWorkflow();
}

module.exports = { testCompleteWorkflow };
