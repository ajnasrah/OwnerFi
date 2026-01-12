import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import {
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { ExtendedUser } from '@/types/session';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { unifiedDb } from './unified-db';
import { normalizePhone } from './phone-utils';
// NextAuthOptions type doesn't exist in newer versions, use a generic type

// Phone numbers that always get admin access (from environment variable)
const ADMIN_PHONES = (process.env.ADMIN_PHONE_NUMBERS || '').split(',').filter(Boolean).map(p => p.trim());

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
      }
      return token;
    },
    async session({ session, token }: {
      session: Session;
      token: JWT & { role?: string; phone?: string | null };
    }) {
      if (token && session.user) {
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