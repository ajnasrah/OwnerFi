import { NextRequest, NextResponse } from 'next/server';
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firestoreHelpers } from '@/lib/firestore';
import { PropertyListing } from '@/lib/property-schema';

/**
 * BACKGROUND PROPERTY MATCHING CALCULATOR
 * 
 * Purpose: Calculate property matches for a buyer and store in separate collection
 * Called after buyer profile is saved (non-blocking)
 */

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const { buyerId } = await request.json();
    
    if (!buyerId) {
      return NextResponse.json({ error: 'Missing buyerId' }, { status: 400 });
    }


    // Get buyer profile
    const buyerDoc = await getDocs(query(
      collection(db!, 'buyerProfiles'),
      where('__name__', '==', buyerId)
    ));

    if (buyerDoc.empty) {
      return NextResponse.json({ error: 'Buyer profile not found' }, { status: 404 });
    }

    const buyerData = buyerDoc.docs[0].data();
    const criteria = buyerData.searchCriteria;

    if (!criteria) {
      return NextResponse.json({ error: 'No search criteria found' }, { status: 400 });
    }

    // Get all active properties in buyer's state
    const propertiesQuery = query(
      collection(db!, 'properties'),
      where('isActive', '==', true),
      where('state', '==', criteria.state)
    );
    
    const propertiesSnapshot = await getDocs(propertiesQuery);
    const allProperties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PropertyListing));


    // Calculate matches with scoring
    const matches = [];
    
    for (const property of allProperties) {
      let matchScore = 0;
      const matchReasons = [];

      // Location match (required)
      const cityMatch = criteria.cities.some((city: string) => 
        property.city.toLowerCase() === city.toLowerCase()
      );
      if (!cityMatch) continue; // Skip if not in buyer's cities

      matchScore += 30;
      matchReasons.push('location_match');

      // Budget matches
      if (property.monthlyPayment <= criteria.maxMonthlyPayment) {
        matchScore += 35;
        matchReasons.push('monthly_budget_match');
      } else continue; // Skip if over budget

      if (property.downPaymentAmount <= criteria.maxDownPayment) {
        matchScore += 35;
        matchReasons.push('down_payment_match');
      } else continue; // Skip if over budget

      // Bedroom match (bonus)
      if (!criteria.minBedrooms || property.bedrooms >= criteria.minBedrooms) {
        if (criteria.minBedrooms) {
          matchScore += 10;
          matchReasons.push('bedroom_match');
        }
      } else continue;

      // Bathroom match (bonus)  
      if (!criteria.minBathrooms || property.bathrooms >= criteria.minBathrooms) {
        if (criteria.minBathrooms) {
          matchScore += 10;
          matchReasons.push('bathroom_match');
        }
      } else continue;

      // Create match record
      matches.push({
        id: firestoreHelpers.generateId(),
        buyerId: buyerId,
        propertyId: property.id,
        matchScore: Math.min(100, matchScore),
        matchReasons: matchReasons,
        status: 'pending',
        matchedAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }


    // Save matches to database using batch write for performance
    const batch = writeBatch(db);
    
    // Clear existing matches for this buyer
    const existingMatchesQuery = query(
      collection(db!, 'propertyMatches'),
      where('buyerId', '==', buyerId)
    );
    const existingMatches = await getDocs(existingMatchesQuery);
    
    existingMatches.docs.forEach(matchDoc => {
      batch.delete(matchDoc.ref);
    });

    // Add new matches
    matches.forEach(match => {
      const matchRef = doc(collection(db!, 'propertyMatches'), match.id);
      batch.set(matchRef, match);
    });

    await batch.commit();


    return NextResponse.json({
      success: true,
      totalMatches: matches.length,
      perfectMatches: matches.filter(m => m.matchScore >= 90).length,
      goodMatches: matches.filter(m => m.matchScore >= 70 && m.matchScore < 90).length
    });

  } catch {
    return NextResponse.json({ error: 'Failed to calculate matches' }, { status: 500 });
  }
}