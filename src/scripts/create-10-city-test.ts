#!/usr/bin/env tsx

// 10-CITY TEST DATA CREATOR - Creates comprehensive test data for validation
// Creates 1 buyer and 1 realtor in each of 10 cities, then validates matching

import { ConsolidatedLeadSystem } from '../lib/consolidated-lead-system';
import { FirebaseDB } from '../lib/firebase-db';
import { Timestamp } from 'firebase/firestore';

interface TestCity {
  city: string;
  state: string;
  buyerName: string;
  realtorName: string;
  languages: string[];
}

const TEST_CITIES: TestCity[] = [
  { city: 'Dallas', state: 'TX', buyerName: 'John Smith', realtorName: 'Sarah Johnson', languages: ['English'] },
  { city: 'Memphis', state: 'TN', buyerName: 'Maria Garcia', realtorName: 'Michael Davis', languages: ['English'] },
  { city: 'Houston', state: 'TX', buyerName: 'David Wilson', realtorName: 'Lisa Chen', languages: ['English', 'Spanish'] },
  { city: 'Austin', state: 'TX', buyerName: 'Ashley Brown', realtorName: 'Robert Kim', languages: ['English'] },
  { city: 'San Antonio', state: 'TX', buyerName: 'James Miller', realtorName: 'Jennifer Lopez', languages: ['Spanish', 'English'] },
  { city: 'Fort Worth', state: 'TX', buyerName: 'Emily Jones', realtorName: 'Carlos Rodriguez', languages: ['English'] },
  { city: 'Nashville', state: 'TN', buyerName: 'Christopher Lee', realtorName: 'Amanda White', languages: ['English'] },
  { city: 'Knoxville', state: 'TN', buyerName: 'Jessica Taylor', realtorName: 'Brandon Thompson', languages: ['English'] },
  { city: 'Chattanooga', state: 'TN', buyerName: 'Ryan Anderson', realtorName: 'Nicole Martinez', languages: ['English'] },
  { city: 'El Paso', state: 'TX', buyerName: 'Sofia Ramirez', realtorName: 'Tyler Johnson', languages: ['Spanish', 'English'] }
];

