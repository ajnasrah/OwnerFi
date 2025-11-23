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
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!agreedToTerms) {
      setError('You must agree to the Terms, Privacy Policy, and consent to receive text messages');
      setLoading(false);
      return;
    }

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
          name: `${formData.firstName} ${formData.lastName}`,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Join OwnerFi</h1>
          <p className="text-slate-600 text-lg mb-4">Skip the bank. Buy direct.</p>
          <p className="text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/auth" className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">First name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 placeholder-slate-400 transition-all"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Last name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 placeholder-slate-400 transition-all"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email address</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 placeholder-slate-400 transition-all"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Phone number</label>
              <input
                type="tel"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 placeholder-slate-400 transition-all"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 placeholder-slate-400 transition-all"
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 placeholder-slate-400 transition-all"
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              />
            </div>

            {/* Terms, Privacy Policy, and SMS Consent Checkbox */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms-consent"
                  checked={agreedToTerms}
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked);
                    setError('');
                  }}
                  className="mt-0.5 w-5 h-5 text-emerald-600 bg-white border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  required
                />
                <label htmlFor="terms-consent" className="text-sm text-slate-700 leading-relaxed cursor-pointer">
                  I agree to the{' '}
                  <Link href="/terms" className="text-emerald-600 hover:text-emerald-700 font-semibold underline" target="_blank">
                    Terms and Conditions
                  </Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="text-emerald-600 hover:text-emerald-700 font-semibold underline" target="_blank">
                    Privacy Policy
                  </Link>
                  {', and I consent to receive text messages and calls from OwnerFi and its partner real estate agents at the phone number provided, including by automated means. Consent is not required to purchase services. Message and data rates may apply.'}
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-4 px-6 rounded-xl font-semibold text-base transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>
        </div>

        {/* Bottom Links */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Real estate professional?{' '}
            <Link href="/auth" className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors">
              Join as a Realtor
            </Link>
          </p>
        </div>

        {/* Info Badge */}
        <div className="mt-6 bg-white/60 backdrop-blur border border-slate-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">OwnerFi connects you with opportunities</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                We're a lead generation platform connecting buyers with licensed real estate agents. Information provided is for educational purposes only and not financial advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}