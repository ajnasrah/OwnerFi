'use client';

import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isExtendedSession } from '@/types/session';

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
          if ((session as any)?.user?.role === 'buyer') {
            router.push('/dashboard');
          } else if ((session as any)?.user?.role === 'realtor') {
            router.push('/realtor-dashboard');
          } else if ((session as any)?.user?.role === 'admin' && (session as any)?.user?.email === 'admin@prosway.com') {
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
      {/* Dark Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <span className="text-xl font-bold text-white">
              OwnerFi
            </span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-12 max-w-md mx-auto">
        {/* Welcome */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-3">
            Welcome back
          </h1>
          <p className="text-lg text-white font-normal">
            Sign in to access your property matches
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mb-10">
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

        {/* Sign Up Options */}
        <div>
          <div className="flex items-center mb-6">
            <div className="flex-1 h-px bg-slate-700"></div>
            <span className="px-4 text-white font-medium">Don't have an account?</span>
            <div className="flex-1 h-px bg-slate-700"></div>
          </div>
          
          <div className="space-y-4">
            <a href="/signup" className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 flex items-center justify-center shadow-2xl shadow-emerald-500/25">
              I'm looking for a home
            </a>
            <a href="/realtor-signup" className="w-full bg-slate-800/50 backdrop-blur-lg border-2 border-slate-600/50 hover:border-slate-500 text-white hover:text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 hover:bg-slate-700/50 flex items-center justify-center">
              I'm a real estate agent
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
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
      </main>
    </div>
  );
}