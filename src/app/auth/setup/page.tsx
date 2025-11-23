'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

export default function AuthSetup() {
  const router = useRouter();
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Unified form data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    isRealtor: false,
    licenseNumber: '',
    company: ''
  });

  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    // Get verified phone from session storage
    const phone = sessionStorage.getItem('verified_phone');
    if (!phone) {
      // No verified phone - redirect back to auth
      router.push('/auth');
      return;
    }
    setVerifiedPhone(phone);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!agreedToTerms) {
      setError('You must agree to the Terms, Privacy Policy, and consent to receive text messages');
      setLoading(false);
      return;
    }

    // Validate realtor-specific fields if they selected realtor
    if (formData.isRealtor && !formData.licenseNumber.trim()) {
      setError('License number is required for realtors');
      setLoading(false);
      return;
    }

    try {
      const role = formData.isRealtor ? 'realtor' : 'buyer';

      // Create account
      const response = await fetch('/api/auth/signup-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: verifiedPhone,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          role,
          // Realtor-specific fields
          ...(formData.isRealtor && {
            company: formData.company,
            licenseNumber: formData.licenseNumber,
            primaryCity: 'Setup Required'
          })
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || 'Failed to create account');
        setLoading(false);
        return;
      }

      // Sign in the user
      const signInResult = await signIn('credentials', {
        phone: verifiedPhone,
        redirect: false,
      });

      if (signInResult?.ok) {
        // Clear session storage
        sessionStorage.removeItem('verified_phone');

        if (formData.isRealtor) {
          router.push('/realtor-dashboard/settings');
        } else {
          // Set flag for tutorial
          localStorage.setItem('isNewBuyerAccount', 'true');
          // Redirect to settings to complete setup
          router.push('/dashboard/settings');
        }
      } else {
        setError('Account created but failed to sign in. Please try signing in manually.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  if (!verifiedPhone) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Set Up Your Profile</h1>
          <p className="text-slate-300">Just a few details to get started</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-6">
          {error && (
            <div className="mb-4 bg-red-500/20 border border-red-500/50 rounded-xl p-3">
              <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2">First Name</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-slate-500"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2">Last Name</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-slate-500"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-2">Email Address</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-slate-500"
                placeholder="john@example.com"
              />
              <p className="text-xs text-slate-400 mt-1">We'll use this to send you updates</p>
            </div>

            {/* Are you a realtor? */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-3">Are you a licensed realtor?</label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="isRealtor"
                    checked={formData.isRealtor === true}
                    onChange={() => setFormData(prev => ({ ...prev, isRealtor: true }))}
                    className="w-4 h-4 text-emerald-500 bg-slate-700 border-slate-600 focus:ring-emerald-400"
                  />
                  <span className="ml-2 text-slate-200">Yes</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="isRealtor"
                    checked={formData.isRealtor === false}
                    onChange={() => setFormData(prev => ({ ...prev, isRealtor: false }))}
                    className="w-4 h-4 text-emerald-500 bg-slate-700 border-slate-600 focus:ring-emerald-400"
                  />
                  <span className="ml-2 text-slate-200">No</span>
                </label>
              </div>
            </div>

            {/* Realtor-specific fields - only show if they selected Yes */}
            {formData.isRealtor && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-2">License Number</label>
                  <input
                    type="text"
                    required
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-slate-500"
                    placeholder="TX12345678"
                  />
                  <p className="text-xs text-slate-400 mt-1">Enter your real estate license number</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-2">Company (Optional)</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-slate-500"
                    placeholder="ABC Realty"
                  />
                </div>
              </>
            )}

            <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-500 bg-slate-700 border-slate-600 rounded focus:ring-emerald-400 cursor-pointer"
                  required
                />
                <label htmlFor="terms" className="text-xs text-slate-300 leading-relaxed cursor-pointer">
                  I agree to the{' '}
                  <Link href="/terms" className="text-emerald-400 hover:text-emerald-300 font-semibold underline" target="_blank">
                    Terms and Conditions
                  </Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300 font-semibold underline" target="_blank">
                    Privacy Policy
                  </Link>
                  {', and I consent to receive text messages and calls from OwnerFi. Message rates may apply.'}
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-3 px-4 rounded-lg font-bold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Continue →'}
            </button>
            {!formData.isRealtor && (
              <p className="text-xs text-center text-slate-400 mt-2">
                Next: Set your search preferences
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
