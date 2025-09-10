import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

// Collection references
export const collections = {
  users: 'users',
  realtors: 'realtors',
  buyerProfiles: 'buyerProfiles', 
  properties: 'properties',
  propertyMatches: 'propertyMatches',
  realtorSubscriptions: 'realtorSubscriptions',
  buyerLeadPurchases: 'buyerLeadPurchases',
  systemLogs: 'systemLogs'
};

// Firestore document interfaces
export interface FirestoreUser {
  id?: string;
  email: string;
  role: 'buyer' | 'realtor' | 'admin';
  password?: string; // Only for creation, don't store
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreRealtor {
  id?: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  licenseNumber?: string;
  licenseState?: string;
  primaryCity?: string;
  primaryState?: string;
  serviceRadius: number;
  serviceStates?: string[]; // Array instead of JSON string
  serviceCities?: string[]; // Array instead of JSON string
  credits: number;
  isOnTrial: boolean;
  trialStartDate: Timestamp;
  trialEndDate: Timestamp;
  isActive: boolean;
  profileComplete: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreBuyerProfile {
  id?: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
  preferredCity: string;
  preferredState: string;
  searchRadius: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  profileComplete: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreProperty {
  id?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  listPrice: number;
  downPaymentPercent: number;
  interestRate: number;
  termYears: number;
  balloonPayment?: number;
  monthlyPayment: number;
  downPaymentAmount: number;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestorePropertyMatch {
  id?: string;
  propertyId: string;
  buyerId: string;
  matchedOn: Record<string, boolean>; // Object instead of JSON string
  matchScore: number;
  createdAt: Timestamp;
}

export interface FirestoreSubscription {
  id?: string;
  realtorId: string;
  plan: string;
  status: string;
  monthlyPrice?: number;
  creditsPerMonth?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: Timestamp;
  currentPeriodEnd?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Helper functions for common operations
export const firestoreHelpers = {
  // Generate ID
  generateId: () => doc(collection(db, 'temp')).id,
  
  // Timestamp helpers
  now: () => serverTimestamp(),
  toDate: (timestamp: Timestamp | string | null) => {
    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
      return timestamp.toDate();
    }
    return new Date(timestamp || Date.now());
  },
  
  // Collection helpers
  getCollection: (collectionName: string) => collection(db, collectionName),
  getDoc: async (collectionName: string, docId: string) => {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  },
  
  // Batch operations
  createBatch: () => writeBatch(db),
  
  // Query builders
  queryWhere: (collectionName: string, field: string, operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains' | 'array-contains-any', value: unknown) => 
    query(collection(db, collectionName), where(field, operator, value)),
    
  queryLimit: (collectionName: string, limitCount: number) =>
    query(collection(db, collectionName), firestoreLimit(limitCount)),
    
  queryOrder: (collectionName: string, field: string, direction: 'asc' | 'desc' = 'asc') =>
    query(collection(db, collectionName), orderBy(field, direction))
};