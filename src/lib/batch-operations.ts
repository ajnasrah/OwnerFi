/**
 * Batch Database Operations
 * Eliminates N+1 queries with efficient batch processing
 */

import { 
  collection, 
  query, 
  where, 
  getDocs,
  getDoc,
  documentId,
  QueryConstraint,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PropertyListing } from './property-schema';

/**
 * Type guard to check if a value is a non-empty string
 */
function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard to check if a value is a positive number
 */
function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && !isNaN(value);
}

/**
 * Batch fetch documents by IDs (eliminates N+1 queries)
 */
export async function batchGetDocuments(
  collectionName: string, 
  ids: string[]
): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return [];
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  const results = [];
  
  // Firestore 'in' query limit is 10, so batch in groups
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    
    const batchQuery = query(
      collection(db, collectionName),
      where(documentId(), 'in', batch)
    );
    
    const snapshot = await getDocs(batchQuery);
    const batchResults = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    results.push(...batchResults);
  }

  return results;
}

/**
 * Optimized property search with proper indexing
 */
interface SearchCriteria {
  state: string;
  cities?: string[];
  maxMonthlyPayment?: number;
  maxDownPayment?: number;
  minBedrooms?: number;
  minBathrooms?: number;
}

export async function searchProperties(criteria: SearchCriteria): Promise<Record<string, unknown>[]> {
  // Validate required criteria
  if (!isValidString(criteria.state)) {
    throw new Error('State is required and must be a valid string');
  }
  
  const constraints: QueryConstraint[] = [
    where('isActive', '==', true),
    where('state', '==', criteria.state)
  ];

  // Add budget constraints at database level for performance
  if (criteria.maxMonthlyPayment) {
    constraints.push(where('monthlyPayment', '<=', criteria.maxMonthlyPayment));
  }

  if (!db) {
    throw new Error('Firebase not initialized');
  }
  
  const propertiesQuery = query(
    collection(db, 'properties'),
    ...constraints
  );

  const snapshot = await getDocs(propertiesQuery);
  let properties = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as (PropertyListing & { id: string })[];

  // Apply remaining filters in JavaScript (on smaller dataset)
  if (criteria.cities && criteria.cities.length > 0) {
    properties = properties.filter(property => 
      criteria.cities!.some(city => 
(property as PropertyListing).city.toLowerCase() === city.toLowerCase()
      )
    );
  }

  if (criteria.maxDownPayment) {
    properties = properties.filter(property => 
(property as PropertyListing).downPaymentAmount <= criteria.maxDownPayment!
    );
  }

  if (criteria.minBedrooms) {
    properties = properties.filter(property => 
(property as PropertyListing).bedrooms >= criteria.minBedrooms!
    );
  }

  if (criteria.minBathrooms) {
    properties = properties.filter(property => 
(property as PropertyListing).bathrooms >= criteria.minBathrooms!
    );
  }

  return properties;
}

/**
 * Batch update property matches for multiple buyers
 */
export async function batchUpdatePropertyMatches(updates: Array<{
  buyerId: string;
  matches: Record<string, unknown>[];
}>): Promise<void> {
  
  if (!db) {
    throw new Error('Firebase not initialized');
  }
  
  // Process in parallel for performance
  const updatePromises = updates.map(async ({ buyerId, matches }) => {
    const updateDocRef = doc(collection(db!, 'buyerProfiles'), buyerId);
    await updateDoc(updateDocRef, {
      propertyMatches: matches,
      lastMatchUpdate: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  await Promise.all(updatePromises);
}

/**
 * Efficient user lookup with caching
 */
const userCache = new Map<string, { data: Record<string, unknown> | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedUser(userId: string): Promise<Record<string, unknown> | null> {
  // Check cache first
  const cached = userCache.get(userId);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  // Fetch from database
  try {
    if (!db) {
      throw new Error('Firebase not initialized');
    }
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
    
    // Cache result
    userCache.set(userId, {
      data: userData,
      timestamp: Date.now()
    });
    
    return userData;
  } catch (error) {
    return null;
  }
}