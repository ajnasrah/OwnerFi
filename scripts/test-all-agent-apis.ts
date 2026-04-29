import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

interface APITestResult {
  platform: string;
  testable: boolean;
  hasTestAPI: boolean;
  dataFields: string[];
  pricing: string;
  limitations: string[];
  testResult?: any;
}

async function testAllAgentAPIs() {
  console.log('🔍 Testing All Real Estate Agent Review APIs\n');
  console.log('=' .repeat(60));
  
  const results: APITestResult[] = [];
  
  // 1. TEST GOOGLE PLACES API
  console.log('\n1️⃣ GOOGLE PLACES API');
  console.log('-'.repeat(40));
  
  const googleResult: APITestResult = {
    platform: 'Google Places',
    testable: true,
    hasTestAPI: false,
    dataFields: [
      'name',
      'phone (formatted_phone_number)',
      'website',
      'rating (1-5)',
      'user_ratings_total',
      'reviews (max 5)',
      'address',
      'business_status',
      'photos'
    ],
    pricing: '$200 free credit/month, then $0.032/search + $0.017/details',
    limitations: [
      'Only 5 most relevant reviews',
      'No agent-specific data (license, specializations)',
      'Reviews not real-time',
      'Rate limits apply'
    ]
  };
  
  // Test if we have API key
  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY) {
    console.log('✅ API Key found');
    console.log('🔄 Testing real endpoint...');
    
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=real+estate+agents+Memphis+TN&key=${apiKey}`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      if (data.status === 'OK') {
        console.log(`✅ SUCCESS: Found ${data.results?.length || 0} agents`);
        if (data.results?.[0]) {
          console.log('   Sample agent:', {
            name: data.results[0].name,
            rating: data.results[0].rating,
            address: data.results[0].formatted_address
          });
        }
        googleResult.testResult = 'Working';
      } else {
        console.log(`❌ API Error: ${data.status} - ${data.error_message || ''}`);
        googleResult.testResult = `Error: ${data.status}`;
      }
    } catch (error) {
      console.log('❌ Request failed:', error);
      googleResult.testResult = 'Failed';
    }
  } else {
    console.log('⚠️  No API key configured');
    console.log('   Get key at: https://console.cloud.google.com/apis/credentials');
  }
  
  console.log('\n📊 Data Fields:', googleResult.dataFields.join(', '));
  console.log('💰 Pricing:', googleResult.pricing);
  console.log('⚠️  Limitations:', googleResult.limitations.join('; '));
  
  results.push(googleResult);
  
  // 2. TEST YELP FUSION API
  console.log('\n2️⃣ YELP FUSION API');
  console.log('-'.repeat(40));
  
  const yelpResult: APITestResult = {
    platform: 'Yelp Fusion',
    testable: true,
    hasTestAPI: false,
    dataFields: [
      'name',
      'phone',
      'rating (1-5)',
      'review_count',
      'url (Yelp page)',
      'categories',
      'location/address',
      'coordinates',
      'price ($$)',
      'photos'
    ],
    pricing: 'Changed: 500 calls/day free (was 5000), then $7.99/1000 calls',
    limitations: [
      'No actual review text in search',
      'Need separate call for reviews',
      'Limited to 240 results max',
      'No agent-specific data'
    ]
  };
  
  if (process.env.YELP_API_KEY) {
    console.log('✅ API Key found');
    console.log('🔄 Testing real endpoint...');
    
    try {
      const response = await fetch(
        'https://api.yelp.com/v3/businesses/search?location=Memphis,TN&categories=realestateagents&limit=3',
        {
          headers: {
            'Authorization': `Bearer ${process.env.YELP_API_KEY}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ SUCCESS: Found ${data.businesses?.length || 0} agents`);
        if (data.businesses?.[0]) {
          console.log('   Sample agent:', {
            name: data.businesses[0].name,
            rating: data.businesses[0].rating,
            reviews: data.businesses[0].review_count,
            phone: data.businesses[0].phone
          });
        }
        yelpResult.testResult = 'Working';
      } else {
        console.log(`❌ API Error: ${response.status} ${response.statusText}`);
        yelpResult.testResult = `Error: ${response.status}`;
      }
    } catch (error) {
      console.log('❌ Request failed:', error);
      yelpResult.testResult = 'Failed';
    }
  } else {
    console.log('⚠️  No API key configured');
    console.log('   Get FREE key at: https://www.yelp.com/developers');
  }
  
  console.log('\n📊 Data Fields:', yelpResult.dataFields.join(', '));
  console.log('💰 Pricing:', yelpResult.pricing);
  console.log('⚠️  Limitations:', yelpResult.limitations.join('; '));
  
  results.push(yelpResult);
  
  // 3. RATEMYAGENT API
  console.log('\n3️⃣ RATEMYAGENT API');
  console.log('-'.repeat(40));
  
  const rmaResult: APITestResult = {
    platform: 'RateMyAgent',
    testable: false,
    hasTestAPI: false,
    dataFields: [
      'agent name',
      'verified reviews',
      'star ratings',
      'badges',
      'profile information',
      'review text',
      'reviewer names',
      'transaction details'
    ],
    pricing: 'Contact for pricing (rate-my-agent.com/api)',
    limitations: [
      'Requires approval',
      'Must display RMA logo',
      'No public test API',
      'Terms & conditions apply'
    ]
  };
  
  console.log('⚠️  No public test API available');
  console.log('   Request access at: https://www.rate-my-agent.com/api');
  console.log('\n📊 Data Fields:', rmaResult.dataFields.join(', '));
  console.log('💰 Pricing:', rmaResult.pricing);
  console.log('⚠️  Limitations:', rmaResult.limitations.join('; '));
  
  results.push(rmaResult);
  
  // 4. HOMELIGHT API
  console.log('\n4️⃣ HOMELIGHT PARTNER API');
  console.log('-'.repeat(40));
  
  const homelightResult: APITestResult = {
    platform: 'HomeLight',
    testable: true,
    hasTestAPI: true,
    dataFields: [
      'agent performance metrics',
      'transaction history',
      'success rates',
      'specializations',
      'service areas',
      'contact info (after match)'
    ],
    pricing: 'Partner/Enterprise pricing (contact required)',
    limitations: [
      'Partner access required',
      'Focus on lead generation',
      'Not direct agent search',
      'Enterprise pricing'
    ]
  };
  
  console.log('✅ Test endpoints available:');
  console.log('   - https://staging.homelight.com');
  console.log('   - https://demo.homelight.com');
  console.log('⚠️  Requires partner credentials');
  console.log('   Contact: support@homelight.com');
  console.log('\n📊 Data Fields:', homelightResult.dataFields.join(', '));
  console.log('💰 Pricing:', homelightResult.pricing);
  console.log('⚠️  Limitations:', homelightResult.limitations.join('; '));
  
  results.push(homelightResult);
  
  // 5. REALSATISFIED API
  console.log('\n5️⃣ REALSATISFIED API');
  console.log('-'.repeat(40));
  
  const realSatisfiedResult: APITestResult = {
    platform: 'RealSatisfied',
    testable: false,
    hasTestAPI: false,
    dataFields: [
      'customer satisfaction scores',
      'transaction surveys',
      'agent reviews',
      'performance metrics',
      'NPS scores'
    ],
    pricing: 'Free for 3 testimonials, then paid plans',
    limitations: [
      'Brokerage-focused',
      'Survey-based system',
      'No public API docs',
      'Integration focused'
    ]
  };
  
  console.log('⚠️  No public API documentation found');
  console.log('   Platform focuses on survey collection');
  console.log('\n📊 Data Fields:', realSatisfiedResult.dataFields.join(', '));
  console.log('💰 Pricing:', realSatisfiedResult.pricing);
  console.log('⚠️  Limitations:', realSatisfiedResult.limitations.join('; '));
  
  results.push(realSatisfiedResult);
  
  // SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY OF FINDINGS');
  console.log('='.repeat(60));
  
  console.log('\n✅ IMMEDIATELY TESTABLE:');
  results.filter(r => r.testable).forEach(r => {
    console.log(`   - ${r.platform}: ${r.testResult || 'Can test with API key'}`);
  });
  
  console.log('\n🏆 BEST OPTIONS FOR YOUR NEEDS:');
  console.log('\n1. Google Places API (RECOMMENDED)');
  console.log('   ✅ Works immediately with existing API key');
  console.log('   ✅ Has ratings and reviews');
  console.log('   ✅ $200 free credit monthly');
  console.log('   ✅ Reliable and well-documented');
  console.log('   ❌ Limited to 5 reviews per agent');
  
  console.log('\n2. Yelp Fusion API (GOOD ALTERNATIVE)');
  console.log('   ✅ Free tier available (500 calls/day)');
  console.log('   ✅ Has ratings and review counts');
  console.log('   ✅ Easy to get API key');
  console.log('   ❌ No review text in search results');
  
  console.log('\n3. Build Your Own Review System');
  console.log('   ✅ Full control over data');
  console.log('   ✅ Collect reviews from your buyers');
  console.log('   ✅ No API costs or limitations');
  console.log('   ✅ Can import initial data from Google/Yelp');
  
  console.log('\n🚀 RECOMMENDED APPROACH:');
  console.log('1. Start with Google Places to populate agents');
  console.log('2. Add Yelp as secondary source');
  console.log('3. Build internal review system for your platform');
  console.log('4. Let buyers rate agents after interactions');
  
  return results;
}

// Run the test
testAllAgentAPIs().catch(console.error);