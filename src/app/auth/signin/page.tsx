'use client';

import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
        if (session?.user?.role === 'buyer') {
          router.push('/dashboard');
        } else if (session?.user?.role === 'realtor') {
          router.push('/realtor/dashboard');
        } else if (session?.user?.role === 'admin' && session?.user?.email === 'admin@prosway.com') {
          router.push('/admin');
        } else {
          // Default to buyer dashboard for unknown roles or non-admin users
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
    <div className="min-h-screen bg-primary-bg flex flex-col">
      <Header />
      
      <div className="flex-1 px-6 py-12">
        <div className="w-full">
          {/* Welcome section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-text mb-2">Welcome Back</h1>
            <p className="text-lg text-secondary-text">Sign in to find your perfect home</p>
          </div>

          {/* Form */}
          <div className="bg-surface-bg rounded-xl p-6 shadow-soft">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-error-bg border border-accent-primary/20 rounded-lg p-4">
                  <p className="text-accent-primary">{error}</p>
                </div>
              )}
              
              <Input
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="your@email.com"
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Your password"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading}
                className="w-full font-semibold text-lg py-5"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="text-center mt-4">
                <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">
                  Forgot password?
                </Link>
              </div>
            </form>
          </div>

          {/* Sign up options */}
          <div className="mt-8">
            <div className="text-center mb-6">
              <p className="text-lg font-medium text-primary-text">Don't have an account?</p>
            </div>
            
            <div className="space-y-4">
              <Button
                variant="secondary"
                size="lg"
                href="/unified-signup"
                className="w-full font-semibold text-lg py-5"
              >
                🏠 I'm Looking for a Home
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                href="/unified-signup"
                className="w-full font-semibold text-lg py-5"
              >
                🤝 I'm a Real Estate Professional
              </Button>
            </div>
          </div>

          {/* Footer links */}
          <div className="mt-8 text-center space-y-4">
            <p className="text-sm text-secondary-text">
              By signing in, you agree to our{' '}
              <Link href="/terms" className="text-accent-primary hover:text-accent-hover underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-accent-primary hover:text-accent-hover underline">
                Privacy Policy
              </Link>
            </p>
            
            <Link href="/" className="text-accent-primary hover:text-accent-hover">
              ← Back to home page
            </Link>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}