/**
 * Firebase Lazy Loader
 *
 * PERFORMANCE OPTIMIZATION:
 * This file provides lazy-loaded Firebase imports to reduce initial bundle size.
 * Firebase is 3MB - we don't want it loaded on every page!
 *
 * Usage:
 * const { db } = await loadFirebase();
 *
 * Instead of:
 * import { db } from '@/lib/firebase';
 */

// Lazy load Firebase only when needed
export const loadFirebase = async () => {
  const firebase = await import('./firebase');
  return {
    db: firebase.db,
    auth: firebase.auth,
    storage: firebase.storage,
  };
};

// Helper for Firestore operations with tree-shaking
export const loadFirestore = async () => {
  const [firebase, firestore] = await Promise.all([
    import('./firebase'),
    import('firebase/firestore')
  ]);

  return {
    db: firebase.db,
    collection: firestore.collection,
    doc: firestore.doc,
    getDoc: firestore.getDoc,
    getDocs: firestore.getDocs,
    query: firestore.query,
    where: firestore.where,
    orderBy: firestore.orderBy,
    limit: firestore.limit,
    addDoc: firestore.addDoc,
    setDoc: firestore.setDoc,
    updateDoc: firestore.updateDoc,
    deleteDoc: firestore.deleteDoc,
  };
};

// Helper for Auth operations
export const loadAuth = async () => {
  const [firebase, auth] = await Promise.all([
    import('./firebase'),
    import('firebase/auth')
  ]);

  return {
    auth: firebase.auth,
    signInWithEmailAndPassword: auth.signInWithEmailAndPassword,
    signOut: auth.signOut,
    createUserWithEmailAndPassword: auth.createUserWithEmailAndPassword,
    onAuthStateChanged: auth.onAuthStateChanged,
  };
};

// Helper for Storage operations
export const loadStorage = async () => {
  const [firebase, storage] = await Promise.all([
    import('./firebase'),
    import('firebase/storage')
  ]);

  return {
    storage: firebase.storage,
    ref: storage.ref,
    uploadBytes: storage.uploadBytes,
    getDownloadURL: storage.getDownloadURL,
  };
};
