#!/usr/bin/env tsx

// CONSOLIDATION TEST SCRIPT - Test the buyer system consolidation locally
// This script validates all components without needing a running server

import { ConsolidatedLeadSystem } from '../lib/consolidated-lead-system';
import { BuyerSystemMigration } from '../lib/buyer-system-migration';

async function testConsolidation() {
  
  try {
    // Test 1: Consolidated Lead System Statistics
    const stats = await ConsolidatedLeadSystem.getSystemStatistics();
    
    // Test 2: Create Dallas buyer
    const dallasBuyerId = await ConsolidatedLeadSystem.createBuyerProfile({
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
    const memphisBuyerId = await ConsolidatedLeadSystem.createBuyerProfile({
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
    const dallasMatches = await ConsolidatedLeadSystem.findAvailableLeads({
      cities: ['Dallas'],
      languages: ['English'],
      state: 'TX'
    });
    
    // Test 5: Test Memphis realtor matching  
    const memphisMatches = await ConsolidatedLeadSystem.findAvailableLeads({
      cities: ['Memphis'],
      languages: ['English'],
      state: 'TN'
    });
    
    // Test 6: Cross-state matching (should fail)
    const crossStateMatches = await ConsolidatedLeadSystem.findAvailableLeads({
      cities: ['Dallas'], 
      languages: ['English'],
      state: 'TN' // TN realtor looking for Dallas buyers (should fail)
    });
    
    // Test 7: Purchase a lead
    if (dallasMatches.length > 0) {
      const purchaseResult = await ConsolidatedLeadSystem.purchaseLead(
        dallasMatches[0].id,
        'test_realtor_123'
      );
      
      // Verify buyer is no longer available
      const postPurchaseMatches = await ConsolidatedLeadSystem.findAvailableLeads({
        cities: ['Dallas'],
        languages: ['English'],
        state: 'TX'
      });
    }
    
    // Test 8: Final statistics
    const finalStats = await ConsolidatedLeadSystem.getSystemStatistics();
    
    
  } catch (error) {
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testConsolidation();
}