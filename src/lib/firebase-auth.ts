import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { firestoreHelpers } from './firestore';

// Custom user type with role
export interface AuthUser extends User {
  role?: 'buyer' | 'realtor' | 'admin';
}

// Auth context for React components
export const firebaseAuth = {
  // Sign up with email/password
  async signUp(email: string, password: string, role: 'buyer' | 'realtor', additionalData: any = {}) {
    try {
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        role: role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...additionalData
      });
      
      return { user: { ...user, role }, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  },

  // Sign in with email/password
  async signIn(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Get user role from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const role = userDoc.exists() ? userDoc.data().role : null;
      
      return { user: { ...user, role }, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  },

  // Sign out
  async signOut() {
    try {
      await signOut(auth);
      return { error: null };
    } catch (error: any) {
      return { error: error.message };
    }
  },

  // Get current user with role
  async getCurrentUser(): Promise<AuthUser | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        
        if (!user) {
          resolve(null);
          return;
        }
        
        // Get user role
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const role = userDoc.exists() ? userDoc.data().role : null;
          resolve({ ...user, role } as AuthUser);
        } catch (error) {
          console.error('Error fetching user role:', error);
          resolve(user as AuthUser);
        }
      });
    });
  },

  // Auth state listener
  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        callback(null);
        return;
      }
      
      // Get user role
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const role = userDoc.exists() ? userDoc.data().role : null;
        callback({ ...user, role } as AuthUser);
      } catch (error) {
        console.error('Error fetching user role:', error);
        callback(user as AuthUser);
      }
    });
  }
};

// Server-side auth verification
export async function verifyFirebaseAuth(idToken: string): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    // This would use Firebase Admin SDK for server-side verification
    // For now, we'll create a simple session API
    return { user: null, error: 'Server-side auth not implemented yet' };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
}