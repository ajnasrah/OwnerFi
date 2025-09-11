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
        if (isExtendedSession(session as any)) {
          const extendedSession = session as ExtendedSession;
          if (extendedSession.user.role === 'buyer') {
            router.push('/dashboard');
          } else if (extendedSession.user.role === 'realtor') {
            router.push('/realtor-dashboard');
          } else if (extendedSession.user.role === 'admin' && extendedSession.user.email === 'admin@prosway.com') {
            router.push('/admin');
          } else {
            router.push('/dashboard');
          }
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div style={{ paddingTop: '2rem', paddingBottom: '2rem' }} className="px-6">
        <div className="max-w-md mx-auto w-full">
          <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
            {/* Welcome */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-3">
                Welcome back
              </h1>
              <p className="text-lg text-white font-normal mb-4">
                Sign in to access your property matches
              </p>
              <p className="text-white">
                Don't have an account?{' '}
                <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                  Sign Up
                </Link>
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mb-6">
          {error && (
            <div className="p-4 mb-6 bg-red-600/20 backdrop-blur-lg border border-red-500/30 rounded-xl text-red-300 font-semibold">
              {error}
            </div>
          )}
          
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-3" style={{color: 'white'}}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="your@email.com"
              className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
            />
          </div>

          <div className="mb-8">
            <label className="block text-sm font-semibold mb-3" style={{color: 'white'}}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 shadow-2xl shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>

          <div className="text-center">
            <Link 
              href="/auth/forgot-password" 
              className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
            >
              Forgot password?
            </Link>
          </div>
            </form>

            {/* Footer */}
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
    </div>
  );
}