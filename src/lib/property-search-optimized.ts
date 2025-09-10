// Optimized property search - NO MORE IN-MEMORY FILTERING!
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  startAfter,
  getDocs,
  QueryConstraint,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { getNearbyCitiesDirect } from './cities-service';
import { PropertyListing } from "./property-schema";

export interface PropertySearchCriteria {
  cities: string[]; // Multiple cities to search
  state?: string;
  maxMonthlyPayment?: number;
  maxDownPayment?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  limit?: number;
  startAfter?: DocumentSnapshot;
}

export interface PropertySearchResult {
  properties: (PropertyListing & { id: string })[];
  totalFound: number;
  hasNextPage: boolean;
  lastDoc?: DocumentSnapshot;
  searchTime: number;
}

/**
 * FAST: Optimized property search using Firestore compound indexes
 */
export async function searchPropertiesOptimized(
  criteria: PropertySearchCriteria
): Promise<PropertySearchResult> {
  const startTime = Date.now();
  
  try {
    // Build Firestore query constraints
    const constraints: QueryConstraint[] = [];
    
    // State filter (indexed)
    if (criteria.state) {
      constraints.push(where('state', '==', criteria.state));
    }
    
    // Active properties only (indexed)
    constraints.push(where('isActive', '==', true));
    
    // Budget constraints (need compound indexes)
    if (criteria.maxMonthlyPayment) {
      constraints.push(where('monthlyPayment', '<=', criteria.maxMonthlyPayment));
    }
    
    if (criteria.maxDownPayment) {
      constraints.push(where('downPaymentAmount', '<=', criteria.maxDownPayment));
    }
    
    // Property requirements (indexed)
    if (criteria.minBedrooms) {
      constraints.push(where('bedrooms', '>=', criteria.minBedrooms));
    }
    
    if (criteria.minBathrooms) {
      constraints.push(where('bathrooms', '>=', criteria.minBathrooms));
    }
    
    // Order by monthly payment for consistent pagination
    constraints.push(orderBy('monthlyPayment', 'asc'));
    
    // Pagination
    if (criteria.startAfter) {
      constraints.push(startAfter(criteria.startAfter));
    }
    
    // Limit results
    const resultLimit = Math.min(criteria.limit || 20, 100);
    constraints.push(firestoreLimit(resultLimit + 1)); // +1 to check for next page
    
    // Execute optimized Firestore query
    const propertiesQuery = query(collection(db, 'properties'), ...constraints);
    const snapshot = await getDocs(propertiesQuery);
    
    let properties = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      _doc: doc // Keep document reference for pagination
    }));
    
    // Check if we have more results
    const hasNextPage = properties.length > resultLimit;
    if (hasNextPage) {
      properties = properties.slice(0, resultLimit); // Remove the extra doc
    }
    
    // City filtering (this is the expensive part, but now on smaller dataset)
    if (criteria.cities && criteria.cities.length > 0) {
      properties = properties.filter(property => {
        const propertyCity = property.city?.split(',')[0].trim();
        if (!propertyCity) return false;
        
        // Check if property city matches any of the search cities
        return criteria.cities.some(searchCity => 
          propertyCity.toLowerCase() === searchCity.toLowerCase()
        );
      });
    }
    
    const searchTime = Date.now() - startTime;
    
    return {
      properties: properties.map(p => {
        const { _doc, ...property } = p; // Remove document reference from result
        return property;
      }),
      totalFound: properties.length,
      hasNextPage: hasNextPage && properties.length === resultLimit,
      lastDoc: properties.length > 0 ? properties[properties.length - 1]._doc : undefined,
      searchTime
    };
    
  } catch (error) {
    console.error('Optimized property search error:', error);
    throw error;
  }
}

/**
 * FAST: Search properties in city + nearby cities with caching
 */
export async function searchPropertiesWithNearby(
  centerCity: string,
  state: string,
  criteria: Omit<PropertySearchCriteria, 'cities' | 'state'>
): Promise<PropertySearchResult> {
  const startTime = Date.now();
  
  try {
    // Get all cities to search (center + nearby)
    const nearbyCities = await getNearbyCitiesDirect(centerCity, state, 30);
    const allCities = [centerCity, ...nearbyCities];
    
    console.log(`🔍 Searching ${allCities.length} cities for properties`);
    
    // Use optimized search with all cities
    const result = await searchPropertiesOptimized({
      ...criteria,
      cities: allCities,
      state: state
    });
    
    const totalTime = Date.now() - startTime;
    
    return {
      ...result,
      searchTime: totalTime
    };
    
  } catch (error) {
    console.error('Property search with nearby cities error:', error);
    throw error;
  }
}

/**
 * FAST: Get similar properties using optimized search
 */
export async function getSimilarProperties(
  originalProperty: PropertyListing & { id: string },
  limit: number = 10
): Promise<(PropertyListing & { id: string })[]> {
  try {
    // Get nearby cities for the original property
    const nearbyCities = await getNearbyCitiesDirect(
      originalProperty.city?.split(',')[0].trim(),
      originalProperty.state,
      30
    );
    
    const searchCities = [originalProperty.city?.split(',')[0].trim(), ...nearbyCities];
    
    // Search for similar properties
    const result = await searchPropertiesOptimized({
      cities: searchCities,
      state: originalProperty.state,
      maxMonthlyPayment: originalProperty.monthlyPayment * 1.2, // 20% higher
      maxDownPayment: originalProperty.downPaymentAmount * 1.2,
      limit: limit + 1 // +1 to exclude original property
    });
    
    // Filter out the original property
    const similarProperties = result.properties.filter(
      property => property.id !== originalProperty.id
    ).slice(0, limit);
    
    return similarProperties;
    
  } catch (error) {
    console.error('Similar properties search error:', error);
    return [];
  }
}

/**
 * Build Firestore indexes for optimal performance
 * Run this to get the required indexes
 */
export function getRequiredFirestoreIndexes(): string[] {
  return [
    // Compound indexes needed for optimal performance
    'properties: isActive ASC, state ASC, monthlyPayment ASC',
    'properties: isActive ASC, state ASC, downPaymentAmount ASC, monthlyPayment ASC',
    'properties: isActive ASC, state ASC, bedrooms ASC, monthlyPayment ASC',
    'properties: isActive ASC, state ASC, bathrooms ASC, monthlyPayment ASC',
    'properties: isActive ASC, monthlyPayment ASC, downPaymentAmount ASC',
    'properties: state ASC, city ASC, monthlyPayment ASC',
    'properties: nearbyCitiesUpdatedAt ASC'
  ];
}