/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { ConsolidatedLeadSystem } from '@/lib/consolidated-lead-system';
import { FirebaseDB } from '@/lib/firebase-db';

export async function GET() {
  try {
    // Test Memphis realtor profile
    const memphisRealtorProfile = {
      cities: ["Memphis"],
      languages: ["English"],
      state: "TN"
    };


    // Get all TN buyers first
    const tnBuyers = await FirebaseDB.queryDocuments('buyerProfiles', [
      { field: 'state', operator: '==', value: 'TN' }
    ]);

    // Test the matching system
    const leads = await ConsolidatedLeadSystem.findAvailableLeads(memphisRealtorProfile);

    return NextResponse.json({ 
      success: true,
      realtorProfile: memphisRealtorProfile,
      allTnBuyers: (tnBuyers as any[]).map((b: any) => ({
        name: `${b.firstName} ${b.lastName}`,
        city: b.preferredCity || b.city,
        state: b.preferredState || b.state,
        isAvailable: b.isAvailableForPurchase,
        isActive: b.isActive,
        profileComplete: b.profileComplete,
        languages: b.languages
      })),
      matchedLeads: (leads as any[]).map((lead: any) => ({
        name: `${lead.firstName} ${lead.lastName}`,
        city: lead.city,
        state: lead.state,
        matchScore: lead.matchScore,
        matchReasons: lead.matchReasons
      }))
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}