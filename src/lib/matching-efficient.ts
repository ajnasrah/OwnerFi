import { normalizeState } from './firebase-models';
import * as admin from 'firebase-admin';

// Simplified property interface for matching algorithm
interface PropertyForMatching {
  id: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  listPrice?: number;
  latitude?: number;
  longitude?: number;
}

// Simplified buyer interface for matching algorithm
interface BuyerForMatching {
  id: string;
  preferredCity: string;
  preferredState: string;
  searchRadius: number;
  latitude?: number;
  longitude?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  minPrice?: number;
  maxPrice?: number;
  filter?: {
    nearbyCities?: string[];
    boundingBox?: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    };
  };
}

/**
 * Calculate distance between two lat/lng points using Haversine formula
 * Returns distance in miles
 */
function calculateDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Normalize city name for comparison
 */
function normalizeCity(city: string): string {
  if (!city) return '';
  return city.trim().toLowerCase();
}

interface MatchResult {
  matches: boolean;
  score: number;
  matchedOn: {
    location: boolean;
    bedrooms: boolean;
    bathrooms: boolean;
  };
  distanceMiles?: number;
}

/**
 * Check if property is within buyer's location criteria
 */
function isLocationMatch(
  property: PropertyForMatching,
  buyer: BuyerForMatching
): { matches: boolean; distanceMiles?: number } {
  const propCity = normalizeCity(property.city);
  const propState = normalizeState(property.state);
  const buyerCity = normalizeCity(buyer.preferredCity);
  const buyerState = normalizeState(buyer.preferredState);

  // Strategy 1: Check if property city is in buyer's nearbyCities array
  if (buyer.filter?.nearbyCities && buyer.filter.nearbyCities.length > 0) {
    const normalizedNearbyCities = buyer.filter.nearbyCities.map(c => normalizeCity(c));
    if (normalizedNearbyCities.includes(propCity)) {
      if (property.latitude && property.longitude && buyer.latitude && buyer.longitude) {
        const distance = calculateDistanceMiles(
          buyer.latitude, buyer.longitude,
          property.latitude, property.longitude
        );
        return { matches: true, distanceMiles: distance };
      }
      return { matches: true };
    }
  }

  // Strategy 2: Exact city/state match
  if (propCity === buyerCity && propState === buyerState) {
    return { matches: true, distanceMiles: 0 };
  }

  // Strategy 3: Calculate actual distance if both have lat/lng
  if (property.latitude && property.longitude && buyer.latitude && buyer.longitude) {
    const distance = calculateDistanceMiles(
      buyer.latitude, buyer.longitude,
      property.latitude, property.longitude
    );
    const radius = buyer.searchRadius || 25;
    if (distance <= radius) {
      return { matches: true, distanceMiles: distance };
    }
  }

  // Strategy 4: Check bounding box
  if (buyer.filter?.boundingBox && property.latitude && property.longitude) {
    const { minLat, maxLat, minLng, maxLng } = buyer.filter.boundingBox;
    if (
      property.latitude >= minLat &&
      property.latitude <= maxLat &&
      property.longitude >= minLng &&
      property.longitude <= maxLng
    ) {
      return { matches: true };
    }
  }

  return { matches: false };
}

/**
 * Check if a property matches a buyer's criteria
 */
