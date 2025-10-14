#!/usr/bin/env node

/**
 * Script to rate all articles in the system with AI
 * This will score all unprocessed articles for both Carz and OwnerFi brands
 */

const BASE_URL = process.env.BASE_URL || 'https://ownerfi.ai';

async function rateAllArticles() {
  console.log('🚀 Starting AI rating for all articles...\n');

  // Rate Carz articles
  console.log('📊 Rating Carz articles...');
  try {
    const carzResponse = await fetch(`${BASE_URL}/api/articles/rate-all-async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': process.env.ADMIN_COOKIE || '' // Will need admin auth
      },
      body: JSON.stringify({
        brand: 'carz',
        keepTopN: 50 // Keep top 50 Carz articles
      })
    });

    const carzData = await carzResponse.json();

    if (carzData.success) {
      console.log('✅ Carz: Background rating started');
      console.log(`   Message: ${carzData.message}`);
    } else {
      console.error('❌ Carz: Failed to start rating');
      console.error(`   Error: ${carzData.error}`);
    }
  } catch (error) {
    console.error('❌ Carz: Request failed', error.message);
  }

  console.log('');

  // Rate OwnerFi articles
  console.log('📊 Rating OwnerFi articles...');
  try {
    const ownerfiResponse = await fetch(`${BASE_URL}/api/articles/rate-all-async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': process.env.ADMIN_COOKIE || ''
      },
      body: JSON.stringify({
        brand: 'ownerfi',
        keepTopN: 50 // Keep top 50 OwnerFi articles
      })
    });

    const ownerfiData = await ownerfiResponse.json();

    if (ownerfiData.success) {
      console.log('✅ OwnerFi: Background rating started');
      console.log(`   Message: ${ownerfiData.message}`);
    } else {
      console.error('❌ OwnerFi: Failed to start rating');
      console.error(`   Error: ${ownerfiData.error}`);
    }
  } catch (error) {
    console.error('❌ OwnerFi: Request failed', error.message);
  }

  console.log('\n📝 Note: The rating process runs in the background.');
  console.log('   Check your server logs to monitor progress.');
  console.log('   This may take several minutes depending on article count.\n');
}

// Run the script
rateAllArticles().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
