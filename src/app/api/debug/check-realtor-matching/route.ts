import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';
import { ConsolidatedLeadSystem } from '@/lib/consolidated-lead-system';

export async function GET(request: NextRequest) {
  try {
    
    // Get all realtor users
    const realtorUsers = await FirebaseDB.queryDocuments('users', [
      { field: 'role', operator: '==', value: 'realtor' }
    ]);
    
    // Get all buyer profiles  
    const allBuyers = await FirebaseDB.queryDocuments('buyerProfiles', [
      { field: 'isAvailableForPurchase', operator: '==', value: true }
    ]);
    
    
    const debugResults = [];
    
    for (const realtorUser of realtorUsers) {
      const realtor = realtorUser as any;
      
      
      if (!realtor.realtorData?.serviceArea?.primaryCity) {
        debugResults.push({
          realtorId: realtor.id,
          realtorName: realtor.name,
          issue: 'No service area configured',
          serviceArea: null,
          matches: []
        });
        continue;
      }
      
      // Extract service cities
      const serviceArea = realtor.realtorData.serviceArea;
      let cities: string[] = [];
      
      if (serviceArea.primaryCity?.name) {
        cities = [serviceArea.primaryCity.name];
        
        if (serviceArea.nearbyCities && serviceArea.nearbyCities.length > 0) {
          const nearbyCities = serviceArea.nearbyCities.map((c: any) => c.name || c);
          cities.push(...nearbyCities);
        }
      }
      
      if (realtor.realtorData.serviceCities && realtor.realtorData.serviceCities.length > 0) {
        cities = realtor.realtorData.serviceCities.map((city: string) => city.split(',')[0]?.trim());
      }
      
      const realtorProfile = {
        cities: cities,
        languages: realtor.realtorData.languages || ['English'],
        state: serviceArea.primaryCity?.state || 'TX'
      };
      
      
      // Test matching
      const matches = await ConsolidatedLeadSystem.findAvailableLeads(realtorProfile);
      
      
      // Check which buyers should match
      const potentialBuyers = allBuyers.filter((buyer: any) => {
        const buyerCity = buyer.preferredCity || buyer.city;
        const buyerState = buyer.preferredState || buyer.state;
        
        const cityMatch = cities.some(city => 
          city.toLowerCase() === buyerCity?.toLowerCase()
        );
        const stateMatch = buyerState === realtorProfile.state;
        
        
        return cityMatch && stateMatch;
      });
      
      debugResults.push({
        realtorId: realtor.id,
        realtorName: realtor.name,
        serviceArea: realtorProfile,
        potentialBuyers: potentialBuyers.length,
        actualMatches: matches.length,
        matches: matches.map(m => ({
          id: m.id,
          name: `${m.firstName} ${m.lastName}`,
          city: m.city,
          state: m.state,
          score: m.matchScore
        })),
        buyers: potentialBuyers.map((b: any) => ({
          id: b.id,
          name: `${b.firstName} ${b.lastName}`,
          city: b.preferredCity || b.city,
          state: b.preferredState || b.state
        }))
      });
    }
    
    return NextResponse.json({
      totalRealtors: realtorUsers.length,
      totalBuyers: allBuyers.length,
      debugResults
    });

  } catch (error) {
    return NextResponse.json({ error: 'Debug failed' }, { status: 500 });
  }
}