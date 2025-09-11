import { NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';
import { ConsolidatedLeadSystem } from '@/lib/consolidated-lead-system';

export async function GET() {
  try {
    
    // Get all buyer profiles
    const allBuyerProfiles = await FirebaseDB.queryDocuments('buyerProfiles', []);
    
    
    // Get system statistics
    const stats = await ConsolidatedLeadSystem.getSystemStatistics();
    
    const summary = allBuyerProfiles.map((buyer: any) => ({
      id: buyer.id,
      name: `${buyer.firstName} ${buyer.lastName}`,
      city: buyer.preferredCity || buyer.city,
      state: buyer.preferredState || buyer.state,
      budget: `$${buyer.maxMonthlyPayment}/mo`,
      languages: buyer.languages,
      isAvailable: buyer.isAvailableForPurchase,
      isActive: buyer.isActive,
      profileComplete: buyer.profileComplete,
      purchasedBy: buyer.purchasedBy || null
    }));
    
    return NextResponse.json({
      totalProfiles: allBuyerProfiles.length,
      profiles: summary,
      systemStats: stats
    });

  } catch {
    return NextResponse.json({ error: 'Failed', details: (error as Error).message }, { status: 500 });
  }
}