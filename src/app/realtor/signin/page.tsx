'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RealtorSignIn() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // Redirect if already signed in with correct role
  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role === 'realtor') {
        router.push('/realtor/dashboard');
      } else if (session?.user?.role === 'buyer') {
        router.push('/dashboard');
      }
    }
  }, [session, status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
        setLoading(false);
        return;
      }

      // Check if user has completed realtor profile
      const response = await fetch('/api/realtor/profile');
      const data = await response.json();
      
      if (data.profile && data.profile.profileComplete) {
        router.push('/realtor/dashboard');
      } else {
        router.push('/realtor/setup');
      }
      
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="text-center">
            <Link href="/">
              <h1 className="text-4xl font-bold text-gray-900 mb-2 hover:text-blue-600 transition-colors cursor-pointer">🏠 OwnerFi</h1>
            </Link>
            <h2 className="text-2xl font-bold text-blue-600 mb-2">Buyer Link</h2>
            <p className="text-gray-600">Sign in to your realtor account</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || status === 'loading'}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400"
            >
              {loading || status === 'loading' ? 'Signing In...' : 'Sign In to Buyer Link'}
            </button>

            <div className="text-center mt-4">
              <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">
                Forgot password?
              </Link>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Don't have an account?{' '}
              <Link href="/unified-signup" className="text-blue-600 hover:text-blue-500 font-medium">
                Join Buyer Link
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center space-y-3">
            <p className="text-xs text-gray-500">
              By signing in, you agree to our{' '}
              <Link href="/terms" className="text-blue-600 hover:text-blue-500 underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-blue-600 hover:text-blue-500 underline">
                Privacy Policy
              </Link>
            </p>
            
            <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}