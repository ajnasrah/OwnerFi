import NextAuth from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// @ts-expect-error - NextAuth type compatibility issue
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };