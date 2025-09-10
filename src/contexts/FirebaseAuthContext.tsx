'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { firebaseAuth, AuthUser } from '@/lib/firebase-auth';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ user: AuthUser | null; error: string | null }>;
  signUp: (email: string, password: string, role: 'buyer' | 'realtor', additionalData?: Record<string, unknown>) => Promise<{ user: AuthUser | null; error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = firebaseAuth.onAuthStateChange((authUser) => {
      setUser(authUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const result = await firebaseAuth.signIn(email, password);
    if (result.user) {
      setUser(result.user);
    }
    setLoading(false);
    return result;
  };

  const signUp = async (email: string, password: string, role: 'buyer' | 'realtor', additionalData: Record<string, unknown> = {}) => {
    setLoading(true);
    const result = await firebaseAuth.signUp(email, password, role, additionalData);
    if (result.user) {
      setUser(result.user);
    }
    setLoading(false);
    return result;
  };

  const signOut = async () => {
    setLoading(true);
    const result = await firebaseAuth.signOut();
    setUser(null);
    setLoading(false);
    return result;
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}