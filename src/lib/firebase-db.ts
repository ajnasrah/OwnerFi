// AUTHORITATIVE Firebase database layer - SINGLE SOURCE OF TRUTH
// All database operations go through this file

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
  limit as firestoreLimit,
  writeBatch,
  serverTimestamp,
  runTransaction,
  Timestamp,
  WhereFilterOp
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  User, 
  BuyerProfile, 
  RealtorProfile, 
  LeadPurchase, 
  LeadDispute, 
  PropertyMatch, 
  RealtorSubscription, 
  Transaction, 
  SystemLog,
  COLLECTIONS,
  isValidUser,
  isValidBuyerProfile,
  isValidRealtorProfile,
  generateFirebaseId,
  createTimestamp,
  convertTimestampToDate
} from './firebase-models';
import { PropertyListing } from './property-schema';

// Generic database operations
export class FirebaseDB {
  
  private static checkFirebase() {
    if (!db) {
      throw new Error('Firebase not initialized');
    }
  }
  
  // Generic document operations
  static async createDocument<T>(
    collectionName: string, 
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    customId?: string
  ): Promise<T> {
    FirebaseDB.checkFirebase();
    
    const id = customId || generateFirebaseId();
    const now = serverTimestamp();
    
    const docData = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    } as T;

    await setDoc(doc(db!, collectionName, id), docData as any);
    return docData;
  }

  static async getDocument<T>(collectionName: string, id: string): Promise<T | null> {
    FirebaseDB.checkFirebase();
    const docRef = doc(db!, collectionName, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    return { id: docSnap.id, ...docSnap.data() } as T;
  }

  static async updateDocument<T>(
    collectionName: string, 
    id: string, 
    updates: Partial<T>
  ): Promise<void> {
    FirebaseDB.checkFirebase();
    const docRef = doc(db!, collectionName, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  static async deleteDocument(collectionName: string, id: string): Promise<void> {
    FirebaseDB.checkFirebase();
    const docRef = doc(db!, collectionName, id);
    await deleteDoc(docRef);
  }

  static async queryDocuments<T>(
    collectionName: string,
    conditions: { field: string; operator: WhereFilterOp; value: unknown }[],
    limitCount?: number
  ): Promise<T[]> {
    FirebaseDB.checkFirebase();
    let q = query(collection(db!, collectionName));
    
    // Add where conditions
    for (const condition of conditions) {
      q = query(q, where(condition.field, condition.operator, condition.value));
    }
    
    // Add limit if specified
    if (limitCount) {
      q = query(q, firestoreLimit(limitCount));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  }

  // User operations
  static async createUser(userData: {
    email: string;
    name: string;
    password: string;
    role: 'buyer' | 'realtor' | 'admin' | 'pending';
  }): Promise<User> {
    const user = await this.createDocument<User>(COLLECTIONS.USERS, userData);
    
    // Validate created user
    if (!isValidUser(user)) {
      throw new Error('Invalid user data created');
    }
    
    return user;
  }

  static async findUserByEmail(email: string): Promise<User | null> {
    const users = await this.queryDocuments<User>(
      COLLECTIONS.USERS,
      [{ field: 'email', operator: '==', value: email.toLowerCase() }],
      1
    );
    
    return users.length > 0 ? users[0] : null;
  }

  static async findUserById(id: string): Promise<User | null> {
    return this.getDocument<User>(COLLECTIONS.USERS, id);
  }

  // Buyer profile operations
  static async createBuyerProfile(
    buyerData: Omit<BuyerProfile, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<BuyerProfile> {
    const buyer = await this.createDocument<BuyerProfile>(COLLECTIONS.BUYER_PROFILES, buyerData);
    
    if (!isValidBuyerProfile(buyer)) {
      throw new Error('Invalid buyer profile data');
    }
    
    return buyer;
  }

  static async findBuyerByUserId(userId: string): Promise<BuyerProfile | null> {
    const buyers = await this.queryDocuments<BuyerProfile>(
      COLLECTIONS.BUYER_PROFILES,
      [{ field: 'userId', operator: '==', value: userId }],
      1
    );
    
    return buyers.length > 0 ? buyers[0] : null;
  }

  static async getCompleteBuyers(limit?: number): Promise<BuyerProfile[]> {
    return this.queryDocuments<BuyerProfile>(
      COLLECTIONS.BUYER_PROFILES,
      [{ field: 'profileComplete', operator: '==', value: true }],
      limit
    );
  }

  // Realtor profile operations
  static async createRealtorProfile(
    realtorData: Omit<RealtorProfile, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RealtorProfile> {
    const realtor = await this.createDocument<RealtorProfile>(COLLECTIONS.REALTOR_PROFILES, realtorData);
    
    if (!isValidRealtorProfile(realtor)) {
      throw new Error('Invalid realtor profile data');
    }
    
    return realtor;
  }

  static async findRealtorByUserId(userId: string): Promise<RealtorProfile | null> {
    const realtors = await this.queryDocuments<RealtorProfile>(
      COLLECTIONS.REALTOR_PROFILES,
      [{ field: 'userId', operator: '==', value: userId }],
      1
    );
    
    return realtors.length > 0 ? realtors[0] : null;
  }

  static async updateRealtorCredits(realtorId: string, newBalance: number): Promise<void> {
    await this.updateDocument<RealtorProfile>(
      COLLECTIONS.REALTOR_PROFILES,
      realtorId,
      { credits: newBalance }
    );
  }

  // Lead purchase operations
  static async createLeadPurchase(purchaseData: {
    realtorId: string;
    buyerId: string;
    creditsCost: number;
    purchasePrice: number;
  }): Promise<LeadPurchase> {
    return this.createDocument<LeadPurchase>(COLLECTIONS.LEAD_PURCHASES, {
      ...purchaseData,
      status: 'purchased',
      purchasedAt: serverTimestamp() as unknown as Timestamp
    });
  }

  static async getPurchasedLeads(realtorId: string): Promise<LeadPurchase[]> {
    return this.queryDocuments<LeadPurchase>(
      COLLECTIONS.LEAD_PURCHASES,
      [{ field: 'realtorId', operator: '==', value: realtorId }]
    );
  }

  // Atomic user + profile creation (solves orphaned records problem)
  static async createUserWithProfile(userData: {
    email: string;
    name: string;
    password: string;
    role: 'buyer' | 'realtor';
    profileData: Record<string, unknown>;
  }): Promise<{ user: User; profile: BuyerProfile | RealtorProfile }> {
    FirebaseDB.checkFirebase();
    return runTransaction(db!, async (transaction) => {
      // Create user first
      const userId = generateFirebaseId();
      const user: User = {
        id: userId,
        email: userData.email.toLowerCase(),
        name: userData.name,
        role: userData.role,
        password: userData.password,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      // Create profile
      const profileId = generateFirebaseId();
      const profileCollection = userData.role === 'buyer' ? 
        COLLECTIONS.BUYER_PROFILES : COLLECTIONS.REALTOR_PROFILES;
      
      const profile = {
        id: profileId,
        userId: userId,
        ...userData.profileData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      // Write both documents atomically
      const userRef = doc(db!, COLLECTIONS.USERS, userId);
      const profileRef = doc(db!, profileCollection, profileId);
      
      transaction.set(userRef, user);
      transaction.set(profileRef, profile);
      
      return { user, profile: profile as BuyerProfile | RealtorProfile };
    });
  }

  // Atomic lead purchase (solves credit/purchase consistency)
  static async purchaseLeadAtomic(data: {
    realtorId: string;
    buyerId: string;
    creditsCost: number;
    purchasePrice: number;
  }): Promise<{ purchase: LeadPurchase; newBalance: number }> {
    FirebaseDB.checkFirebase();
    return runTransaction(db!, async (transaction) => {
      // Get current realtor profile
      const realtorRef = doc(db!, COLLECTIONS.REALTOR_PROFILES, data.realtorId);
      const realtorSnap = await transaction.get(realtorRef);
      
      if (!realtorSnap.exists()) {
        throw new Error('Realtor not found');
      }
      
      const realtorData = realtorSnap.data() as RealtorProfile;
      
      // Check credits
      if (realtorData.credits < data.creditsCost) {
        throw new Error('Insufficient credits');
      }
      
      // Create purchase record
      const purchaseId = generateFirebaseId();
      const purchase: LeadPurchase = {
        id: purchaseId,
        realtorId: data.realtorId,
        buyerId: data.buyerId,
        creditsCost: data.creditsCost,
        purchasePrice: data.purchasePrice,
        status: 'purchased',
        purchasedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      // Calculate new balance
      const newBalance = realtorData.credits - data.creditsCost;
      
      // Write both updates atomically
      const purchaseRef = doc(db!, COLLECTIONS.LEAD_PURCHASES, purchaseId);
      
      transaction.set(purchaseRef, purchase);
      transaction.update(realtorRef, {
        credits: newBalance,
        updatedAt: serverTimestamp()
      });
      
      return { purchase, newBalance };
    });
  }

  // Helper: Clean up orphaned data
  static async cleanupOrphanedData(): Promise<{
    usersWithoutProfiles: string[];
    profilesWithoutUsers: string[];
    fixed: number;
  }> {
    const results = {
      usersWithoutProfiles: [] as string[],
      profilesWithoutUsers: [] as string[],
      fixed: 0
    };
    
    // Find users without profiles
    const users = await this.queryDocuments<User>(COLLECTIONS.USERS, []);
    for (const user of users) {
      const profileCollection = user.role === 'buyer' ? 
        COLLECTIONS.BUYER_PROFILES : COLLECTIONS.REALTOR_PROFILES;
      
      const profiles = await this.queryDocuments<BuyerProfile | RealtorProfile>(
        profileCollection,
        [{ field: 'userId', operator: '==', value: user.id }],
        1
      );
      
      if (profiles.length === 0) {
        results.usersWithoutProfiles.push(user.id);
      }
    }
    
    return results;
  }
}

// Export convenience methods
export const { 
  createUser, 
  findUserByEmail, 
  createBuyerProfile, 
  createRealtorProfile, 
  findBuyerByUserId, 
  findRealtorByUserId, 
  createUserWithProfile, 
  purchaseLeadAtomic, 
  cleanupOrphanedData
} = FirebaseDB;