export function isPropertyMatch(property: PropertyForMatching, buyer: BuyerForMatching): MatchResult {
  const matchedOn = {
    location: false,
    bedrooms: false,
    bathrooms: false
  };

  let score = 0;
  let totalCriteria = 0;

  // 1. Location Check (CRITICAL)
  totalCriteria++;
  const locationResult = isLocationMatch(property, buyer);
  if (locationResult.matches) {
    matchedOn.location = true;
    score++;
  } else {
    return { matches: false, score: 0, matchedOn };
  }

  // 2. Bedrooms
  if (buyer.minBedrooms !== undefined || buyer.maxBedrooms !== undefined) {
    totalCriteria++;
    const meetsMin = buyer.minBedrooms === undefined || property.bedrooms >= buyer.minBedrooms;
    const meetsMax = buyer.maxBedrooms === undefined || property.bedrooms <= buyer.maxBedrooms;
    if (meetsMin && meetsMax) {
      matchedOn.bedrooms = true;
      score++;
    } else {
      return { matches: false, score: 0, matchedOn };
    }
  }

  // 3. Bathrooms
  if (buyer.minBathrooms !== undefined || buyer.maxBathrooms !== undefined) {
    totalCriteria++;
    const meetsMin = buyer.minBathrooms === undefined || property.bathrooms >= buyer.minBathrooms;
    const meetsMax = buyer.maxBathrooms === undefined || property.bathrooms <= buyer.maxBathrooms;
    if (meetsMin && meetsMax) {
      matchedOn.bathrooms = true;
      score++;
    } else {
      return { matches: false, score: 0, matchedOn };
    }
  }

  // 4. Square Feet
  if ((buyer.minSquareFeet !== undefined || buyer.maxSquareFeet !== undefined) && property.squareFeet) {
    totalCriteria++;
    const meetsMin = buyer.minSquareFeet === undefined || property.squareFeet >= buyer.minSquareFeet;
    const meetsMax = buyer.maxSquareFeet === undefined || property.squareFeet <= buyer.maxSquareFeet;
    if (meetsMin && meetsMax) {
      score++;
    } else {
      return { matches: false, score: 0, matchedOn };
    }
  }

  // 5. Price
  if ((buyer.minPrice !== undefined || buyer.maxPrice !== undefined) && property.listPrice) {
    totalCriteria++;
    const meetsMin = buyer.minPrice === undefined || property.listPrice >= buyer.minPrice;
    const meetsMax = buyer.maxPrice === undefined || property.listPrice <= buyer.maxPrice;
    if (meetsMin && meetsMax) {
      score++;
    } else {
      return { matches: false, score: 0, matchedOn };
    }
  }

  const finalScore = score / totalCriteria;
  return {
    matches: true,
    score: finalScore,
    matchedOn,
    distanceMiles: locationResult.distanceMiles
  };
}

/**
 * MEMORY-EFFICIENT: Match a buyer to properties using cursor-based pagination
 * Processes properties in batches to avoid loading entire dataset into memory
 */
