import { NextRequest, NextResponse } from 'next/server';
import { ConsolidatedLeadSystem } from '@/lib/consolidated-lead-system';

export async function POST(request: NextRequest) {
  try {
    const testBuyers = [
      {
        userId: "buyer1_test",
        firstName: "John",
        lastName: "Smith", 
        email: "john.smith@test.com",
        phone: "555-111-1111",
        city: "Dallas, TX",
        maxMonthlyPayment: 2000,
        maxDownPayment: 50000,
        languages: ["English"]
      },
      {
        userId: "buyer2_test", 
        firstName: "Maria",
        lastName: "Garcia",
        email: "maria.garcia@test.com", 
        phone: "555-222-2222",
        city: "Houston, TX",
        maxMonthlyPayment: 1500,
        maxDownPayment: 30000,
        languages: ["Spanish"]
      },
      {
        userId: "buyer3_test",
        firstName: "Pierre", 
        lastName: "Johnson",
        email: "pierre.johnson@test.com",
        phone: "555-333-3333",
        city: "Austin, TX", 
        maxMonthlyPayment: 2500,
        maxDownPayment: 75000,
        languages: ["English", "French"]
      },
      {
        userId: "buyer4_test",
        firstName: "Carlos",
        lastName: "Rodriguez",
        email: "carlos.rodriguez@test.com",
        phone: "555-444-4444", 
        city: "San Antonio, TX",
        maxMonthlyPayment: 1800,
        maxDownPayment: 40000,
        languages: ["Spanish", "English"]
      },
      {
        userId: "buyer5_test",
        firstName: "Lisa",
        lastName: "Williams", 
        email: "lisa.williams@test.com",
        phone: "555-555-5555",
        city: "Fort Worth, TX",
        maxMonthlyPayment: 3000,
        maxDownPayment: 100000,
        languages: ["English"]
      }
    ];

    const results = [];
    
    for (const buyer of testBuyers) {
      try {
        const profileId = await ConsolidatedLeadSystem.createBuyerProfile(buyer);
        results.push({ success: true, profileId, buyer: buyer.firstName });
      } catch (error) {
        results.push({ success: false, error: (error as Error).message || 'Unknown error', buyer: buyer.firstName });
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Test buyer profiles created in buyerProfiles collection',
      results: results
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}