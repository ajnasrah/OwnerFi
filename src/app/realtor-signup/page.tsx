'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RealtorSignup() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    primaryCityQuery: '',
    company: '',
    licenseNumber: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.phone) {
      setError('Please fill in all required fields');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/realtor/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          primaryCityQuery: 'Setup Required',
          company: formData.company,
          licenseNumber: formData.licenseNumber
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || 'Failed to create account');
        return;
      }

      if (!data.success) {
        setError('Account creation failed. Please try again.');
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
          // Success! Proceed to settings
          router.push('/realtor-dashboard/settings');
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-900 flex items-center justify-center overflow-hidden">
      <div className="w-full max-w-lg mx-auto px-4">
        <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-4 max-h-[95vh] overflow-y-auto">
          <div className="text-center mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Agents: Get more leads</h1>
            <p className="text-white font-normal mb-3 text-sm">Connect with buyers who need owner financing</p>
            <div className="space-y-1 text-sm">
              <p className="text-white">
                Already have an account?{' '}
                <Link href="/auth/signin" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                  Sign In
                </Link>
              </p>
              <p className="text-xs text-white">
                Looking for a home instead?{' '}
                <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                  Find Your Home
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-white">First name</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  className="w-full px-3 py-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-white">Last name</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  className="w-full px-3 py-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm"
                  placeholder="Last name"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-white">Email address</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm"
                placeholder="Your work email"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-white">Phone number</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm"
                placeholder="Your phone"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-white">Password</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className="w-full px-3 py-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm"
                  placeholder="Password"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-white">Confirm password</label>
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  className="w-full px-3 py-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm"
                  placeholder="Confirm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? 'Creating account...' : 'Start getting leads'}
            </button>
          </form>

          <div className="mt-3 bg-emerald-500/10 border border-emerald-400/30 rounded-lg p-3">
            <h3 className="font-bold text-white mb-2 text-sm">Join 800+ agents earning more:</h3>
            <ul className="space-y-1 text-xs text-white">
              <li className="flex items-center">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-2"></div>
                Buyers with cash ready
              </li>
              <li className="flex items-center">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-2"></div>
                No credit check hassles
              </li>
              <li className="flex items-center">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-2"></div>
                Faster closings guaranteed
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}