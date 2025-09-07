#!/usr/bin/env node

/**
 * Local System Testing Script for OwnerFi
 * Run with: node test-local-system.js
 */

const BASE_URL = 'http://localhost:3001';

// Test data
const testBuyer = {
  name: 'Test Buyer',
  firstName: 'Test',
  lastName: 'Buyer',
  email: `testbuyer${Date.now()}@test.com`,
  password: 'testpass123',
  role: 'buyer',
  phone: '555-0100',
  languages: ['English'],
  // Buyer preferences
  preferredCity: 'Dallas',
  preferredState: 'TX',
  searchRadius: 25,
  maxMonthlyPayment: 3000,
  maxDownPayment: 50000,
  minBedrooms: 3,
  minBathrooms: 2
};

const testRealtor = {
  name: 'Test Realtor',
  firstName: 'Test',
  lastName: 'Realtor',
  email: `testrealtor${Date.now()}@test.com`,
  password: 'testpass123',
  role: 'realtor',
  phone: '555-0200',
  company: 'Test Realty',
  licenseState: 'TX',
  serviceArea: 'Dallas, TX (25 mi)'
};

async function testAPI(endpoint, method = 'GET', body = null) {
  console.log(`\n📍 Testing ${method} ${endpoint}`);
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      console.log(`❌ Error: ${response.status} - ${data.error || 'Unknown error'}`);
      return null;
    }
    
    console.log(`✅ Success: ${response.status}`);
    return data;
  } catch (error) {
    console.log(`❌ Network error: ${error.message}`);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting OwnerFi Local System Tests\n');
  console.log('=' .repeat(50));
  
  // 1. Test property search (anonymous)
  console.log('\n1️⃣ TEST: Property Search (Anonymous User)');
  const properties = await testAPI('/api/buyer/matched-properties?city=Dallas&state=TX&radius=25');
  if (properties) {
    console.log(`   Found ${properties.summary?.totalMatches || 0} properties`);
    console.log(`   - Exact city matches: ${properties.summary?.exactCityMatches || 0}`);
    console.log(`   - Nearby matches: ${properties.summary?.nearbyMatches || 0}`);
    console.log(`   - State matches: ${properties.summary?.stateMatches || 0}`);
  }
  
  // 2. Test buyer signup
  console.log('\n2️⃣ TEST: Buyer Signup');
  const buyerSignup = await testAPI('/api/auth/signup', 'POST', testBuyer);
  if (buyerSignup) {
    console.log(`   Created buyer: ${testBuyer.email}`);
  }
  
  // 3. Test realtor signup
  console.log('\n3️⃣ TEST: Realtor Signup');
  const realtorSignup = await testAPI('/api/realtor/signup', 'POST', testRealtor);
  if (realtorSignup) {
    console.log(`   Created realtor: ${testRealtor.email}`);
  }
  
  // 4. Test property matching for different cities
  console.log('\n4️⃣ TEST: Multi-City Property Matching');
  const cities = [
    { city: 'Dallas', state: 'TX' },
    { city: 'Houston', state: 'TX' },
    { city: 'Memphis', state: 'TN' },
    { city: 'Miami', state: 'FL' },
    { city: 'Phoenix', state: 'AZ' }
  ];
  
  for (const location of cities) {
    const result = await testAPI(
      `/api/buyer/matched-properties?city=${location.city}&state=${location.state}&radius=50`
    );
    if (result) {
      console.log(`   ${location.city}, ${location.state}: ${result.summary?.totalMatches || 0} properties found`);
    }
  }
  
  // 5. Test system health (requires admin)
  console.log('\n5️⃣ TEST: System Health Check');
  const health = await testAPI('/api/admin/system-health');
  if (health) {
    console.log(`   System status: ${health.overall || 'Unknown'}`);
    console.log(`   Total tests: ${health.summary?.totalTests || 0}`);
    console.log(`   Passed: ${health.summary?.passed || 0}`);
    console.log(`   Warnings: ${health.summary?.warnings || 0}`);
    console.log(`   Failed: ${health.summary?.failed || 0}`);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('✅ Tests Complete!\n');
  
  console.log('📝 Next Steps:');
  console.log('1. Login as buyer: http://localhost:3001/auth/signin');
  console.log('2. Login as realtor: http://localhost:3001/realtor/signin');
  console.log('3. Login as admin: http://localhost:3001/auth/signin');
  console.log('4. Upload properties CSV: http://localhost:3001/admin (as admin)');
}

// Run tests
runTests().catch(console.error);