import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Test agent data fetching using direct API approach
 * This avoids scraping and uses legitimate data sources
 */
async function testAgentAPIs() {
  console.log('🔍 Testing agent data sources...\n');
  
  // Option 1: Google Places API for real estate agents
  console.log('1️⃣ Google Places API (Real Estate Agents in Memphis)');
  console.log('   Note: Requires Google Places API key');
  console.log('   Cost: ~$0.032 per search + $0.017 per place detail');
  console.log('   Data: Name, phone, address, rating, reviews, website\n');
  
  // Option 2: Yelp Fusion API
  console.log('2️⃣ Yelp Fusion API');
  console.log('   Note: Free tier available (5000 calls/day)');
  console.log('   Data: Business name, phone, rating, review count\n');
  
  // Option 3: Yellow Pages API
  console.log('3️⃣ Yellow Pages / Local Directory APIs');
  console.log('   Various providers like Neutrino API, Melissa Data');
  console.log('   Cost: Varies, usually $0.01-0.05 per lookup\n');
  
  // Option 4: MLS IDX feeds
  console.log('4️⃣ MLS IDX Feed (SimplyRETS, FBS, etc.)');
  console.log('   Cost: $49-299/month typically');
  console.log('   Data: Licensed agents in MLS, contact info, listings\n');
  
  // Option 5: State licensing board APIs
  console.log('5️⃣ State Real Estate Commission APIs');
  console.log('   Tennessee: https://verify.tn.gov');
  console.log('   Data: License verification, status, broker info');
  console.log('   Cost: Usually free but limited\n');
  
  console.log('━'.repeat(50));
  console.log('\n🎯 RECOMMENDED APPROACH:\n');
  console.log('Since you already have buyers in your system, consider:');
  console.log('\n1. Let agents sign up themselves (self-service)');
  console.log('2. Verify their license via state board API');
  console.log('3. Collect their own reviews from your platform');
  console.log('4. Use Google Places for initial rating import\n');
  
  // Test Google Places API if key exists
  if (process.env.GOOGLE_PLACES_API_KEY) {
    await testGooglePlaces();
  } else {
    console.log('ℹ️  Add GOOGLE_PLACES_API_KEY to test Google Places\n');
  }
  
  // Show how to implement self-service agent signup
  console.log('━'.repeat(50));
  console.log('\n📝 SELF-SERVICE AGENT SIGNUP FLOW:\n');
  console.log('1. Agent visits: /agent/signup');
  console.log('2. Enters: Name, Email, Phone, License #, State');
  console.log('3. System verifies license with state board');
  console.log('4. Agent creates profile: bio, specialties, areas');
  console.log('5. Import existing reviews from Google/Yelp (optional)');
  console.log('6. Agent appears in buyer search results');
  console.log('7. Buyers rate agents after interactions\n');
}

async function testGooglePlaces() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return;
  
  console.log('🔍 Testing Google Places API...\n');
  
  try {
    // Search for real estate agents in Memphis
    const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    searchUrl.searchParams.set('query', 'real estate agents in Memphis TN');
    searchUrl.searchParams.set('key', apiKey);
    
    const response = await fetch(searchUrl.toString());
    const data = await response.json();
    
    if (data.status === 'OK' && data.results) {
      console.log(`✅ Found ${data.results.length} results\n`);
      
      // Show first 3 agents
      data.results.slice(0, 3).forEach((place: any, index: number) => {
        console.log(`${index + 1}. ${place.name}`);
        console.log(`   📍 ${place.formatted_address}`);
        console.log(`   ⭐ ${place.rating || 'N/A'} (${place.user_ratings_total || 0} reviews)`);
        console.log(`   🆔 Place ID: ${place.place_id}\n`);
      });
      
      console.log('💡 Use Place Details API to get phone & website for each agent\n');
    } else {
      console.log(`❌ API Error: ${data.status}`);
      console.log(`   ${data.error_message || ''}\n`);
    }
  } catch (error) {
    console.error('❌ Error calling Google Places:', error);
  }
}

// Run the test
testAgentAPIs().catch(console.error);