import type { Session } from 'next-auth';

// Extended user interface for NextAuth sessions
export interface ExtendedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  phone?: string | null;
  role: 'buyer' | 'realtor' | 'admin';
}

// Extended session interface
export interface ExtendedSession extends Omit<Session, 'user'> {
  user: ExtendedUser;
}

// Type guard to check if session has extended user properties
export function isExtendedSession(session: Session | null | undefined): session is ExtendedSession {
  return !!(session?.user && 'role' in session.user && 'id' in session.user);
}

// Helper to safely access extended session properties
export function getExtendedUser(session: Session | null): ExtendedUser | null {
  if (isExtendedSession(session)) {
    return session.user;
  }
  return null;
}