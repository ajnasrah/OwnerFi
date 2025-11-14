'use client';

import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isExtendedSession, ExtendedSession } from '@/types/session';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        const session = await getSession();
        if (session && isExtendedSession(session as unknown as ExtendedSession)) {
          const extSession = session as unknown as ExtendedSession;
          if (extSession.user.role === 'buyer') {
            router.push('/dashboard');
          } else if (extSession.user.role === 'realtor') {
            router.push('/realtor-dashboard');
          } else if (extSession.user.role === 'admin' && extSession.user.email === 'support@ownerfi.ai') {
            router.push('/admin');
          } else {
            router.push('/dashboard');
          }
        } else {
          router.push('/dashboard');
        }
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-900 overflow-hidden flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto px-4">
        <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-xl p-4 shadow-2xl">
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold text-white mb-2">Welcome back</h1>
            <p className="text-sm text-white font-normal mb-3">Sign in to access your property matches</p>
            <p className="text-xs text-white">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                Sign Up
              </Link>
            </p>
          </div>

          {error && (
            <div className="p-3 mb-3 bg-red-600/20 backdrop-blur-lg border border-red-500/30 rounded-lg text-red-300 font-semibold text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="mb-3">
            <div className="mb-3">
              <label className="block text-xs font-semibold mb-2 text-white">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="Enter your email"
                className="w-full px-3 py-3 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold mb-2 text-white">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter password"
                className="w-full px-3 py-3 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-105 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="text-center">
              <Link 
                href="/auth/forgot-password" 
                className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors text-xs"
              >
                Forgot password?
              </Link>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs text-white leading-relaxed">
              By signing in, you agree to our{' '}
              <Link href="/terms" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}