'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUp() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          role: 'buyer'
        }),
      });

      const data = await response.json();
      
      if (!response.ok || data.error) {
        setError(data.error || 'Failed to create account');
        setLoading(false);
        return;
      }

      if (!data.success) {
        setError('Account creation failed. Please try again.');
        setLoading(false);
        return;
      }

      // Wait for database sync and attempt auto-signin with retries
      let signInAttempts = 0;
      const maxAttempts = 3;
      let signInResult;

      while (signInAttempts < maxAttempts) {
        // Wait before attempt (longer delays for subsequent attempts)
        await new Promise(resolve => setTimeout(resolve, (signInAttempts + 1) * 1000));
        
        signInResult = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });

        if (signInResult?.ok && !signInResult.error) {
          // Success! Proceed to setup
          router.push('/dashboard/setup');
          return;
        }

        signInAttempts++;
      }

      // All attempts failed - account created but auto-signin didn't work
      setError('Account created successfully! Please sign in with your credentials.');
      setTimeout(() => {
        router.push('/auth/signin');
      }, 2000);
      
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
    <div className="min-h-screen bg-slate-900" style={{zoom: '0.8'}}>
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
          <Link
            href="/auth/signin"
            className="text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-slate-700/50"
          >
            Sign In
          </Link>
        </div>
      </header>

      <div className="flex flex-col justify-center px-6" style={{height: 'calc(100vh - 80px)'}}>
        <div className="max-w-md mx-auto w-full">
        <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-3">Find your home</h1>
            <p className="text-white font-normal">Join thousands who found homes through owner financing</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-600/20 backdrop-blur-lg border border-red-500/30 rounded-xl p-4">
              <p className="text-red-300 font-semibold">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-white mb-3">Full name</label>
              <input
                type="text"
                required
                className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
                placeholder="John Smith"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-3">Email address</label>
              <input
                type="email"
                required
                className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-3">Phone number</label>
              <input
                type="tel"
                required
                className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-3">Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
                placeholder="Choose a strong password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-3">Confirm password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 shadow-2xl shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="mt-6 bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-4">
            <h3 className="font-bold text-white mb-3">What you get:</h3>
            <ul className="space-y-2 text-sm text-white">
              <li className="flex items-center">
                <div className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></div>
                Direct access to owner-financed homes
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></div>
                Flexible financing terms
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></div>
                Professional agent support
              </li>
            </ul>
          </div>

          <div className="mt-8 text-center space-y-4">
            <p className="text-white">
              Already have an account?{' '}
              <Link href="/auth/signin" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                Sign In
              </Link>
            </p>
            <p className="text-sm text-white">
              Real estate professional?{' '}
              <Link href="/realtor-signup" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                Join as a Realtor
              </Link>
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}