// Use any type to avoid NextAuth version conflicts
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { ExtendedUser } from '@/types/session';

export const authOptions: any = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        firstName: { label: 'First Name', type: 'text' },
        lastName: { label: 'Last Name', type: 'text' },
        isSignUp: { label: 'Is Sign Up', type: 'text' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Sign in logic - look up user in Firebase
        if (!db) {
          return null;
        }
        
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
          role: userData.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = token.sub;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
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
        // Use 'none' for cross-origin compatibility with Google Maps API
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        // Remove domain restriction to prevent Google Maps API cross-origin issues
        domain: undefined
      }
    }
  },
};