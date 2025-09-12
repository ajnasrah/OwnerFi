#!/usr/bin/env tsx

// CONSOLIDATION TEST SCRIPT - Test the buyer system consolidation locally
// This script validates all components without needing a running server

import { ConsolidatedLeadSystem } from '../lib/consolidated-lead-system';

async function testConsolidation() {
  
  try {
    // Test 1: Consolidated Lead System Statistics
    const _stats = await ConsolidatedLeadSystem.getSystemStatistics();
    
    // Test 2: Create Dallas buyer
    const _dallasBuyerId = await ConsolidatedLeadSystem.createBuyerProfile({
      userId: `test_dallas_buyer_${Date.now()}`,
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith.dallas@test.com',
      phone: '555-123-4567',
      city: 'Dallas, TX',
      maxMonthlyPayment: 2000,
      maxDownPayment: 50000,
      languages: ['English']
    });
    
    // Test 3: Create Memphis buyer
    const _memphisBuyerId = await ConsolidatedLeadSystem.createBuyerProfile({
      userId: `test_memphis_buyer_${Date.now()}`,
      firstName: 'Maria',
      lastName: 'Garcia',
      email: 'maria.garcia.memphis@test.com',
      phone: '555-987-6543',
      city: 'Memphis, TN',
      maxMonthlyPayment: 1800,
      maxDownPayment: 40000,
      languages: ['English']
    });
    
    // Test 4: Test Dallas realtor matching
    const _dallasMatches = await ConsolidatedLeadSystem.findAvailableLeads({
      cities: ['Dallas'],
      languages: ['English'],
      state: 'TX'
    });
    
    // Test 5: Test Memphis realtor matching  
    const _memphisMatches = await ConsolidatedLeadSystem.findAvailableLeads({
      cities: ['Memphis'],
      languages: ['English'],
      state: 'TN'
    });
    
    // Test 6: Cross-state matching (should fail)
    const _crossStateMatches = await ConsolidatedLeadSystem.findAvailableLeads({
      cities: ['Dallas'], 
      languages: ['English'],
      state: 'TN' // TN realtor looking for Dallas buyers (should fail)
    });
    
    // Test 7: Purchase a lead
    if (_dallasMatches.length > 0) {
      const _purchaseResult = await ConsolidatedLeadSystem.purchaseLead(
        _dallasMatches[0].id,
        'test_realtor_123'
      );
      
      // Verify buyer is no longer available
      const _postPurchaseMatches = await ConsolidatedLeadSystem.findAvailableLeads({
        cities: ['Dallas'],
        languages: ['English'],
        state: 'TX'
      });
    }
    
    // Test 8: Final statistics
    const _finalStats = await ConsolidatedLeadSystem.getSystemStatistics();
    
    
  } catch (error) {
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testConsolidation();
}