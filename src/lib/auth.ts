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
// NextAuthOptions type doesn't exist in newer versions, use a generic type

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
        if (!db) {
          return null;
        }

        // Phone-based authentication (no password)
        if (credentials?.phone && !credentials?.password) {
          const phone = credentials.phone as string;

          // Normalize phone number - strip all non-digits
          const cleaned = phone.replace(/\D/g, '');
          const last10Digits = cleaned.slice(-10);

          // Try multiple phone formats
          const phoneFormats = [
            phone,
            last10Digits,
            `+1${last10Digits}`,
            `(${last10Digits.slice(0,3)}) ${last10Digits.slice(3,6)}-${last10Digits.slice(6)}`,
          ];

          let userDocs: any = null;

          // Try each format until we find a match
          for (const format of phoneFormats) {
            const usersQuery = query(
              collection(db, 'users'),
              where('phone', '==', format)
            );
            const docs = await getDocs(usersQuery);

            if (!docs.empty) {
              userDocs = docs;
              break;
            }
          }

          if (!userDocs || userDocs.empty) {
            return null;
          }

          const userDoc = userDocs.docs[0];
          const userData = userDoc.data();

          return {
            id: userDoc.id,
            email: userData.email,
            name: userData.name,
            phone: userData.phone,
            role: userData.role,
          };
        }

        // Email/password authentication (legacy support)
        if (credentials?.email && credentials?.password) {
          const email = credentials.email as string;
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