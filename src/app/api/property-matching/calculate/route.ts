import { NextRequest, NextResponse } from 'next/server';
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  orderBy,
  limit
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

    // PERFORMANCE FIX: Query only properties within buyer's budget
    // This reduces from loading ALL properties in state (1000+) to only relevant ones (100-200)
    const propertiesQuery = query(
      collection(db!, 'properties'),
      where('isActive', '==', true),
      where('state', '==', criteria.state),
      where('monthlyPayment', '<=', criteria.maxMonthlyPayment),
      orderBy('monthlyPayment', 'asc'),
      limit(500) // Limit to prevent excessive processing
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

      // Monthly payment already filtered in query
      matchScore += 35;
      matchReasons.push('monthly_budget_match');

      // Down payment budget check
      if (property.downPaymentAmount <= criteria.maxDownPayment) {
        matchScore += 35;
        matchReasons.push('down_payment_match');
      } else continue; // Skip if over down payment budget

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


    // RELIABILITY FIX: Save matches using chunked batch writes (max 500 operations per batch)
    const BATCH_SIZE = 500;

    // Clear existing matches for this buyer
    const existingMatchesQuery = query(
      collection(db!, 'propertyMatches'),
      where('buyerId', '==', buyerId)
    );
    const existingMatches = await getDocs(existingMatchesQuery);

    // Prepare all operations
    const operations = [
      // Delete operations
      ...existingMatches.docs.map(matchDoc => ({
        type: 'delete' as const,
        ref: matchDoc.ref
      })),
      // Write operations
      ...matches.map(match => ({
        type: 'set' as const,
        ref: doc(collection(db!, 'propertyMatches'), match.id),
        data: match
      }))
    ];

    // Chunk into batches of 500
    const batches = [];
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const chunk = operations.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      chunk.forEach(op => {
        if (op.type === 'delete') {
          batch.delete(op.ref);
        } else {
          batch.set(op.ref, op.data);
        }
      });

      batches.push(batch);
    }

    // Commit all batches in parallel
    await Promise.all(batches.map(batch => batch.commit()));

    console.log(`✅ Saved ${matches.length} matches for buyer ${buyerId} in ${batches.length} batch(es)`);


    return NextResponse.json({
      success: true,
      totalMatches: matches.length,
      perfectMatches: matches.filter(m => m.matchScore >= 90).length,
      goodMatches: matches.filter(m => m.matchScore >= 70 && m.matchScore < 90).length
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed to calculate matches' }, { status: 500 });
  }
}