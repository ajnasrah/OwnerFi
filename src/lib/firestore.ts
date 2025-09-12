import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs, orderBy as firestoreOrderBy, limit, DocumentData } from 'firebase/firestore';
import { getSafeDb } from './firebase-safe';

/**
 * Firestore helper utilities for common database operations
 */
export const firestoreHelpers = {
  /**
   * Generate a unique ID for Firestore documents
   */
  generateId(): string {
    const db = getSafeDb();
    return doc(collection(db, 'temp')).id;
  },

  /**
   * Get a document by ID
   */
  async getDocument<T = DocumentData>(collectionName: string, docId: string): Promise<T | null> {
    try {
      const db = getSafeDb();
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Set a document with ID
   */
  async setDocument<T = DocumentData>(
    collectionName: string, 
    docId: string, 
    data: T
  ): Promise<void> {
    try {
      const db = getSafeDb();
      const docRef = doc(db, collectionName, docId);
      await setDoc(docRef, data as DocumentData);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update a document
   */
  async updateDocument<T = DocumentData>(
    collectionName: string, 
    docId: string, 
    data: Partial<T>
  ): Promise<void> {
    try {
      const db = getSafeDb();
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, data as Record<string, unknown>);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete a document
   */
  async deleteDocument(collectionName: string, docId: string): Promise<void> {
    try {
      const db = getSafeDb();
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Query documents with filtering
   */
  async queryDocuments<T = DocumentData>(
    collectionName: string,
    field: string,
    operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'array-contains-any' | 'in' | 'not-in',
    value: unknown,
    orderByField?: string,
    limitCount?: number
  ): Promise<T[]> {
    try {
      const db = getSafeDb();
      const collectionRef = collection(db, collectionName);
      let q = query(collectionRef, where(field, operator, value));
      
      if (orderByField) {
        q = query(q, firestoreOrderBy(orderByField));
      }
      
      if (limitCount) {
        q = query(q, limit(limitCount));
      }
      
      const querySnapshot = await getDocs(q);
      const results: T[] = [];
      
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() } as T);
      });
      
      return results;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get all documents from a collection
   */
  async getAllDocuments<T = DocumentData>(collectionName: string, limitCount?: number): Promise<T[]> {
    try {
      const db = getSafeDb();
      const collectionRef = collection(db, collectionName);
      let q = query(collectionRef);
      
      if (limitCount) {
        q = query(q, limit(limitCount));
      }
      
      const querySnapshot = await getDocs(q);
      const results: T[] = [];
      
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() } as T);
      });
      
      return results;
    } catch (error) {
      throw error;
    }
  }
};