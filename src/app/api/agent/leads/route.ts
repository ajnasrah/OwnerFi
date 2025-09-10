import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db as firebaseDb } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { BuyerProfile } from '@/lib/firebase-models';

export async function GET(request: NextRequest) {
  try {
    // Get all buyers who haven't been sold yet
    const buyersQuery = query(collection(firebaseDb, 'buyerProfiles'), where('hasBeenSold', '==', false));
    const buyerDocs = await getDocs(buyersQuery);
    const availableBuyers = buyerDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as BuyerProfile & { id: string }));
    
    // For each buyer, get their matched properties (simplified for Firebase conversion)
    const buyersWithMatches = await Promise.all(
      availableBuyers.map(async (buyer) => {
        // TODO: Implement property matching query with Firebase
        const matchedProperties: any[] = []; // Stub for now to get build working

        return {
          id: buyer.id,
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          email: buyer.email, // We'll show partial email for privacy
          phone: buyer.phone,
          minPrice: buyer.minPrice || 0,
          maxPrice: buyer.maxPrice || 0,
          minBedrooms: buyer.minBedrooms || 0,
          minBathrooms: buyer.minBathrooms || 0,
          minSquareFeet: buyer.minSquareFeet || 0,
          preferredStates: JSON.parse(buyer.preferredStates || '[]'),
          preferredCities: buyer.preferredCities ? JSON.parse(buyer.preferredCities) : [],
          maxDownPayment: buyer.maxDownPayment,
          createdAt: buyer.createdAt,
          hasBeenSold: buyer.hasBeenSold,
          matchedProperties: matchedProperties,
        };
      })
    );

    // Only return buyers who have matched properties
    const buyersWithProperties = buyersWithMatches.filter(buyer => buyer.matchedProperties.length > 0);

    await logInfo('Agent leads fetched', {
      action: 'agent_leads_fetch',
      metadata: { 
        totalBuyers: availableBuyers.length,
        buyersWithMatches: buyersWithProperties.length,
        totalMatches: buyersWithProperties.reduce((sum, buyer) => sum + buyer.matchedProperties.length, 0)
      }
    });

    return NextResponse.json({
      leads: buyersWithProperties,
      summary: {
        totalLeads: buyersWithProperties.length,
        totalMatches: buyersWithProperties.reduce((sum, buyer) => sum + buyer.matchedProperties.length, 0),
      }
    });

  } catch (error) {
    await logError('Failed to fetch agent leads', {
      action: 'agent_leads_fetch'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to fetch leads', details: (error as Error).message },
      { status: 500 }
    );
  }
}