// SIMPLE CONSOLIDATION TEST - Browser-accessible endpoint for testing
// Creates Dallas buyer + Memphis buyer, then tests realtor matching

import { NextRequest, NextResponse } from 'next/server';
import { ConsolidatedLeadSystem } from '@/lib/consolidated-lead-system';
import { FirebaseDB } from '@/lib/firebase-db';
import { BuyerProfile, User } from '@/lib/firebase-models';

interface TestBuyer {
  id: string;
  name: string;
  city: string;
}

interface TestRealtor {
  id: string;
  name: string;
  city: string;
}

export async function GET() {
  return NextResponse.json({
    message: 'Consolidation Test Endpoint',
    usage: 'POST to run Dallas-Memphis test',
    availableActions: [
      'create-dallas-memphis',
      'test-matching', 
      'get-stats',
      'cleanup-test-data'
    ]
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({ action: 'create-dallas-memphis' }));
    const { action = 'create-dallas-memphis' } = body;
    
    
    switch (action) {
      case 'create-dallas-memphis':
        return await createDallasMemphisTest();
        
      case 'test-matching':
        return await testMatching();
        
      case 'get-stats':
        return await getStats();
        
      case 'cleanup-test-data':
        return await cleanupTestData();
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
  } catch (error) {
    return NextResponse.json({
      error: 'Test failed',
      details: (error as Error).message
    }, { status: 500 });
  }
}

async function createDallasMemphisTest() {
  
  const results = {
    dallasBuyer: null as TestBuyer | null,
    memphisBuyer: null as TestBuyer | null,
    dallasRealtor: null as TestRealtor | null,
    memphisRealtor: null as TestRealtor | null,
    errors: [] as string[]
  };
  
  try {
    // Create Dallas buyer
    const dallasBuyerId = await ConsolidatedLeadSystem.createBuyerProfile({
      userId: `dallas_buyer_${Date.now()}`,
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith.dallas@ownerfi.test',
      phone: '214-555-1234',
      city: 'Dallas, TX',
      languages: ['English']
    });

    results.dallasBuyer = { id: dallasBuyerId, name: 'John Smith', city: 'Dallas, TX' };

    // Create Memphis buyer
    const memphisBuyerId = await ConsolidatedLeadSystem.createBuyerProfile({
      userId: `memphis_buyer_${Date.now()}`,
      firstName: 'Maria',
      lastName: 'Garcia',
      email: 'maria.garcia.memphis@ownerfi.test',
      phone: '901-555-5678',
      city: 'Memphis, TN',
      languages: ['English']
    });
    
    results.memphisBuyer = { id: memphisBuyerId, name: 'Maria Garcia', city: 'Memphis, TN' };
    
    // Create Dallas realtor
    const dallasRealtorId = `dallas_realtor_${Date.now()}`;
    const dallasRealtorData = {
      email: 'sarah.johnson@dallasrealty.test',
      name: 'Sarah Johnson',
      role: 'realtor',
      password: 'test123',
      realtorData: {
        firstName: 'Sarah',
        lastName: 'Johnson',
        company: 'Dallas Premier Realty',
        credits: 15,
        isOnTrial: true,
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        serviceArea: {
          primaryCity: { name: 'Dallas', state: 'TX', stateCode: 'TX' },
          totalCitiesServed: 1,
          nearbyCities: []
        },
        serviceCities: ['Dallas, TX'],
        languages: ['English']
      }
    };
    
    await FirebaseDB.createDocument('users', dallasRealtorData, dallasRealtorId);
    results.dallasRealtor = { id: dallasRealtorId, name: 'Sarah Johnson', city: 'Dallas, TX' };
    
    // Create Memphis realtor
    const memphisRealtorId = `memphis_realtor_${Date.now()}`;
    const memphisRealtorData = {
      email: 'michael.davis@memphisrealty.test',
      name: 'Michael Davis',
      role: 'realtor',
      password: 'test123',
      realtorData: {
        firstName: 'Michael',
        lastName: 'Davis',
        company: 'Memphis Home Experts',
        credits: 12,
        isOnTrial: true,
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        serviceArea: {
          primaryCity: { name: 'Memphis', state: 'TN', stateCode: 'TN' },
          totalCitiesServed: 1,
          nearbyCities: []
        },
        serviceCities: ['Memphis, TN'],
        languages: ['English']
      }
    };
    
    await FirebaseDB.createDocument('users', memphisRealtorData, memphisRealtorId);
    results.memphisRealtor = { id: memphisRealtorId, name: 'Michael Davis', city: 'Memphis, TN' };
    
  } catch (error) {
    results.errors.push((error as Error).message);
  }
  
  return NextResponse.json({
    action: 'create-dallas-memphis',
    success: results.errors.length === 0,
    results
  });
}

async function testMatching() {
  
  const results = {
    dallasRealtorMatches: [] as Array<{
      id: string;
      name: string;
      city: string;
      state: string;
      score: number;
      reasons: string[];
    }>,
    memphisRealtorMatches: [] as Array<{
      id: string;
      name: string;
      city: string;
      state: string;
      score: number;
      reasons: string[];
    }>,
    crossStateTest: {
      dallasRealtorInMemphis: 0,
      memphisRealtorInDallas: 0
    },
    summary: {
      totalTests: 0,
      passed: 0,
      failed: 0
    }
  };
  
  try {
    // Test Dallas realtor matching (should find Dallas buyers)
    const dallasMatches = await ConsolidatedLeadSystem.findAvailableLeads({
      cities: ['Dallas'],
      languages: ['English'],
      state: 'TX'
    });
    
    results.dallasRealtorMatches = dallasMatches.map(m => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      city: m.city,
      state: m.state,
      score: m.matchScore,
      reasons: m.matchReasons
    }));
    
    results.summary.totalTests++;
    if (dallasMatches.length > 0) {
      results.summary.passed++;
    } else {
      results.summary.failed++;
    }
    
    // Test Memphis realtor matching (should find Memphis buyers)
    const memphisMatches = await ConsolidatedLeadSystem.findAvailableLeads({
      cities: ['Memphis'],
      languages: ['English'],
      state: 'TN'
    });
    
    results.memphisRealtorMatches = memphisMatches.map(m => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      city: m.city,
      state: m.state,
      score: m.matchScore,
      reasons: m.matchReasons
    }));
    
    results.summary.totalTests++;
    if (memphisMatches.length > 0) {
      results.summary.passed++;
    } else {
      results.summary.failed++;
    }
    
    // Test cross-state isolation
    
    // Dallas realtor should NOT find Memphis buyers
    const dallasInMemphis = await ConsolidatedLeadSystem.findAvailableLeads({
      cities: ['Memphis'],  // Dallas realtor looking in Memphis
      languages: ['English'],
      state: 'TX'  // But with TX state - should find nothing
    });
    results.crossStateTest.dallasRealtorInMemphis = dallasInMemphis.length;
    
    // Memphis realtor should NOT find Dallas buyers  
    const memphisInDallas = await ConsolidatedLeadSystem.findAvailableLeads({
      cities: ['Dallas'],  // Memphis realtor looking in Dallas
      languages: ['English'], 
      state: 'TN'  // But with TN state - should find nothing
    });
    results.crossStateTest.memphisRealtorInDallas = memphisInDallas.length;
    
    results.summary.totalTests += 2;
    if (results.crossStateTest.dallasRealtorInMemphis === 0) results.summary.passed++;
    else results.summary.failed++;
    
    if (results.crossStateTest.memphisRealtorInDallas === 0) results.summary.passed++;
    else results.summary.failed++;
    
    
  } catch {
    results.summary.failed++;
  }
  
  return NextResponse.json({
    action: 'test-matching',
    success: results.summary.passed > results.summary.failed,
    results
  });
}

