import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { ExtendedUser } from '@/types/session';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { unifiedDb } from './unified-db';
import { normalizePhone } from './phone-utils';
// NextAuthOptions type doesn't exist in newer versions, use a generic type

// Phone numbers that always get admin access (from environment variable)
// Normalize all admin phones to E.164 format for consistent comparison
const ADMIN_PHONES = (process.env.ADMIN_PHONE_NUMBERS || '')
  .split(',')
  .filter(Boolean)
  .map(p => {
    try {
      return normalizePhone(p.trim());
    } catch {
      console.warn(`[AUTH] Invalid admin phone number in env: ${p}`);
      return null;
    }
  })
  .filter((p): p is string => p !== null);

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        phone: { label: 'Phone', type: 'tel' },
        firstName: { label: 'First Name', type: 'text' },
        lastName: { label: 'Last Name', type: 'text' },
        isSignUp: { label: 'Is Sign Up', type: 'text' }
      },
      async authorize(credentials) {
        // Phone-based authentication (no password) - uses unifiedDb (admin SDK), not client db
        if (credentials?.phone && !credentials?.password) {
          try {
            const phone = credentials.phone as string;

            console.log('🔐 [AUTH] Phone login attempt:', phone);

            // Normalize phone to E.164 format
            const normalizedPhone = normalizePhone(phone);
            console.log('🔐 [AUTH] Normalized phone:', normalizedPhone);

            // Use unified DB method - it tries all formats automatically
            const user = await unifiedDb.users.findByPhone(normalizedPhone);

            if (!user) {
              console.log('❌ [AUTH] User not found for phone:', normalizedPhone);
              return null;
            }

            // Check if phone is in admin list
            const isAdminPhone = ADMIN_PHONES.includes(normalizedPhone);
            const effectiveRole = isAdminPhone ? 'admin' : user.role;

            console.log('✅ [AUTH] User found:', {
              id: user.id,
              role: effectiveRole,
              email: user.email,
              isAdminPhone
            });

            // Update lastSignIn timestamp
            if (db) {
              updateDoc(doc(db, 'users', user.id), { lastSignIn: serverTimestamp() }).catch(() => {});
            }

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              phone: user.phone,
              role: effectiveRole,
            };
          } catch (error) {
            console.error('❌ [AUTH] Phone auth error:', error);
            return null;
          }
        }

        // Email/password authentication (legacy support) - requires client db
        if (credentials?.email && credentials?.password) {
          if (!db) {
            console.error('❌ [AUTH] Firebase client db not initialized for email auth');
            return null;
          }

          // Normalize email to lowercase to match stored format
          const email = (credentials.email as string).toLowerCase().trim();
          const password = credentials.password as string;

          const usersQuery = query(
            collection(db, 'users'),
            where('email', '==', email)
          );
          const userDocs = await getDocs(usersQuery);

          if (userDocs.empty) {
            return null;
          }

          const userDoc = userDocs.docs[0];
          const userData = userDoc.data();

          if (!userData.password) {
            return null;
          }

          const isPasswordValid = await compare(password, userData.password);

          if (!isPasswordValid) {
            return null;
          }

          // Update lastSignIn timestamp
          updateDoc(doc(db, 'users', userDoc.id), { lastSignIn: serverTimestamp() }).catch(() => {});

          return {
            id: userDoc.id,
            email: userData.email,
            name: userData.name,
            phone: userData.phone,
            role: userData.role,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: ExtendedUser }) {
      if (user) {
        token.role = user.role;
        token.phone = user.phone;
        (token as unknown as { deletedCheckedAt?: number }).deletedCheckedAt = Date.now();
      } else {
        // Existing-JWT refresh path (no `user` param). Periodically re-check
        // Firestore for `deleted: true` / `role: 'deleted'` so a user whose
        // account was deleted after issuing this JWT loses access without
        // waiting for the 30-day token expiry. Checked at most every hour
        // per token so we don't hit Firestore on every request.
        const tok = token as unknown as { sub?: string; deletedCheckedAt?: number; role?: string };
        const lastChecked = tok.deletedCheckedAt || 0;
        const now = Date.now();
        if (tok.sub && (now - lastChecked) > 60 * 60 * 1000) {
          try {
            const snap = await getDoc(doc(db, 'users', tok.sub));
            const data = snap.exists() ? (snap.data() as { deleted?: boolean; role?: string }) : null;
            if (data && (data.deleted === true || data.role === 'deleted')) {
              return {} as JWT;
            }
            tok.deletedCheckedAt = now;
          } catch {
            // Fail-open on Firestore hiccup — better to keep the user signed
            // in than to block every request on a DB outage. The next check
            // in ≤1 hour will re-verify.
            tok.deletedCheckedAt = now;
          }
        }
      }
      // Block deleted users from retaining a valid token. `role: 'deleted'`
      // is set by /api/account/delete and by the test-data cleanup script.
      if ((token as unknown as { role?: string }).role === 'deleted') {
        return {} as JWT;
      }
      return token;
    },
    async session({ session, token }: {
      session: Session;
      token: JWT & { role?: string; phone?: string | null };
    }) {
      if (!token || (token as unknown as { role?: string }).role === 'deleted') {
        // Return a minimal unauthenticated-looking session so callers that
        // read session.user.id treat the user as signed out.
        return { ...session, user: undefined } as unknown as Session;
      }
      if (session.user) {
        session.user.id = (token as JWT & { sub: string }).sub;
        session.user.role = token.role;
        session.user.phone = token.phone;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth',
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        // Use 'lax' for better CSRF protection
        // Only use 'none' if you have a specific cross-origin need AND have CSRF protection
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        domain: undefined
      }
    }
  },
};