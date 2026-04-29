import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testAgentScrapers() {
  const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_KEY!,
  });

  console.log('🔍 Testing Apify Agent Scrapers...\n');
  
  // Test 1: Zillow Agent Scraper
  console.log('1️⃣ Testing Zillow Agent Scraper...');
  try {
    const zillowInput = {
      searchLocation: 'Memphis, TN',
      maxItems: 5, // Just get 5 agents for testing
      includeReviews: true,
    };
    
    console.log('   Input:', JSON.stringify(zillowInput, null, 2));
    
    // Try the Zillow agent scraper
    const zillowRun = await apifyClient.actor('pocesar/zillow-agent-scraper').call(zillowInput);
    const zillowDataset = await apifyClient.dataset(zillowRun.defaultDatasetId).listItems();
    
    console.log(`   ✅ Found ${zillowDataset.items.length} Zillow agents`);
    
    if (zillowDataset.items.length > 0) {
      const firstAgent = zillowDataset.items[0];
      console.log('   Sample agent:', {
        name: firstAgent.name,
        rating: firstAgent.rating,
        reviewCount: firstAgent.reviewCount,
        phone: firstAgent.phone,
        city: firstAgent.city,
      });
    }
  } catch (error: any) {
    console.log('   ❌ Zillow scraper error:', error.message);
    console.log('   Note: This actor might not exist or require different input');
  }
  
  // Test 2: Realtor.com Agent Scraper
  console.log('\n2️⃣ Testing Realtor.com Agent Scraper...');
  try {
    const realtorInput = {
      location: 'Memphis, TN',
      maxAgents: 5,
    };
    
    console.log('   Input:', JSON.stringify(realtorInput, null, 2));
    
    const realtorRun = await apifyClient.actor('misceres/realtor-com-agents-scraper').call(realtorInput);
    const realtorDataset = await apifyClient.dataset(realtorRun.defaultDatasetId).listItems();
    
    console.log(`   ✅ Found ${realtorDataset.items.length} Realtor.com agents`);
    
    if (realtorDataset.items.length > 0) {
      const firstAgent = realtorDataset.items[0];
      console.log('   Sample agent:', {
        name: firstAgent.fullName || firstAgent.name,
        rating: firstAgent.rating,
        reviewCount: firstAgent.reviewCount,
        phone: firstAgent.phone,
        city: firstAgent.city,
      });
    }
  } catch (error: any) {
    console.log('   ❌ Realtor.com scraper error:', error.message);
    console.log('   Note: This actor might not exist or require different input');
  }
  
  // Test 3: Try generic Zillow scraper for agents
  console.log('\n3️⃣ Testing Generic Zillow Scraper for Agent Profiles...');
  try {
    // Many Apify actors for Zillow use different naming
    const genericInput = {
      startUrls: [
        { url: 'https://www.zillow.com/professionals/real-estate-agent-reviews/memphis-tn/' }
      ],
      maxItems: 5,
    };
    
    console.log('   Input:', JSON.stringify(genericInput, null, 2));
    
    // Try different possible actor names
    const possibleActors = [
      'epctex/zillow-scraper',
      'petr_cermak/zillow-scraper',
      'natasha.lekh/zillow-scraper',
    ];
    
    for (const actorName of possibleActors) {
      try {
        console.log(`   Trying ${actorName}...`);
        const run = await apifyClient.actor(actorName).call(genericInput);
        const dataset = await apifyClient.dataset(run.defaultDatasetId).listItems();
        
        if (dataset.items.length > 0) {
          console.log(`   ✅ Success with ${actorName}! Found ${dataset.items.length} items`);
          console.log('   Sample data:', JSON.stringify(dataset.items[0], null, 2).substring(0, 500));
          break;
        }
      } catch (err) {
        console.log(`   ❌ ${actorName} not available`);
      }
    }
  } catch (error: any) {
    console.log('   ❌ Generic scraper error:', error.message);
  }
  
  // Test 4: Search available Apify actors
  console.log('\n4️⃣ Searching for available real estate agent scrapers...');
  try {
    // List actors from the Apify store
    const actors = await apifyClient.actors().list({
      limit: 100,
    });
    
    const agentScrapers = actors.items.filter(actor => 
      actor.name?.toLowerCase().includes('agent') ||
      actor.name?.toLowerCase().includes('realtor') ||
      actor.name?.toLowerCase().includes('zillow')
    );
    
    console.log(`   Found ${agentScrapers.length} potential agent scrapers:`);
    agentScrapers.slice(0, 10).forEach(actor => {
      console.log(`   - ${actor.username}/${actor.name}: ${actor.title}`);
    });
  } catch (error: any) {
    console.log('   ❌ Could not list actors:', error.message);
  }
  
  console.log('\n✨ Testing complete!');
}

// Run the test
testAgentScrapers().catch(console.error);