export async function matchBuyerToPropertiesEfficient(buyerId: string) {
  const db = admin.firestore();
  const BATCH_SIZE = 100; // Process 100 properties at a time
  const MAX_MATCHES_PER_BATCH = 500; // Write matches in batches
  
  try {
    // Get buyer profile
    const buyerDoc = await db.collection('buyer_profiles').doc(buyerId).get();
    if (!buyerDoc.exists) throw new Error('Buyer not found');
    const buyer = { id: buyerId, ...buyerDoc.data() } as BuyerForMatching;

    let totalProperties = 0;
    let totalMatches = 0;
    let pendingMatches: any[] = [];
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
    let hasMore = true;

    while (hasMore) {
      // Build query with cursor
      let query = db.collection('properties')
        .where('isActive', '==', true)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(BATCH_SIZE);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      
      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      // Process this batch
      for (const doc of snapshot.docs) {
        totalProperties++;
        const property = { id: doc.id, ...doc.data() } as PropertyForMatching;
        
        const matchResult = isPropertyMatch(property, buyer);
        
        if (matchResult.matches) {
          pendingMatches.push({
            propertyId: property.id,
            buyerId: buyerId,
            matchedOn: JSON.stringify(matchResult.matchedOn),
            matchScore: matchResult.score,
            distanceMiles: matchResult.distanceMiles,
            isActive: true,
            matchedAt: admin.firestore.FieldValue.serverTimestamp(),
            withinRadius: true,
            meetsRequirements: true
          });
          totalMatches++;
        }

        // Write matches in batches to avoid memory buildup
        if (pendingMatches.length >= MAX_MATCHES_PER_BATCH) {
          const batch = db.batch();
          for (const match of pendingMatches) {
            const matchRef = db.collection('property_buyer_matches').doc();
            batch.set(matchRef, match);
          }
          await batch.commit();
          pendingMatches = []; // Clear after writing
        }
      }

      // Update cursor for next iteration
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      
      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Write any remaining matches
    if (pendingMatches.length > 0) {
      const batch = db.batch();
      for (const match of pendingMatches) {
        const matchRef = db.collection('property_buyer_matches').doc();
        batch.set(matchRef, match);
      }
      await batch.commit();
    }

    return { matchedProperties: totalMatches, totalProperties };
  } catch (error) {
    throw new Error(`Failed to match buyer to properties: ${error}`);
  }
}

/**
 * MEMORY-EFFICIENT: Match a property to buyers using cursor-based pagination
 * Processes buyers in batches to avoid loading entire dataset into memory
 */
export async function matchPropertyToBuyersEfficient(propertyId: string) {
  const db = admin.firestore();
  const BATCH_SIZE = 100; // Process 100 buyers at a time
  const MAX_MATCHES_PER_BATCH = 500; // Write matches in batches
  
  try {
    // Get property
    const propertyDoc = await db.collection('properties').doc(propertyId).get();
    if (!propertyDoc.exists) throw new Error('Property not found');
    const property = { id: propertyId, ...propertyDoc.data() } as PropertyForMatching;

    let totalBuyers = 0;
    let totalMatches = 0;
    let pendingMatches: any[] = [];
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
    let hasMore = true;

    // If property has location, we can optimize by querying only buyers interested in that area

    while (hasMore) {
      // Build query with cursor
      let query = db.collection('buyer_profiles')
        .where('isActive', '==', true)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(BATCH_SIZE);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      
      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      // Process this batch
      for (const doc of snapshot.docs) {
        totalBuyers++;
        const buyer = { id: doc.id, ...doc.data() } as BuyerForMatching;
        
        const matchResult = isPropertyMatch(property, buyer);
        
        if (matchResult.matches) {
          pendingMatches.push({
            propertyId: propertyId,
            buyerId: buyer.id,
            matchedOn: JSON.stringify(matchResult.matchedOn),
            matchScore: matchResult.score,
            distanceMiles: matchResult.distanceMiles,
            isActive: true,
            matchedAt: admin.firestore.FieldValue.serverTimestamp(),
            withinRadius: true,
            meetsRequirements: true
          });
          totalMatches++;
        }

        // Write matches in batches to avoid memory buildup
        if (pendingMatches.length >= MAX_MATCHES_PER_BATCH) {
          const batch = db.batch();
          for (const match of pendingMatches) {
            const matchRef = db.collection('property_buyer_matches').doc();
            batch.set(matchRef, match);
          }
          await batch.commit();
          pendingMatches = []; // Clear after writing
        }
      }

      // Update cursor for next iteration
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      
      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Write any remaining matches
    if (pendingMatches.length > 0) {
      const batch = db.batch();
      for (const match of pendingMatches) {
        const matchRef = db.collection('property_buyer_matches').doc();
        batch.set(matchRef, match);
      }
      await batch.commit();
    }

    return { matchedBuyers: totalMatches, totalBuyers };
  } catch (error) {
    throw new Error(`Failed to match property to buyers: ${error}`);
  }
}

/**
 * MEMORY-EFFICIENT: Re-calculate all matches using cursor-based pagination
 * This is used for periodic full recalculation of matches
 */
export async function recalculateAllMatchesEfficient() {
  const db = admin.firestore();
  const PROPERTY_BATCH_SIZE = 50;
  const BUYER_BATCH_SIZE = 100;
  
  try {
    // First, mark all existing matches as inactive (soft delete)
    const markInactiveBatch = db.batch();
    const existingMatches = await db.collection('property_buyer_matches')
      .where('isActive', '==', true)
      .limit(500)
      .get();
    
    for (const doc of existingMatches.docs) {
      markInactiveBatch.update(doc.ref, { 
        isActive: false,
        deactivatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    await markInactiveBatch.commit();

    let totalProperties = 0;
    let totalBuyers = 0;
    let totalMatches = 0;
    let propertyLastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
    let hasMoreProperties = true;

    // Process properties in batches
    while (hasMoreProperties) {
      let propertyQuery = db.collection('properties')
        .where('isActive', '==', true)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(PROPERTY_BATCH_SIZE);
      
      if (propertyLastDoc) {
        propertyQuery = propertyQuery.startAfter(propertyLastDoc);
      }

      const propertySnapshot = await propertyQuery.get();
      
      if (propertySnapshot.empty) {
        hasMoreProperties = false;
        break;
      }

      // For each property batch, check against all buyers
      for (const propertyDoc of propertySnapshot.docs) {
        totalProperties++;
        const property = { id: propertyDoc.id, ...propertyDoc.data() } as PropertyForMatching;
        
        let buyerLastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
        let hasMoreBuyers = true;
        let propertyMatches: any[] = [];

        // Process buyers in batches for this property
        while (hasMoreBuyers) {
          let buyerQuery = db.collection('buyer_profiles')
            .where('isActive', '==', true)
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(BUYER_BATCH_SIZE);
          
          if (buyerLastDoc) {
            buyerQuery = buyerQuery.startAfter(buyerLastDoc);
          }

          const buyerSnapshot = await buyerQuery.get();
          
          if (buyerSnapshot.empty) {
            hasMoreBuyers = false;
            break;
          }

          // Check each buyer against current property
          for (const buyerDoc of buyerSnapshot.docs) {
            if (propertyLastDoc === null) totalBuyers++; // Count unique buyers only once
            
            const buyer = { id: buyerDoc.id, ...buyerDoc.data() } as BuyerForMatching;
            const matchResult = isPropertyMatch(property, buyer);
            
            if (matchResult.matches) {
              propertyMatches.push({
                propertyId: property.id,
                buyerId: buyer.id,
                matchedOn: JSON.stringify(matchResult.matchedOn),
                matchScore: matchResult.score,
                distanceMiles: matchResult.distanceMiles,
                isActive: true,
                matchedAt: admin.firestore.FieldValue.serverTimestamp(),
                withinRadius: true,
                meetsRequirements: true
              });
              totalMatches++;
            }
          }

          buyerLastDoc = buyerSnapshot.docs[buyerSnapshot.docs.length - 1];
        }

        // Write matches for this property
        if (propertyMatches.length > 0) {
          const batch = db.batch();
          for (const match of propertyMatches) {
            const matchRef = db.collection('property_buyer_matches').doc();
            batch.set(matchRef, match);
          }
          await batch.commit();
        }

        // Small delay between properties
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      propertyLastDoc = propertySnapshot.docs[propertySnapshot.docs.length - 1];
    }

    return { 
      totalProperties, 
      totalBuyers, 
      totalMatches,
      message: 'Recalculation complete'
    };
  } catch (error) {
    throw new Error(`Failed to recalculate matches: ${error}`);
  }
}

/**
 * Get buyer matches with pagination
 */
export async function getBuyerMatchesPaginated(
  buyerId: string, 
  limit: number = 20,
  startAfter?: string
) {
  const db = admin.firestore();
  
  try {
    let query = db.collection('property_buyer_matches')
      .where('buyerId', '==', buyerId)
      .where('isActive', '==', true)
      .orderBy('matchScore', 'desc')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(limit);
    
    if (startAfter) {
      const startDoc = await db.collection('property_buyer_matches').doc(startAfter).get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    const snapshot = await query.get();
    const matches = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      matches,
      hasMore: snapshot.docs.length === limit,
      lastId: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null
    };
  } catch (error) {
    throw new Error(`Failed to get buyer matches: ${error}`);
  }
}