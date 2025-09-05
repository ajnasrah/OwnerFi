// Unified database layer - use Firebase only, disable SQLite
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  limit as firestoreLimit,
  serverTimestamp 
} from 'firebase/firestore';
import { db as firebaseDb } from './firebase';

// Replace the old db import with this unified Firebase-only implementation
export const unifiedDb = {
  // Generate ID
  generateId: () => doc(collection(firebaseDb, 'temp')).id,
  
  // Users
  users: {
    async create(userData: any) {
      const id = unifiedDb.generateId();
      await setDoc(doc(firebaseDb, 'users', id), {
        ...userData,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { ...userData, id };
    },
    
    async findByEmail(email: string) {
      const usersQuery = query(collection(firebaseDb, 'users'), where('email', '==', email));
      const userDocs = await getDocs(usersQuery);
      return userDocs.empty ? null : { id: userDocs.docs[0].id, ...userDocs.docs[0].data() };
    },
    
    async findById(id: string) {
      const userDoc = await getDoc(doc(firebaseDb, 'users', id));
      return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
    }
  },
  
  // Realtors
  realtors: {
    async create(realtorData: any) {
      const id = unifiedDb.generateId();
      await setDoc(doc(firebaseDb, 'realtors', id), {
        ...realtorData,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { ...realtorData, id };
    },
    
    async findByUserId(userId: string) {
      const realtorsQuery = query(collection(firebaseDb, 'realtors'), where('userId', '==', userId));
      const realtorDocs = await getDocs(realtorsQuery);
      return realtorDocs.empty ? null : { id: realtorDocs.docs[0].id, ...realtorDocs.docs[0].data() };
    },
    
    async update(id: string, data: any) {
      await updateDoc(doc(firebaseDb, 'realtors', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    }
  },
  
  // Buyer Profiles
  buyerProfiles: {
    async create(buyerData: any) {
      const id = unifiedDb.generateId();
      await setDoc(doc(firebaseDb, 'buyerProfiles', id), {
        ...buyerData,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { ...buyerData, id };
    },
    
    async findByUserId(userId: string) {
      const buyersQuery = query(collection(firebaseDb, 'buyerProfiles'), where('userId', '==', userId));
      const buyerDocs = await getDocs(buyersQuery);
      return buyerDocs.empty ? null : { id: buyerDocs.docs[0].id, ...buyerDocs.docs[0].data() };
    },

    async findById(id: string) {
      const buyerDoc = await getDoc(doc(firebaseDb, 'buyerProfiles', id));
      return buyerDoc.exists() ? { id: buyerDoc.id, ...buyerDoc.data() } : null;
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
    
    async create(propertyData: any) {
      const id = unifiedDb.generateId();
      await setDoc(doc(firebaseDb, 'properties', id), {
        ...propertyData,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { ...propertyData, id };
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
    async create(agentData: any) {
      const id = unifiedDb.generateId();
      await setDoc(doc(firebaseDb, 'agents', id), {
        ...agentData,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { ...agentData, id };
    },
    
    async findByEmail(email: string) {
      const agentsQuery = query(collection(firebaseDb, 'agents'), where('email', '==', email));
      const agentDocs = await getDocs(agentsQuery);
      return agentDocs.empty ? null : { id: agentDocs.docs[0].id, ...agentDocs.docs[0].data() };
    },
    
    async findById(id: string) {
      const agentDoc = await getDoc(doc(firebaseDb, 'agents', id));
      return agentDoc.exists() ? { id: agentDoc.id, ...agentDoc.data() } : null;
    },

    async update(id: string, data: any) {
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
    
    async create(subscriptionData: any) {
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
    async create(matchData: any) {
      const id = unifiedDb.generateId();
      await setDoc(doc(firebaseDb, 'propertyBuyerMatches', id), {
        ...matchData,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { ...matchData, id };
    },

    async createMany(matches: any[]) {
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

// Export the unified database functions
export { unifiedDb };
export const generateId = unifiedDb.generateId;