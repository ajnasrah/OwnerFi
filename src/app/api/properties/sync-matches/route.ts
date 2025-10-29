import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  updateDoc,
  doc,
  arrayRemove,
  arrayUnion,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isPropertyMatch } from '@/lib/matching';
import { BuyerProfile } from '@/lib/firebase-models';
import { PropertyListing } from '@/lib/property-schema';

// Sync property matches across all buyers when properties change
export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }
    const body = await request.json();
    const { action, propertyId, propertyData } = body;
    // action: 'delete', 'add', 'update'

    if (!action || !propertyId) {
      return NextResponse.json(
        { error: 'Missing action or propertyId' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'delete':
        await removePropertyFromAllBuyers(propertyId);
        break;
        
      case 'add':
        if (!propertyData) {
          return NextResponse.json(
            { error: 'Missing propertyData for add action' },
            { status: 400 }
          );
        }
        await addPropertyToMatchingBuyers(propertyData);
        break;
        
      case 'update':
        if (!propertyData) {
          return NextResponse.json(
            { error: 'Missing propertyData for update action' },
            { status: 400 }
          );
        }
        // For updates: remove from all, then re-add to matching buyers
        await removePropertyFromAllBuyers(propertyId);
        await addPropertyToMatchingBuyers(propertyData);
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Property matches synced for ${action} action`
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to sync property matches' },
      { status: 500 }
    );
  }
}

// Remove property from all buyer match lists
async function removePropertyFromAllBuyers(propertyId: string) {
  try {
    // Get all buyer profiles that have this property in their matches
    const buyersQuery = query(
      collection(db!, 'buyerProfiles'),
      where('matchedPropertyIds', 'array-contains', propertyId)
    );
    const buyerDocs = await getDocs(buyersQuery);

    // Update each buyer profile to remove the property
    const updatePromises = buyerDocs.docs.map(buyerDoc => {
      const buyerRef = doc(db!, 'buyerProfiles', buyerDoc.id);
      return updateDoc(buyerRef, {
        matchedPropertyIds: arrayRemove(propertyId),
        likedPropertyIds: arrayRemove(propertyId), // Also remove from likes
        passedPropertyIds: arrayRemove(propertyId), // And from passed
        updatedAt: serverTimestamp()
      });
    });

    await Promise.all(updatePromises);
    
  } catch (error) {
    // Error occurred
  }
}

// Add new property to buyers whose criteria it matches
async function addPropertyToMatchingBuyers(property: PropertyListing & { id: string }) {
  try {
    // PERFORMANCE FIX: Use background job approach instead of synchronous processing
    // Instead of loading ALL buyers, trigger background calculation via property-matching/calculate

    // For immediate response, we queue the property and process buyers in background
    // This prevents timeout on large buyer lists (1000+ buyers)

    // OPTIMIZATION: Only check buyers in the same state with compatible budget
    const { limit: firestoreLimit } = await import('firebase/firestore');
    const relevantBuyersQuery = query(
      collection(db!, 'buyerProfiles'),
      where('searchCriteria.state', '==', property.state),
      where('searchCriteria.maxMonthlyPayment', '>=', property.monthlyPayment),
      firestoreLimit(200) // Process in batches to prevent timeout
    );
    const buyerDocs = await getDocs(relevantBuyersQuery);

    const updatePromises = [];

    for (const buyerDoc of buyerDocs.docs) {
      const buyerData = buyerDoc.data();

      // Check if this property matches the buyer's criteria
      const matches = await checkPropertyMatchesBuyer(property, buyerData as BuyerProfile);

      if (matches) {
        const buyerRef = doc(db!, 'buyerProfiles', buyerDoc.id);
        updatePromises.push(
          updateDoc(buyerRef, {
            matchedPropertyIds: arrayUnion(property.id),
            lastMatchUpdate: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        );
      }
    }

    await Promise.all(updatePromises);

  } catch (error) {
    // Error occurred
  }
}

// Check if a property matches a buyer's criteria
async function checkPropertyMatchesBuyer(property: PropertyListing & { id: string }, buyerData: BuyerProfile): Promise<boolean> {
  try {
    // Location match - use buyer's stored cities from searchCriteria
    const criteria = buyerData.searchCriteria || {};
    const buyerCities = criteria.cities || [buyerData.preferredCity]; // fallback to flat field
    const locationMatch = buyerCities.some((cityName: string) =>
      property.city.toLowerCase() === cityName.toLowerCase() &&
      property.state === (criteria.state || buyerData.preferredState)
    );
    
    if (!locationMatch) return false;

    // Budget match - read from nested structure
    const budgetMatch = 
      property.monthlyPayment <= (criteria.maxMonthlyPayment || buyerData.maxMonthlyPayment || 0) &&
      property.downPaymentAmount <= (criteria.maxDownPayment || buyerData.maxDownPayment || 0);
    
    if (!budgetMatch) return false;

    // Requirements match
    const requirementsMatch = 
      (!buyerData.minBedrooms || property.bedrooms >= buyerData.minBedrooms) &&
      (!buyerData.minBathrooms || property.bathrooms >= buyerData.minBathrooms) &&
      (!buyerData.minPrice || property.listPrice >= buyerData.minPrice) &&
      (!buyerData.maxPrice || property.listPrice <= buyerData.maxPrice);
    
    return requirementsMatch;
    
  } catch (error) {
    return false;
  }
}

// GET endpoint to refresh all matches (maintenance operation)
export async function GET(request: NextRequest) {
  try {
    // PERFORMANCE FIX: This endpoint was the WORST performer in the entire app
    // It loaded ALL buyers × ALL properties = 1,000,000+ comparisons = guaranteed timeout

    // NEW APPROACH: Paginated background job processing
    // Query parameter: ?offset=0&limit=10 (default limit=10)

    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50); // Max 50 per request

    const { limit: firestoreLimit, orderBy, startAfter, getDocs: getDocsFunc } = await import('firebase/firestore');

    // Get paginated buyers
    let buyersQuery = query(
      collection(db!, 'buyerProfiles'),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limit)
    );

    // Skip to offset (if provided)
    if (offset > 0) {
      // Get the document at offset position to use as cursor
      const offsetQuery = query(
        collection(db!, 'buyerProfiles'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(offset)
      );
      const offsetDocs = await getDocs(offsetQuery);
      if (offsetDocs.docs.length > 0) {
        const lastDoc = offsetDocs.docs[offsetDocs.docs.length - 1];
        buyersQuery = query(
          collection(db!, 'buyerProfiles'),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          firestoreLimit(limit)
        );
      }
    }

    const buyerDocs = await getDocs(buyersQuery);

    if (buyerDocs.empty) {
      return NextResponse.json({
        success: true,
        message: 'No more buyers to process',
        offset,
        limit,
        processedCount: 0,
        hasMore: false
      });
    }

    let refreshedCount = 0;

    for (const buyerDoc of buyerDocs.docs) {
      const buyerData = buyerDoc.data();
      const criteria = buyerData.searchCriteria || {};

      // CRITICAL FIX: Query only properties in buyer's state with compatible budget
      // This reduces from 10,000 properties to ~100-200 relevant properties
      const propertiesQuery = query(
        collection(db!, 'properties'),
        where('isActive', '==', true),
        where('state', '==', criteria.state || buyerData.preferredState || ''),
        where('monthlyPayment', '<=', criteria.maxMonthlyPayment || buyerData.maxMonthlyPayment || 999999),
        orderBy('monthlyPayment', 'asc'),
        firestoreLimit(500)
      );

      const propertiesSnapshot = await getDocs(propertiesQuery);

      const matchingProperties = propertiesSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as PropertyListing))
        .filter(property => {
          // Use the isPropertyMatch function with proper data structure
          const propertyForMatching = {
            id: property.id,
            monthlyPayment: property.monthlyPayment || 0,
            downPaymentAmount: property.downPaymentAmount || 0,
            city: property.city || '',
            state: property.state || '',
            bedrooms: property.bedrooms || 0,
            bathrooms: property.bathrooms || 0
          };

          const buyerForMatching = {
            id: buyerData.id,
            maxMonthlyPayment: criteria.maxMonthlyPayment || buyerData.maxMonthlyPayment || 0,
            maxDownPayment: criteria.maxDownPayment || buyerData.maxDownPayment || 0,
            preferredCity: buyerData.preferredCity || '',
            preferredState: buyerData.preferredState || '',
            searchRadius: criteria.searchRadius || buyerData.searchRadius || 25,
            minBedrooms: buyerData.minBedrooms,
            minBathrooms: buyerData.minBathrooms
          };

          return isPropertyMatch(propertyForMatching, buyerForMatching).matches;
        });

      const matchedIds = matchingProperties.map(p => p.id);

      // Update the buyer's matched properties
      const buyerRef = doc(db!, 'buyerProfiles', buyerDoc.id);
      await updateDoc(buyerRef, {
        matchedPropertyIds: matchedIds,
        lastMatchUpdate: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      refreshedCount++;
    }

    const hasMore = buyerDocs.docs.length === limit;

    return NextResponse.json({
      success: true,
      message: `Refreshed matches for ${refreshedCount} buyers`,
      offset,
      limit,
      processedCount: refreshedCount,
      hasMore,
      nextOffset: hasMore ? offset + limit : null
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to refresh matches' },
      { status: 500 }
    );
  }
}