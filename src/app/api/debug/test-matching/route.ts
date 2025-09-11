import { NextResponse } from 'next/server';
import { ConsolidatedLeadSystem } from '@/lib/consolidated-lead-system';

export async function GET() {
  try {
    // Test realtor profiles for each city
    const realtorProfiles = [
      {
        name: "Dallas Realtor",
        cities: ["Dallas"],
        languages: ["English"],
        state: "TX"
      },
      {
        name: "Houston Realtor", 
        cities: ["Houston"],
        languages: ["English", "Spanish"],
        state: "TX"
      },
      {
        name: "Austin Realtor",
        cities: ["Austin"],
        languages: ["English"],
        state: "TX"
      }
    ];

    const results = [];
    
    for (const realtorProfile of realtorProfiles) {
      try {
        const leads = await ConsolidatedLeadSystem.findAvailableLeads(realtorProfile);
        
        results.push({
          realtor: realtorProfile.name,
          servingCities: realtorProfile.cities,
          matchedLeads: leads.map(lead => ({
            name: `${lead.firstName} ${lead.lastName}`,
            city: lead.city,
            state: lead.state,
            matchScore: lead.matchScore,
            matchReasons: lead.matchReasons
          }))
        });
        
        
      } catch (error) {
        results.push({
          realtor: realtorProfile.name,
          error: (error as Error).message
        });
      }
    }

    return NextResponse.json({ 
      success: true,
      testResults: results
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}