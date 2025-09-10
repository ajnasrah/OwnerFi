'use client';

import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
        // Get the session to determine user role
        const session = await getSession();
        if (isExtendedSession(session)) {
          if (session.user.role === 'buyer') {
            router.push('/dashboard');
          } else if (session.user.role === 'realtor') {
            router.push('/realtor/dashboard');
          } else if (session.user.role === 'admin' && session.user.email === 'admin@prosway.com') {
            router.push('/admin');
          } else {
            router.push('/dashboard');
          }
        } else {
          // Default to buyer dashboard for sessions without role
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
    <div className="min-h-screen bg-primary-bg flex flex-col mobile-safe-area prevent-overscroll">
      <Header />
      
      <div className="flex-1 mobile-content">
        <div className="mobile-container max-w-md mx-auto">
          {/* Welcome section */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary-text mb-2">Welcome Back</h1>
            <p className="text-base sm:text-lg text-secondary-text">Sign in to find your perfect home</p>
          </div>

          {/* Form */}
          <div className="mobile-card p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="your@email.com"
                  className="mobile-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Your password"
                  className="mobile-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mobile-button primary"
                style={{width: '100%', fontWeight: '600'}}
              >
                {loading ? (
                  <span style={{display: 'flex', alignItems: 'center', gap: 'var(--space-2)'}}>
                    <span className="loading-spinner"></span>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="text-center">
                <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">
                  Forgot password?
                </Link>
              </div>
            </form>
          </div>

          {/* Sign up options */}
          <div className="mt-6">
            <div className="text-center mb-4">
              <p className="text-base font-medium text-primary-text">Don't have an account?</p>
            </div>
            
            <div className="space-y-3">
              <a
                href="/unified-signup"
                className="mobile-button secondary"
                style={{width: '100%', fontWeight: '600', textDecoration: 'none'}}
              >
                🏠 I'm Looking for a Home
              </a>
              
              <a
                href="/unified-signup"
                className="mobile-button secondary"
                style={{width: '100%', fontWeight: '600', textDecoration: 'none', borderStyle: 'dashed'}}
              >
                🤝 I'm a Real Estate Professional
              </a>
            </div>
          </div>

          {/* Footer links */}
          <div className="mt-6 text-center space-y-3">
            <p className="text-xs sm:text-sm text-secondary-text leading-relaxed">
              By signing in, you agree to our{' '}
              <Link href="/terms" className="text-accent-primary hover:text-accent-hover underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-accent-primary hover:text-accent-hover underline">
                Privacy Policy
              </Link>
            </p>
            
            <Link href="/" className="text-accent-primary hover:text-accent-hover text-sm">
              ← Back to home page
            </Link>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}