// Unified database layer - use Firebase only, disable SQLite
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  documentId
} from 'firebase/firestore';
import { db as firebaseDb } from './firebase';
import { RealtorProfile, BuyerProfile, PropertyMatch, RealtorSubscription, User } from './firebase-models';
import { PropertyListing } from './property-schema';
import { queueNearbyCitiesForProperty } from './property-enhancement';


// Replace the old db import with this unified Firebase-only implementation
export const unifiedDb = {
  // Generate ID
  generateId: () => {
    if (!firebaseDb) {
      return 'temp-id-' + Math.random().toString(36).substr(2, 9);
    }
    return doc(collection(firebaseDb, 'temp')).id;
  },
  
  // Users
  users: {
    async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const id = unifiedDb.generateId();
      await setDoc(doc(firebaseDb, 'users', id), {
        ...userData,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { ...userData, id };
    },
    
    async findByEmail(email: string): Promise<(User & { id: string }) | null> {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const usersQuery = query(collection(firebaseDb, 'users'), where('email', '==', email));
      const userDocs = await getDocs(usersQuery);
      return userDocs.empty ? null : { id: userDocs.docs[0].id, ...userDocs.docs[0].data() } as User & { id: string };
    },
    
    async findById(id: string): Promise<(User & { id: string }) | null> {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const userDoc = await getDoc(doc(firebaseDb, 'users', id));
      return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } as User & { id: string } : null;
    }
  },
  
  // Realtors
  realtors: {
    async create(realtorData: Omit<RealtorProfile, 'id' | 'createdAt' | 'updatedAt'>) {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const id = unifiedDb.generateId();
      await setDoc(doc(firebaseDb, 'realtors', id), {
        ...realtorData,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { ...realtorData, id };
    },
    
    async findByUserId(userId: string): Promise<(RealtorProfile & { id: string }) | null> {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const realtorsQuery = query(collection(firebaseDb, 'realtors'), where('userId', '==', userId));
      const realtorDocs = await getDocs(realtorsQuery);
      return realtorDocs.empty ? null : { id: realtorDocs.docs[0].id, ...realtorDocs.docs[0].data() } as RealtorProfile & { id: string };
    },
    
    async update(id: string, data: Partial<Omit<RealtorProfile, 'id' | 'createdAt' | 'updatedAt'>>) {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      await updateDoc(doc(firebaseDb, 'realtors', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    }
  },
  
  // Buyer Profiles
  buyerProfiles: {
    async create(buyerData: Omit<BuyerProfile, 'id' | 'createdAt' | 'updatedAt'>) {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const id = unifiedDb.generateId();
      await setDoc(doc(firebaseDb, 'buyerProfiles', id), {
        ...buyerData,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { ...buyerData, id };
    },
    
    async findByUserId(userId: string): Promise<(BuyerProfile & { id: string }) | null> {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const buyersQuery = query(collection(firebaseDb, 'buyerProfiles'), where('userId', '==', userId));
      const buyerDocs = await getDocs(buyersQuery);
      return buyerDocs.empty ? null : { id: buyerDocs.docs[0].id, ...buyerDocs.docs[0].data() } as BuyerProfile & { id: string };
    },

    async findById(id: string): Promise<(BuyerProfile & { id: string }) | null> {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const buyerDoc = await getDoc(doc(firebaseDb, 'buyerProfiles', id));
      return buyerDoc.exists() ? { id: buyerDoc.id, ...buyerDoc.data() } as BuyerProfile & { id: string } : null;
    },

    async findAllActive(limitCount: number = 100): Promise<(BuyerProfile & { id: string })[]> {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      // PERFORMANCE FIX: Added limit parameter to prevent unbounded queries
      const buyersQuery = query(
        collection(firebaseDb, 'buyerProfiles'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limitCount)
      );
      const buyerDocs = await getDocs(buyersQuery);
      return buyerDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as BuyerProfile & { id: string }));
    }
  },
  
  // Properties
  properties: {
    async getAll(limit: number = 20) {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const propertiesQuery = query(
        collection(firebaseDb, 'properties'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );
      const propertyDocs = await getDocs(propertiesQuery);
      return propertyDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    
    async create(propertyData: Omit<PropertyListing, 'id' | 'createdAt' | 'updatedAt'>) {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const id = unifiedDb.generateId();
      
      // FAST: Create property immediately without waiting
      await setDoc(doc(firebaseDb, 'properties', id), {
        ...propertyData,
        id,
        nearbyCities: [], // Empty initially, populated by background job
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Queue nearby cities population (non-blocking)
      queueNearbyCitiesForProperty(id, {
        address: propertyData.address as string,
        city: propertyData.city as string,
        state: propertyData.state as string,
        zipCode: propertyData.zipCode as string,
        latitude: propertyData.latitude as number,
        longitude: propertyData.longitude as number
      });

      return { ...propertyData, id, nearbyCities: [] };
    },

    async findById(id: string): Promise<(PropertyListing & { id: string }) | null> {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const propertyDoc = await getDoc(doc(firebaseDb, 'properties', id));
      return propertyDoc.exists() ? { id: propertyDoc.id, ...propertyDoc.data() } as PropertyListing & { id: string } : null;
    },

    async findAllActive(limitCount: number = 100): Promise<(PropertyListing & { id: string })[]> {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      // PERFORMANCE FIX: Added limit parameter to prevent unbounded queries
      const propertiesQuery = query(
        collection(firebaseDb, 'properties'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limitCount)
      );
      const propertyDocs = await getDocs(propertiesQuery);
      return propertyDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as PropertyListing & { id: string }));
    },

    async update(id: string, data: Partial<Omit<PropertyListing, 'id' | 'createdAt' | 'updatedAt'>>) {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      await updateDoc(doc(firebaseDb, 'properties', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    }
  },

  // Agents
  agents: {
    async create(agentData: Omit<RealtorProfile, 'id' | 'createdAt' | 'updatedAt'>) {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const id = unifiedDb.generateId();
      await setDoc(doc(firebaseDb, 'agents', id), {
        ...agentData,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { ...agentData, id };
    },
    
    async findByEmail(email: string): Promise<(RealtorProfile & { id: string }) | null> {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const agentsQuery = query(collection(firebaseDb, 'agents'), where('email', '==', email));
      const agentDocs = await getDocs(agentsQuery);
      return agentDocs.empty ? null : { id: agentDocs.docs[0].id, ...agentDocs.docs[0].data() } as RealtorProfile & { id: string };
    },
    
    async findById(id: string): Promise<(RealtorProfile & { id: string }) | null> {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const agentDoc = await getDoc(doc(firebaseDb, 'agents', id));
      return agentDoc.exists() ? { id: agentDoc.id, ...agentDoc.data() } as RealtorProfile & { id: string } : null;
    },

    async update(id: string, data: Partial<Omit<RealtorProfile, 'id' | 'createdAt' | 'updatedAt'>>) {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      await updateDoc(doc(firebaseDb, 'agents', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    }
  },
  
  // Subscriptions
  subscriptions: {
    async findByRealtorId(realtorId: string) {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const subsQuery = query(collection(firebaseDb, 'realtorSubscriptions'), where('realtorId', '==', realtorId));
      const subDocs = await getDocs(subsQuery);
      return subDocs.empty ? null : { id: subDocs.docs[0].id, ...subDocs.docs[0].data() };
    },
    
    async create(subscriptionData: Omit<RealtorSubscription, 'id' | 'createdAt' | 'updatedAt'>) {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const id = unifiedDb.generateId();
      await setDoc(doc(firebaseDb, 'realtorSubscriptions', id), {
        ...subscriptionData,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { ...subscriptionData, id };
    }
  },

  // Property Buyer Matches
  propertyBuyerMatches: {
    async create(matchData: Omit<PropertyMatch, 'id' | 'createdAt'>) {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const id = unifiedDb.generateId();
      await setDoc(doc(firebaseDb, 'propertyBuyerMatches', id), {
        ...matchData,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { ...matchData, id };
    },

    async createMany(matches: Omit<PropertyMatch, 'id' | 'createdAt'>[]) {
      const promises = matches.map(match => this.create(match));
      return Promise.all(promises);
    },

    async getBuyerMatches(buyerId: string) {
      if (!firebaseDb) {
        throw new Error('Firebase not initialized - missing environment variables');
      }
      const matchesQuery = query(
        collection(firebaseDb, 'propertyBuyerMatches'),
        where('buyerId', '==', buyerId),
        orderBy('matchScore', 'desc')
      );
      const matchDocs = await getDocs(matchesQuery);

      // OPTIMIZATION: Batch fetch all properties instead of N+1 queries
      // Extract all property IDs first
      const matchesData = matchDocs.docs.map(matchDoc => ({
        id: matchDoc.id,
        ...matchDoc.data()
      } as PropertyMatch));

      if (matchesData.length === 0) {
        return [];
      }

      const propertyIds = matchesData.map(match => match.propertyId);

      // Batch fetch properties using documentId() - Firestore supports max 10 per query
      // So we split into chunks of 10
      const propertyMap = new Map<string, PropertyListing & { id: string }>();

      for (let i = 0; i < propertyIds.length; i += 10) {
        const chunk = propertyIds.slice(i, i + 10);
        const propertiesQuery = query(
          collection(firebaseDb, 'properties'),
          where(documentId(), 'in', chunk)
        );
        const propertyDocs = await getDocs(propertiesQuery);

        propertyDocs.docs.forEach(propertyDoc => {
          propertyMap.set(propertyDoc.id, {
            id: propertyDoc.id,
            ...propertyDoc.data()
          } as PropertyListing & { id: string });
        });
      }

      // Combine matches with their properties
      const matches = [];
      for (const matchData of matchesData) {
        const property = propertyMap.get(matchData.propertyId);
        if (property) {
          matches.push({
            property,
            match: matchData
          });
        }
      }

      return matches;
    }
  }
};

// Export convenience function
export const generateId = unifiedDb.generateId;