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
    <div className="min-h-screen bg-white">
      {/* Simple Header */}
      <header style={{
        padding: 'var(--mobile-padding)',
        borderBottom: '1px solid var(--blue-200)'
      }}>
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div style={{
              width: '32px',
              height: '32px',
              background: 'var(--primary)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              🏠
            </div>
            <span style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--blue-950)'
            }}>
              OwnerFi
            </span>
          </Link>
        </div>
      </header>

      {/* Main Content - Perfect for 380px */}
      <main style={{
        padding: 'var(--space-8) var(--mobile-padding)',
        maxWidth: 'var(--mobile-content-width)',
        margin: '0 auto'
      }}>
        {/* Welcome */}
        <div className="text-center mb-8">
          <h1 style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--gray-900)',
            marginBottom: 'var(--space-2)'
          }}>
            Welcome Back
          </h1>
          <p style={{
            fontSize: 'var(--text-base)',
            color: 'var(--blue-600)'
          }}>
            Sign in to continue your home search
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{marginBottom: 'var(--space-8)'}}>
          {error && (
            <div style={{
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-4)',
              background: 'rgb(239 68 68 / 0.1)',
              border: '1px solid rgb(239 68 68 / 0.2)',
              borderRadius: 'var(--radius-lg)',
              color: '#991b1b'
            }}>
              {error}
            </div>
          )}
          
          <div style={{marginBottom: 'var(--space-4)'}}>
            <label style={{
              display: 'block',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              color: 'var(--blue-700)',
              marginBottom: 'var(--space-2)'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="your@email.com"
              className="input"
            />
          </div>

          <div style={{marginBottom: 'var(--space-6)'}}>
            <label style={{
              display: 'block',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              color: 'var(--blue-700)',
              marginBottom: 'var(--space-2)'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Your password"
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary btn-lg w-full"
            style={{marginBottom: 'var(--space-4)'}}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="loading"></span>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>

          <div className="text-center">
            <Link 
              href="/auth/forgot-password" 
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--primary)',
                textDecoration: 'none'
              }}
            >
              Forgot password?
            </Link>
          </div>
        </form>

        {/* Sign Up Options */}
        <div>
          <p style={{
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--font-medium)',
            color: 'var(--gray-900)',
            textAlign: 'center',
            marginBottom: 'var(--space-4)'
          }}>
            Don't have an account?
          </p>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-3)'}}>
            <a href="/unified-signup" className="btn-primary btn-lg w-full">
              🏠 I'm Looking for a Home
            </a>
            <a href="/unified-signup" className="btn-secondary btn-lg w-full">
              🤝 I'm a Real Estate Professional
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 'var(--space-12)',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--blue-500)',
            lineHeight: '1.5'
          }}>
            By signing in, you agree to our{' '}
            <Link href="/terms" style={{color: 'var(--primary)', textDecoration: 'none'}}>
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" style={{color: 'var(--primary)', textDecoration: 'none'}}>
              Privacy Policy
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}