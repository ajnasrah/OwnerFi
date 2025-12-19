'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExtendedSession } from '@/types/session';
import Link from 'next/link';
import { GooglePlacesAutocomplete } from '@/components/ui/GooglePlacesAutocomplete';

export default function BuyerSettings() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingPassed, setResettingPassed] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // FORM DATA - Search preferences and optional filters
  const [formData, setFormData] = useState({
    city: '',
    // User type flags
    isRealtor: false,
    isInvestor: false,
    // Optional property filters
    minBedrooms: '',
    maxBedrooms: '',
    minBathrooms: '',
    maxBathrooms: '',
    minSquareFeet: '',
    maxSquareFeet: '',
    minPrice: '',
    maxPrice: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    }

    // Allow buyers, realtors, and admins
    if (status === 'authenticated') {
      const userRole = (session as unknown as ExtendedSession)?.user?.role;
      // Redirect admins to admin dashboard instead of blocking them
      if (userRole === 'admin') {
        router.push('/admin');
        return;
      }
      if (userRole !== 'buyer' && userRole !== 'realtor') {
        router.push('/auth');
      }
    }
  }, [status, router, session]);

  // Load existing profile data (works for both buyers and realtors)
  useEffect(() => {
    if (status === 'authenticated') {
      loadProfile();
    }
  }, [status]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/buyer/profile');
      const data = await response.json();

      if (data.profile) {
        // Combine city and state for display (e.g., "Dallas, TX")
        const displayCity = data.profile.state
          ? `${data.profile.city}, ${data.profile.state}`
          : data.profile.city || '';

        setFormData({
          city: displayCity,
          // User type flags
          isRealtor: data.profile.isRealtor || false,
          isInvestor: data.profile.isInvestor || false,
          // Optional property filters
          minBedrooms: data.profile.minBedrooms?.toString() || '',
          maxBedrooms: data.profile.maxBedrooms?.toString() || '',
          minBathrooms: data.profile.minBathrooms?.toString() || '',
          maxBathrooms: data.profile.maxBathrooms?.toString() || '',
          minSquareFeet: data.profile.minSquareFeet?.toString() || '',
          maxSquareFeet: data.profile.maxSquareFeet?.toString() || '',
          minPrice: data.profile.minPrice?.toString() || '',
          maxPrice: data.profile.maxPrice?.toString() || '',
        });
      }
    } catch {
      setError('Failed to load your profile');
    } finally {
      setLoading(false);
    }
  };


  // Reset all passed/skipped properties
  const handleResetPassed = async () => {
    if (!confirm('Are you sure you want to reset all skipped properties? This will show you all properties again.')) {
      return;
    }

    setResettingPassed(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/buyer/pass-property', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset passed properties');
      }

      setSuccess('All skipped properties have been reset. Refresh the dashboard to see all properties.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset passed properties');
    } finally {
      setResettingPassed(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (!formData.city) {
      setError('Please enter a search location');
      setSaving(false);
      return;
    }

    try {
      // Extract city and state from the city string (e.g., "Dallas, TX")
      const cityParts = formData.city.trim().split(',');
      const city = cityParts[0]?.trim() || formData.city.trim();
      const state = cityParts[1]?.trim() || 'TX'; // Default to TX if no state provided

      // Get user's name and phone from session to pass to API
      const userSession = session as unknown as ExtendedSession;
      const nameParts = userSession?.user?.name?.split(' ') || ['', ''];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const phone = userSession?.user?.phone || '';

      const response = await fetch('/api/buyer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName,
          lastName: lastName,
          phone: phone,
          city,
          state,
          // User type flags
          isRealtor: formData.isRealtor,
          isInvestor: formData.isInvestor,
          // Optional property filters (only send if provided)
          ...(formData.minBedrooms && { minBedrooms: Number(formData.minBedrooms) }),
          ...(formData.maxBedrooms && { maxBedrooms: Number(formData.maxBedrooms) }),
          ...(formData.minBathrooms && { minBathrooms: Number(formData.minBathrooms) }),
          ...(formData.maxBathrooms && { maxBathrooms: Number(formData.maxBathrooms) }),
          ...(formData.minSquareFeet && { minSquareFeet: Number(formData.minSquareFeet) }),
          ...(formData.maxSquareFeet && { maxSquareFeet: Number(formData.maxSquareFeet) }),
          ...(formData.minPrice && { minPrice: Number(formData.minPrice) }),
          ...(formData.maxPrice && { maxPrice: Number(formData.maxPrice) }),
        }),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess('Preferences updated successfully!');

        // Redirect back to dashboard immediately
        router.push('/dashboard');
      }
    } catch {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-3xl animate-pulse"></div>
            <div className="absolute inset-2 bg-slate-900 rounded-2xl flex items-center justify-center">
              <span className="text-3xl">⚙️</span>
            </div>
          </div>
          <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300 font-semibold text-lg">Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Modern Floating Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50 shadow-lg shadow-black/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Back Button */}
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-slate-300 hover:text-white transition-all duration-200 group"
            >
              <div className="w-9 h-9 bg-slate-800/50 group-hover:bg-slate-700/50 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </div>
              <span className="text-lg font-bold hidden sm:block">Settings</span>
            </Link>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Realtor Dashboard Button - Only show for realtors */}
              {(session as unknown as ExtendedSession)?.user?.role === 'realtor' && (
                <Link
                  href="/realtor-dashboard"
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg flex items-center gap-1.5 transition-all duration-200 hover:scale-105 group"
                  title="Realtor Dashboard"
                >
                  <span className="text-emerald-400 text-xs font-semibold">Realtor Hub</span>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
              <Link
                href="/dashboard/liked"
                className="w-9 h-9 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
              >
                <span className="text-lg">❤️</span>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signout' })}
                className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 group"
                title="Sign Out"
              >
                <svg className="w-5 h-5 text-red-400 group-hover:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 pb-8">
        {/* Compact Hero Section */}
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-black text-white flex items-center justify-center gap-2">
            <span>🏠</span>
            <span>Your Preferences</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Customize your home search
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Status Messages */}
          {error && (
            <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/50 rounded-2xl p-4 backdrop-blur-xl animate-shake">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-red-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-red-300 font-semibold mb-1">Error</h3>
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/50 rounded-2xl p-4 backdrop-blur-xl animate-slideIn">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-emerald-300 font-semibold mb-1">Success!</h3>
                  <p className="text-emerald-200 text-sm">{success}</p>
                </div>
              </div>
            </div>
          )}

          {/* Location Card */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 border border-slate-700/50 rounded-xl p-4 backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📍</span>
              <h2 className="text-base font-bold text-white">Search Location</h2>
            </div>
            <GooglePlacesAutocomplete
              value={formData.city}
              onChange={(city) => setFormData(prev => ({ ...prev, city }))}
              placeholder="Dallas, TX"
            />
          </div>

          {/* User Type Card */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 border border-slate-700/50 rounded-xl p-4 backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">👤</span>
              <h2 className="text-base font-bold text-white">About You</h2>
            </div>

            <div className="space-y-3">
              {/* Are you a realtor? */}
              <label className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-lg cursor-pointer hover:bg-slate-900/50 transition-all group">
                <input
                  type="checkbox"
                  checked={formData.isRealtor}
                  onChange={(e) => setFormData(prev => ({ ...prev, isRealtor: e.target.checked }))}
                  className="w-5 h-5 text-emerald-500 bg-slate-700 border-slate-600 rounded focus:ring-emerald-400 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                    I am a licensed realtor
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Check this if you have a real estate license</p>
                </div>
              </label>

              {/* Are you an investor? */}
              <label className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-lg cursor-pointer hover:bg-slate-900/50 transition-all group">
                <input
                  type="checkbox"
                  checked={formData.isInvestor}
                  onChange={(e) => setFormData(prev => ({ ...prev, isInvestor: e.target.checked }))}
                  className="w-5 h-5 text-emerald-500 bg-slate-700 border-slate-600 rounded focus:ring-emerald-400 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                    I am a real estate investor
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Looking to buy properties for investment purposes</p>
                </div>
              </label>
            </div>
          </div>

          {/* Property Filters Card */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 border border-slate-700/50 rounded-xl p-4 backdrop-blur-xl shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔍</span>
                <h2 className="text-base font-bold text-white">Property Filters</h2>
              </div>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 font-semibold">
                Optional
              </span>
            </div>

            <div className="space-y-3">
              {/* Bedrooms */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                  <span>🛏️</span>
                  <span>Bedrooms</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={formData.minBedrooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, minBedrooms: e.target.value }))}
                    className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={formData.maxBedrooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxBedrooms: e.target.value }))}
                    className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Bathrooms */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                  <span>🚿</span>
                  <span>Bathrooms</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={formData.minBathrooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, minBathrooms: e.target.value }))}
                    className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={formData.maxBathrooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxBathrooms: e.target.value }))}
                    className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Square Feet */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                  <span>📐</span>
                  <span>Square Feet</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.minSquareFeet ? Number(formData.minSquareFeet).toLocaleString() : ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setFormData(prev => ({ ...prev, minSquareFeet: value }));
                    }}
                    className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
                    placeholder="Min"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.maxSquareFeet ? Number(formData.maxSquareFeet).toLocaleString() : ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setFormData(prev => ({ ...prev, maxSquareFeet: value }));
                    }}
                    className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Asking Price */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                  <span>💵</span>
                  <span>Asking Price</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-900/50 border border-slate-600/50 rounded-lg px-2 py-1 focus-within:border-purple-500/50 transition-all">
                    <div className="flex items-center">
                      <span className="text-xs font-bold text-slate-400 mr-1">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.minPrice ? Number(formData.minPrice).toLocaleString() : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d]/g, '');
                          setFormData(prev => ({ ...prev, minPrice: value }));
                        }}
                        className="flex-1 text-sm text-white bg-transparent border-none outline-none placeholder-slate-500"
                        placeholder="Min"
                      />
                    </div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-600/50 rounded-lg px-2 py-1 focus-within:border-purple-500/50 transition-all">
                    <div className="flex items-center">
                      <span className="text-xs font-bold text-slate-400 mr-1">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.maxPrice ? Number(formData.maxPrice).toLocaleString() : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d]/g, '');
                          setFormData(prev => ({ ...prev, maxPrice: value }));
                        }}
                        className="flex-1 text-sm text-white bg-transparent border-none outline-none placeholder-slate-500"
                        placeholder="Max"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-3 px-4 rounded-xl font-bold text-base transition-all duration-300 hover:scale-[1.01] shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Saving...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Save Preferences</span>
              </span>
            )}
          </button>
        </form>

        {/* Reset Skipped Properties Card - Outside the form */}
        <div className="mt-3 bg-gradient-to-br from-amber-900/20 to-amber-800/10 border border-amber-500/30 rounded-xl p-4 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🔄</span>
            <h2 className="text-base font-bold text-white">Reset Skipped Properties</h2>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            If you&apos;ve skipped too many properties and want to see them again, click the button below.
          </p>
          <button
            type="button"
            onClick={handleResetPassed}
            disabled={resettingPassed}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {resettingPassed ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Resetting...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reset All Skipped Properties</span>
              </span>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
