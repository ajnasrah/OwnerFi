import { NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';
import { ConsolidatedLeadSystem } from '@/lib/consolidated-lead-system';

export async function GET() {
  try {
    
    // Get all buyers 
    const allBuyers = await FirebaseDB.queryDocuments('buyerProfiles', []);
    
    // Filter Dallas buyers
    const dallasBuyers = allBuyers.filter((buyer: any) => {
      const city = buyer.preferredCity || buyer.city || '';
      return city.toLowerCase().includes('dallas');
    });
    
    
    // Check each Dallas buyer's data structure
    const dallasAnalysis = dallasBuyers.map((buyer: any) => {
      return {
        id: buyer.id,
        name: `${buyer.firstName} ${buyer.lastName}`,
        userId: buyer.userId,
        
        // Check all city/state fields
        preferredCity: buyer.preferredCity,
        preferredState: buyer.preferredState,
        city: buyer.city,
        state: buyer.state,
        
        // Check availability flags
        isAvailableForPurchase: buyer.isAvailableForPurchase,
        isActive: buyer.isActive,
        profileComplete: buyer.profileComplete,
        
        // Check if this buyer would be found by state query
        wouldMatchTXQuery: buyer.preferredState === 'TX' || buyer.state === 'TX',
        
        // Other data
        maxMonthlyPayment: buyer.maxMonthlyPayment,
        maxDownPayment: buyer.maxDownPayment,
        languages: buyer.languages,
        createdAt: buyer.createdAt,
        updatedAt: buyer.updatedAt
      };
    });
    
    // Test the exact query ConsolidatedLeadSystem uses
    const txBuyersQuery = await FirebaseDB.queryDocuments('buyerProfiles', [
      { field: 'preferredState', operator: '==', value: 'TX' },
      { field: 'isAvailableForPurchase', operator: '==', value: true },
      { field: 'isActive', operator: '==', value: true },
      { field: 'profileComplete', operator: '==', value: true }
    ]);
    
    
    const txQueryResults = txBuyersQuery.map((buyer: any) => ({
      id: buyer.id,
      name: `${buyer.firstName} ${buyer.lastName}`,
      city: buyer.preferredCity || buyer.city,
      state: buyer.preferredState || buyer.state
    }));
    
    // Test Dallas realtor profile matching manually
    const dallasRealtorProfile = {
      cities: ['Dallas'],
      languages: ['English'],
      state: 'TX'
    };
    
    const dallasMatches = await ConsolidatedLeadSystem.findAvailableLeads(dallasRealtorProfile);
    
    return NextResponse.json({
      summary: {
        totalBuyers: allBuyers.length,
        dallasBuyers: dallasBuyers.length,
        txQueryResults: txBuyersQuery.length,
        dallasMatches: dallasMatches.length
      },
      dallasBuyersAnalysis: dallasAnalysis,
      txQueryResults: txQueryResults,
      dallasMatchingTest: {
        realtorProfile: dallasRealtorProfile,
        matches: dallasMatches.map(m => ({
          id: m.id,
          name: `${m.firstName} ${m.lastName}`,
          city: m.city,
          state: m.state,
          score: m.matchScore,
          reasons: m.matchReasons
        }))
      }
    });

  } catch {
    return NextResponse.json({ 
      error: 'Analysis failed',
      details: (error as Error).message
    }, { status: 500 });
  }
}