/**
 * Batch Database Operations
 * Eliminates N+1 queries with efficient batch processing
 */

import { 
  collection, 
  query, 
  where, 
  getDocs,
  documentId,
  QueryConstraint 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Batch fetch documents by IDs (eliminates N+1 queries)
 */
export async function batchGetDocuments(
  collectionName: string, 
  ids: string[]
): Promise<any[]> {
  if (ids.length === 0) return [];

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
export async function searchProperties(criteria: {
  state: string;
  cities?: string[];
  maxMonthlyPayment?: number;
  maxDownPayment?: number;
  minBedrooms?: number;
  minBathrooms?: number;
}): Promise<any[]> {
  
  const constraints: QueryConstraint[] = [
    where('isActive', '==', true),
    where('state', '==', criteria.state)
  ];

  // Add budget constraints at database level for performance
  if (criteria.maxMonthlyPayment) {
    constraints.push(where('monthlyPayment', '<=', criteria.maxMonthlyPayment));
  }

  const propertiesQuery = query(
    collection(db, 'properties'),
    ...constraints
  );

  const snapshot = await getDocs(propertiesQuery);
  let properties = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Apply remaining filters in JavaScript (on smaller dataset)
  if (criteria.cities && criteria.cities.length > 0) {
    properties = properties.filter(property => 
      criteria.cities!.some(city => 
        property.city.toLowerCase() === city.toLowerCase()
      )
    );
  }

  if (criteria.maxDownPayment) {
    properties = properties.filter(property => 
      property.downPaymentAmount <= criteria.maxDownPayment!
    );
  }

  if (criteria.minBedrooms) {
    properties = properties.filter(property => 
      property.bedrooms >= criteria.minBedrooms!
    );
  }

  if (criteria.minBathrooms) {
    properties = properties.filter(property => 
      property.bathrooms >= criteria.minBathrooms!
    );
  }

  return properties;
}

/**
 * Batch update property matches for multiple buyers
 */
export async function batchUpdatePropertyMatches(updates: Array<{
  buyerId: string;
  matches: any[];
}>): Promise<void> {
  
  // Process in parallel for performance
  const updatePromises = updates.map(async ({ buyerId, matches }) => {
    const updateDoc = doc(collection(db, 'buyerProfiles'), buyerId);
    await updateDoc(updateDoc, {
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
const userCache = new Map<string, any>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedUser(userId: string): Promise<any | null> {
  // Check cache first
  const cached = userCache.get(userId);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  // Fetch from database
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
    
    // Cache result
    userCache.set(userId, {
      data: userData,
      timestamp: Date.now()
    });
    
    return userData;
  } catch (error) {
    console.error('User fetch error:', error);
    return null;
  }
}