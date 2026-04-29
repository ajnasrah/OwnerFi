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
import { 
  matchPropertyToBuyersEfficient,
  matchBuyerToPropertiesEfficient 
} from '@/lib/matching-efficient';
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
    // MEMORY-EFFICIENT: Use cursor-based pagination to avoid loading all buyers at once
    const result = await matchPropertyToBuyersEfficient(property.id);
    
    console.log(`✅ Matched property ${property.id} to ${result.matchedBuyers} buyers (out of ${result.totalBuyers} total)`);
    
    // Note: GoHighLevel notifications are now handled within the efficient matching function
    // to avoid loading all matched buyers into memory at once
    
  } catch (error) {
    console.error('Failed to match property to buyers:', error);
    throw error;
  }
}

// Note: Individual property-buyer matching is now handled by the efficient matching functions
// which use cursor-based pagination to avoid memory issues

// GET endpoint to refresh all matches (maintenance operation)
export async function GET(request: NextRequest) {
  try {
    // MEMORY-EFFICIENT: Process one buyer at a time using cursor-based pagination
    const { searchParams } = new URL(request.url);
    const buyerId = searchParams.get('buyerId');
    
    if (buyerId) {
      // Refresh matches for a specific buyer
      const result = await matchBuyerToPropertiesEfficient(buyerId);
      return NextResponse.json({
        success: true,
        message: `Refreshed matches for buyer ${buyerId}`,
        matchedProperties: result.matchedProperties,
        totalProperties: result.totalProperties
      });
    }
    
    // For bulk refresh, return instructions to use the new efficient approach
    return NextResponse.json({
      success: false,
      message: 'Bulk match refresh has been deprecated due to memory issues.',
      instructions: 'Use POST /api/properties/sync-matches with action="recalculate" instead, or specify a buyerId parameter to refresh a single buyer.'
    }, { status: 400 });

  } catch (error) {
    console.error('Failed to refresh matches:', error);
    return NextResponse.json(
      { error: 'Failed to refresh matches' },
      { status: 500 }
    );
  }
}