// Test RSS Feed Scheduler System
// Initialize feeds and start automated video generation

async function initialize() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║         RSS FEED SCHEDULER - INITIALIZATION                   ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Initialize feed sources
    console.log('🚀 Step 1: Initializing feed sources...\n');
    const initResponse = await fetch('http://localhost:3000/api/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'initialize'
      })
    });

    if (!initResponse.ok) {
      throw new Error(`Failed to initialize: ${initResponse.statusText}`);
    }

    const initData = await initResponse.json();
    console.log('✅ Feed sources initialized!');
    console.log('📊 Carz feeds:', initData.stats.carz.totalFeeds, 'active:', initData.stats.carz.activeFeeds);
    console.log('📊 OwnerFi feeds:', initData.stats.ownerfi.totalFeeds, 'active:', initData.stats.ownerfi.activeFeeds);
    console.log();

    // Step 2: Start scheduler
    console.log('🚀 Step 2: Starting automated scheduler...\n');
    const startResponse = await fetch('http://localhost:3000/api/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start',
        config: {
          maxVideosPerDay: {
            carz: 5,
            ownerfi: 5
          },
          feedCheckInterval: 15, // Check feeds every 15 minutes
          videoProcessInterval: 5, // Process videos every 5 minutes
          enabled: true
        }
      })
    });

    if (!startResponse.ok) {
      throw new Error(`Failed to start scheduler: ${startResponse.statusText}`);
    }

    const startData = await startResponse.json();
    console.log('✅ Scheduler started successfully!');
    console.log('⚙️  Configuration:', JSON.stringify(startData.status.config, null, 2));
    console.log();

    // Step 3: Get initial status
    console.log('🚀 Step 3: Checking system status...\n');
    await showStatus();

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                ║');
    console.log('║                 SYSTEM READY!                                  ║');
    console.log('║                                                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('📋 What happens next:');
    console.log('  1️⃣  Every 15 minutes: Checks all RSS feeds for new articles');
    console.log('  2️⃣  Every 5 minutes: Processes video queue (generates videos)');
    console.log('  3️⃣  Target: 5 Carz videos + 5 OwnerFi videos per day');
    console.log('  4️⃣  Videos automatically go through: RSS → OpenAI → HeyGen → Submagic\n');

    console.log('🔍 Monitor status: GET http://localhost:3000/api/scheduler');
    console.log('🛑 Stop scheduler: POST http://localhost:3000/api/scheduler {"action": "stop"}');
    console.log();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function showStatus() {
  const response = await fetch('http://localhost:3000/api/scheduler');
  const data = await response.json();

  console.log('📊 SYSTEM STATUS');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('Scheduler Running:', data.scheduler.running ? '✅ Yes' : '❌ No');
  console.log();

  console.log('🚗 CARZ INC:');
  console.log('  Total Feeds:', data.stats.carz.totalFeeds);
  console.log('  Active Feeds:', data.stats.carz.activeFeeds);
  console.log('  Articles:', data.stats.carz.totalArticles);
  console.log('  Unprocessed:', data.stats.carz.unprocessedArticles);
  console.log('  Videos Generated:', data.stats.carz.videosGenerated);
  console.log('  Queue Pending:', data.stats.carz.queuePending);
  console.log();

  console.log('🏠 OWNERFI:');
  console.log('  Total Feeds:', data.stats.ownerfi.totalFeeds);
  console.log('  Active Feeds:', data.stats.ownerfi.activeFeeds);
  console.log('  Articles:', data.stats.ownerfi.totalArticles);
  console.log('  Unprocessed:', data.stats.ownerfi.unprocessedArticles);
  console.log('  Videos Generated:', data.stats.ownerfi.videosGenerated);
  console.log('  Queue Pending:', data.stats.ownerfi.queuePending);
  console.log('════════════════════════════════════════════════════════════════');
}

// Run if this is the main module
if (require.main === module) {
  initialize();
}

module.exports = { initialize, showStatus };
