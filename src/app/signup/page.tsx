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
      
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  return (
    <div className="h-screen bg-slate-900 flex items-center justify-center overflow-hidden">
      <div className="w-full max-w-lg mx-auto px-4">
        <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-4 max-h-[95vh] overflow-y-auto">
          <div className="text-center mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Skip the bank. Buy direct.</h1>
            <p className="text-white font-normal mb-3 text-sm">Real people selling real homes without traditional mortgages</p>
            <div className="space-y-1 text-sm">
              <p className="text-white">
                Already have an account?{' '}
                <Link href="/auth/signin" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                  Sign In
                </Link>
              </p>
              <p className="text-xs text-white">
                Real estate professional?{' '}
                <Link href="/realtor-signup" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                  Join as a Realtor
                </Link>
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-3 bg-red-600/20 backdrop-blur-lg border border-red-500/30 rounded-lg p-3">
              <p className="text-red-300 font-semibold text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-white mb-1">Full name</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm"
                placeholder="Your full name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1">Email address</label>
              <input
                type="email"
                required
                className="w-full px-3 py-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1">Phone number</label>
              <input
                type="tel"
                required
                className="w-full px-3 py-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm"
                placeholder="Your phone number"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1">Password</label>
              <input
                type="password"
                required
                className="w-full px-3 py-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm"
                placeholder="Create password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1">Confirm password</label>
              <input
                type="password"
                required
                className="w-full px-3 py-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm"
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="mt-3 bg-emerald-500/10 border border-emerald-400/30 rounded-lg p-3">
            <h3 className="font-bold text-white mb-2 text-sm">Why people choose OwnerFi:</h3>
            <ul className="space-y-1 text-xs text-white">
              <li className="flex items-center">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-2"></div>
                No bank approval needed
              </li>
              <li className="flex items-center">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-2"></div>
                Lower down payments available  
              </li>
              <li className="flex items-center">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-2"></div>
                Real sellers, real properties
              </li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}