async function getStats() {
  
  try {
    const stats = await ConsolidatedLeadSystem.getSystemStatistics();
    
    return NextResponse.json({
      action: 'get-stats',
      success: true,
      stats
    });
    
  } catch (error) {
    return NextResponse.json({
      action: 'get-stats',
      success: false,
      error: (error as Error).message
    });
  }
}

async function cleanupTestData() {
  
  const results = {
    buyersDeleted: 0,
    realtorsDeleted: 0,
    errors: [] as string[]
  };
  
  try {
    // Find and delete test buyers
    const testBuyers = await FirebaseDB.queryDocuments('buyerProfiles', []);
    
    for (const buyer of testBuyers) {
      const b = buyer as BuyerProfile & { id: string };
      if (b.email && (b.email.includes('.test') || b.email.includes('ownerfi.test'))) {
        await FirebaseDB.deleteDocument('buyerProfiles', b.id);
        results.buyersDeleted++;
      }
    }
    
    // Find and delete test realtors
    const testRealtors = await FirebaseDB.queryDocuments('users', [
      { field: 'role', operator: '==', value: 'realtor' }
    ]);
    
    for (const realtor of testRealtors) {
      const r = realtor as User & { id: string };
      if (r.email && (r.email.includes('.test') || r.id.includes('test_'))) {
        await FirebaseDB.deleteDocument('users', r.id);
        results.realtorsDeleted++;
      }
    }
    
    
  } catch (error) {
    results.errors.push((error as Error).message);
  }
  
  return NextResponse.json({
    action: 'cleanup-test-data',
    success: results.errors.length === 0,
    results
  });
}