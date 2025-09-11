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

    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900" style={{zoom: '0.8'}}>
      {/* Header */}
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
              <h1 className="text-3xl font-bold text-white mb-3">Join as a realtor</h1>
              <p className="text-white font-normal">Get qualified buyer leads for owner-financed properties</p>
            </div>

            {error && (
              <div className="mb-6 bg-red-600/20 backdrop-blur-lg border border-red-500/30 rounded-xl p-4">
                <p className="text-red-300 font-semibold">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-3" style={{color: 'white'}}>First name</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-3" style={{color: 'white'}}>Last name</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3" style={{color: 'white'}}>Email address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
                  placeholder="john@realty.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3" style={{color: 'white'}}>Phone number</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3" style={{color: 'white'}}>Password</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3" style={{color: 'white'}}>Confirm password</label>
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
                  placeholder="••••••••"
                />
              </div>

              <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-4">
                <h3 className="font-bold text-white mb-3">Realtor benefits:</h3>
                <ul className="space-y-2 text-sm text-white">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></div>
                    Pre-qualified buyer leads
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></div>
                    Direct contact information
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></div>
                    Affordable lead pricing
                  </li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 shadow-2xl shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account...' : 'Start getting leads'}
              </button>
            </form>

            <div className="mt-8 text-center space-y-4">
              <p className="text-white">
                Already have an account?{' '}
                <Link href="/auth/signin" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                  Sign In
                </Link>
              </p>
              <p className="text-sm text-white">
                Looking for a home instead?{' '}
                <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                  Find Your Home
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}