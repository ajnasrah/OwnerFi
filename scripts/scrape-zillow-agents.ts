import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

interface ZillowAgent {
  name: string;
  profileUrl?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  recentSales?: number;
  businessName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

async function scrapeZillowAgents(city: string, state: string) {
  const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_KEY!,
  });

  console.log(`🔍 Scraping agents from Zillow for ${city}, ${state}...\n`);
  
  try {
    // Use the Zillow Search Scraper to find agents
    const searchUrl = `https://www.zillow.com/professionals/real-estate-agent-reviews/${city.toLowerCase().replace(' ', '-')}-${state.toLowerCase()}/`;
    
    console.log('Search URL:', searchUrl);
    
    // Try api-ninja/zillow-search-scraper first
    const input = {
      startUrls: [{ url: searchUrl }],
      maxItems: 50, // Get up to 50 agents
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
    };
    
    console.log('Running Apify actor: api-ninja/zillow-search-scraper');
    const run = await apifyClient.actor('api-ninja/zillow-search-scraper').call(input);
    const dataset = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    console.log(`✅ Scraper completed. Found ${dataset.items.length} items\n`);
    
    // Parse and save agents
    const agents: ZillowAgent[] = [];
    
    for (const item of dataset.items) {
      // The scraper might return property or agent data, we need to filter
      if (item.type === 'agent' || item.agentName || item.name) {
        const agent: ZillowAgent = {
          name: item.agentName || item.name || 'Unknown',
          profileUrl: item.url || item.profileUrl,
          phone: item.phone,
          rating: item.rating,
          reviewCount: item.reviewCount,
          recentSales: item.recentSales,
          businessName: item.businessName || item.brokerName,
          address: item.address,
          city: item.city || city,
          state: item.state || state,
          zip: item.zip,
        };
        agents.push(agent);
      }
    }
    
    console.log(`📊 Found ${agents.length} agents\n`);
    
    // Save to Firestore
    const batch = db.batch();
    let savedCount = 0;
    
    for (const agent of agents) {
      const agentId = `zillow_${agent.profileUrl?.split('/').pop() || agent.name.replace(/\s+/g, '_')}`;
      const docRef = db.collection('agentProfiles').doc(agentId);
      
      batch.set(docRef, {
        id: agentId,
        name: agent.name,
        phone: agent.phone,
        city: agent.city,
        state: agent.state,
        zipCode: agent.zip,
        averageRating: agent.rating || 0,
        totalReviews: agent.reviewCount || 0,
        recentSales: agent.recentSales || 0,
        brokerageName: agent.businessName,
        
        // Platform data
        source: 'zillow',
        sourceUrl: agent.profileUrl,
        
        // Status
        isActive: true,
        isVerified: false,
        isPremium: false,
        isFeatured: false,
        
        // Defaults
        serviceAreas: [],
        specializations: [],
        languages: ['English'],
        leadsReceived: 0,
        dealsCompleted: 0,
        totalEarnings: 0,
        responseTimeHours: 24,
        successRate: 0,
        
        // Metadata
        createdAt: new Date(),
        updatedAt: new Date(),
        lastScrapedAt: new Date(),
      }, { merge: true });
      
      savedCount++;
      console.log(`   ${savedCount}. ${agent.name} - ⭐ ${agent.rating || 'N/A'} (${agent.reviewCount || 0} reviews)`);
    }
    
    await batch.commit();
    console.log(`\n✅ Saved ${savedCount} agents to Firestore`);
    
    return agents;
    
  } catch (error: any) {
    console.error('❌ Error scraping agents:', error.message);
    
    // Fallback: Try alternative approach
    console.log('\n🔄 Trying alternative scraping approach...');
    return await scrapeWithAlternativeMethod(city, state);
  }
}

async function scrapeWithAlternativeMethod(city: string, state: string) {
  const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_KEY!,
  });
  
  try {
    // Use maxcopell/zillow-scraper as alternative
    const input = {
      search: `real estate agents ${city} ${state}`,
      type: 'agent',
      maxItems: 50,
    };
    
    console.log('Running alternative: maxcopell/zillow-scraper');
    const run = await apifyClient.actor('maxcopell/zillow-scraper').call(input);
    const dataset = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    console.log(`✅ Alternative scraper found ${dataset.items.length} items`);
    
    // Process and return results
    return dataset.items.map((item: any) => ({
      name: item.name || 'Unknown',
      profileUrl: item.url,
      phone: item.phone,
      rating: item.rating,
      reviewCount: item.reviews,
      city: city,
      state: state,
    }));
    
  } catch (error: any) {
    console.error('❌ Alternative scraping also failed:', error.message);
    return [];
  }
}

// Main execution
async function main() {
  const city = process.argv[2] || 'Memphis';
  const state = process.argv[3] || 'TN';
  
  console.log(`🏠 OwnerFi Agent Scraper`);
  console.log(`📍 Location: ${city}, ${state}`);
  console.log(`🔑 Apify API Key: ${process.env.APIFY_API_KEY?.substring(0, 20)}...`);
  console.log('━'.repeat(50));
  console.log();
  
  const agents = await scrapeZillowAgents(city, state);
  
  console.log('\n' + '━'.repeat(50));
  console.log(`📈 Summary: Scraped ${agents.length} agents from ${city}, ${state}`);
}

main().catch(console.error);