async function create10CityTest() {
  
  const results = {
    buyersCreated: 0,
    realtorsCreated: 0,
    successfulMatches: 0,
    failedMatches: 0,
    cityResults: [] as Array<{
      city: string;
      state: string;
      buyerId: string;
      buyerName: string;
      realtorId: string;
      realtorName: string;
      languages: string[];
      matchesFound?: number;
      localMatchesFound?: number;
      matches?: Array<{
        buyerId: string;
        buyerName: string;
        matchScore: number;
        matchReasons: string[];
      }>;
    }>,
    errors: [] as string[]
  };
  
  try {
    // Step 1: Create buyers and realtors for each city
    
    for (const cityData of TEST_CITIES) {
      
      try {
        // Create buyer
        const buyerId = await ConsolidatedLeadSystem.createBuyerProfile({
          userId: `test_buyer_${cityData.city.toLowerCase()}_${Date.now()}`,
          firstName: cityData.buyerName.split(' ')[0],
          lastName: cityData.buyerName.split(' ')[1],
          email: `${cityData.buyerName.replace(' ', '.').toLowerCase()}@${cityData.city.toLowerCase()}.test`,
          phone: `555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
          city: `${cityData.city}, ${cityData.state}`,
          maxMonthlyPayment: Math.floor(Math.random() * 2000) + 1000, // $1000-3000
          maxDownPayment: Math.floor(Math.random() * 50000) + 20000,  // $20k-70k
          languages: cityData.languages
        });
        
        results.buyersCreated++;
        
        // Create realtor user record  
        const realtorUserId = `test_realtor_${cityData.city.toLowerCase()}_${Date.now()}`;
        const realtorData = {
          email: `${cityData.realtorName.replace(' ', '.').toLowerCase()}@${cityData.city.toLowerCase()}.realty`,
          name: cityData.realtorName,
          role: 'realtor',
          password: 'test123',
          realtorData: {
            firstName: cityData.realtorName.split(' ')[0],
            lastName: cityData.realtorName.split(' ')[1],
            company: `${cityData.city} Premier Realty`,
            credits: 20, // Give credits for testing
            isOnTrial: true,
            trialStartDate: Timestamp.now(),
            trialEndDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            serviceArea: {
              primaryCity: {
                name: cityData.city,
                state: cityData.state,
                stateCode: cityData.state
              },
              totalCitiesServed: 1,
              nearbyCities: []
            },
            serviceCities: [`${cityData.city}, ${cityData.state}`],
            languages: cityData.languages
          },
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        await FirebaseDB.createDocument('users', realtorData, realtorUserId);
        results.realtorsCreated++;
        
        // Store for matching test
        results.cityResults.push({
          city: cityData.city,
          state: cityData.state,
          buyerId,
          buyerName: cityData.buyerName,
          realtorId: realtorUserId,
          realtorName: cityData.realtorName,
          languages: cityData.languages
        });
        
      } catch (error) {
        const errorMsg = `Failed to create data for ${cityData.city}: ${(error as Error).message}`;
        results.errors.push(errorMsg);
      }
    }
    
    // Step 2: Test matching for each realtor
    
    for (const cityResult of results.cityResults) {
      try {
        
        const realtorProfile = {
          cities: [cityResult.city],
          languages: cityResult.languages,
          state: cityResult.state
        };
        
        const matches = await ConsolidatedLeadSystem.findAvailableLeads(realtorProfile);
        
        // Filter to only buyers in the same city for validation
        const localMatches = matches.filter(match => 
          match.city === cityResult.city && match.state === cityResult.state
        );
        
        cityResult.matchesFound = matches.length;
        cityResult.localMatchesFound = localMatches.length;
        cityResult.matches = localMatches.map(m => ({
          buyerId: m.id,
          buyerName: `${m.firstName} ${m.lastName}`,
          matchScore: m.matchScore,
          matchReasons: m.matchReasons
        }));
        
        if (localMatches.length > 0) {
          results.successfulMatches++;
          localMatches.forEach(match => {
          });
        } else {
          results.failedMatches++;
        }
        
      } catch (error) {
        results.failedMatches++;
        const errorMsg = `Matching failed for ${cityResult.realtorName}: ${(error as Error).message}`;
        results.errors.push(errorMsg);
      }
    }
    
    // Step 3: Validate cross-city isolation
    
    // Test: Dallas realtor should NOT see Memphis buyers
    const dallasRealtorProfile = { cities: ['Dallas'], languages: ['English'], state: 'TX' };
    const memphisMatches = await ConsolidatedLeadSystem.findAvailableLeads(dallasRealtorProfile);
    const memphisBuyersFound = memphisMatches.filter(m => m.city === 'Memphis');
    
    
    // Test: Memphis realtor should NOT see Dallas buyers  
    const memphisRealtorProfile = { cities: ['Memphis'], languages: ['English'], state: 'TN' };
    const dallasMatches = await ConsolidatedLeadSystem.findAvailableLeads(memphisRealtorProfile);
    const dallasBuyersFound = dallasMatches.filter(m => m.city === 'Dallas');
    
    
    // Step 4: Get final statistics
    const stats = await ConsolidatedLeadSystem.getSystemStatistics();
    
    // Step 5: Summary report
    
    
    if (results.errors.length > 0) {
    }
    
    // Detailed city breakdown
    results.cityResults.forEach(city => {
      const status = (city.localMatchesFound ?? 0) > 0 ? '✅' : '❌';
    });
    
    
    // Final validation
    const overallSuccess = 
      results.buyersCreated === TEST_CITIES.length &&
      results.realtorsCreated === TEST_CITIES.length &&
      results.successfulMatches >= TEST_CITIES.length * 0.8 && // 80% success rate
      results.errors.length === 0;
    
    
    if (overallSuccess) {
    }
    
  } catch (error) {
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  create10CityTest();
}

export { create10CityTest };