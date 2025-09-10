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
  serverTimestamp 
} from 'firebase/firestore';
import { db as firebaseDb } from './firebase';
import { RealtorProfile, BuyerProfile, PropertyMatch, RealtorSubscription, User } from './firebase-models';
import { PropertyListing } from './property-schema';
import { queueNearbyCitiesForProperty } from './property-enhancement';

// Replace the old db import with this unified Firebase-only implementation
export const unifiedDb = {
  // Generate ID
  generateId: () => doc(collection(firebaseDb, 'temp')).id,
  
  // Users
  users: {
    async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) {
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
      const usersQuery = query(collection(firebaseDb, 'users'), where('email', '==', email));
      const userDocs = await getDocs(usersQuery);
      return userDocs.empty ? null : { id: userDocs.docs[0].id, ...userDocs.docs[0].data() } as User & { id: string };
    },
    
    async findById(id: string): Promise<(User & { id: string }) | null> {
      const userDoc = await getDoc(doc(firebaseDb, 'users', id));
      return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } as User & { id: string } : null;
    }
  },
  
  // Realtors
  realtors: {
    async create(realtorData: Omit<RealtorProfile, 'id' | 'createdAt' | 'updatedAt'>) {
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
      const realtorsQuery = query(collection(firebaseDb, 'realtors'), where('userId', '==', userId));
      const realtorDocs = await getDocs(realtorsQuery);
      return realtorDocs.empty ? null : { id: realtorDocs.docs[0].id, ...realtorDocs.docs[0].data() } as RealtorProfile & { id: string };
    },
    
    async update(id: string, data: Partial<Omit<RealtorProfile, 'id' | 'createdAt' | 'updatedAt'>>) {
      await updateDoc(doc(firebaseDb, 'realtors', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    }
  },
  
  // Buyer Profiles
  buyerProfiles: {
    async create(buyerData: Omit<BuyerProfile, 'id' | 'createdAt' | 'updatedAt'>) {
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
      const buyersQuery = query(collection(firebaseDb, 'buyerProfiles'), where('userId', '==', userId));
      const buyerDocs = await getDocs(buyersQuery);
      return buyerDocs.empty ? null : { id: buyerDocs.docs[0].id, ...buyerDocs.docs[0].data() } as BuyerProfile & { id: string };
    },

    async findById(id: string): Promise<(BuyerProfile & { id: string }) | null> {
      const buyerDoc = await getDoc(doc(firebaseDb, 'buyerProfiles', id));
      return buyerDoc.exists() ? { id: buyerDoc.id, ...buyerDoc.data() } as BuyerProfile & { id: string } : null;
    },

    async findAllActive() {
      const buyersQuery = query(collection(firebaseDb, 'buyerProfiles'), where('isActive', '==', true));
      const buyerDocs = await getDocs(buyersQuery);
      return buyerDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  },
  
  // Properties
  properties: {
    async getAll(limit: number = 20) {
      const propertiesQuery = query(
        collection(firebaseDb, 'properties'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );
      const propertyDocs = await getDocs(propertiesQuery);
      return propertyDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    
    async create(propertyData: Omit<PropertyListing, 'id' | 'createdAt' | 'updatedAt'>) {
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
      queueNearbyCitiesForProperty(id, propertyData.city, propertyData.state);
      
      return { ...propertyData, id, nearbyCities: [] };
    },

    async findById(id: string) {
      const propertyDoc = await getDoc(doc(firebaseDb, 'properties', id));
      return propertyDoc.exists() ? { id: propertyDoc.id, ...propertyDoc.data() } : null;
    },

    async findAllActive() {
      const propertiesQuery = query(collection(firebaseDb, 'properties'), where('isActive', '==', true));
      const propertyDocs = await getDocs(propertiesQuery);
      return propertyDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  },

  // Agents
  agents: {
    async create(agentData: Omit<RealtorProfile, 'id' | 'createdAt' | 'updatedAt'>) {
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
      const agentsQuery = query(collection(firebaseDb, 'agents'), where('email', '==', email));
      const agentDocs = await getDocs(agentsQuery);
      return agentDocs.empty ? null : { id: agentDocs.docs[0].id, ...agentDocs.docs[0].data() } as RealtorProfile & { id: string };
    },
    
    async findById(id: string): Promise<(RealtorProfile & { id: string }) | null> {
      const agentDoc = await getDoc(doc(firebaseDb, 'agents', id));
      return agentDoc.exists() ? { id: agentDoc.id, ...agentDoc.data() } as RealtorProfile & { id: string } : null;
    },

    async update(id: string, data: Partial<Omit<RealtorProfile, 'id' | 'createdAt' | 'updatedAt'>>) {
      await updateDoc(doc(firebaseDb, 'agents', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    }
  },
  
  // Subscriptions
  subscriptions: {
    async findByRealtorId(realtorId: string) {
      const subsQuery = query(collection(firebaseDb, 'realtorSubscriptions'), where('realtorId', '==', realtorId));
      const subDocs = await getDocs(subsQuery);
      return subDocs.empty ? null : { id: subDocs.docs[0].id, ...subDocs.docs[0].data() };
    },
    
    async create(subscriptionData: Omit<RealtorSubscription, 'id' | 'createdAt' | 'updatedAt'>) {
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
      const matchesQuery = query(
        collection(firebaseDb, 'propertyBuyerMatches'),
        where('buyerId', '==', buyerId),
        orderBy('matchScore', 'desc')
      );
      const matchDocs = await getDocs(matchesQuery);
      
      // Get property details for each match
      const matches = [];
      for (const matchDoc of matchDocs.docs) {
        const matchData = { id: matchDoc.id, ...matchDoc.data() };
        const property = await unifiedDb.properties.findById(matchData.propertyId);
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