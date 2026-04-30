'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExtendedSession } from '@/types/session';
import { GooglePlacesAutocomplete } from '@/components/ui/GooglePlacesAutocomplete';
import { trackEvent, useFormTracking } from '@/components/analytics/AnalyticsProvider';

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
    // Investor preferences
    dealTypePreference: 'all' as 'all' | 'owner_finance' | 'cash_deal',
    arvThreshold: '85',
    searchRadius: '30',
    // Optional property filters
    minBedrooms: '',
    maxBedrooms: '',
    minBathrooms: '',
    maxBathrooms: '',
    minSquareFeet: '',
    maxSquareFeet: '',
    minPrice: '',
    maxPrice: '',
    minYearBuilt: '',
    maxYearBuilt: '',
    // Communication preferences — granular SMS toggle separate from STOP
    // (STOP via Twilio fully revokes TCPA consent; this toggle just pauses
    // marketing/deal-alert SMS while keeping the account and consent intact).
    smsNotifications: true,
  });

  // Form tracking
  const { trackFormStart, trackFormSubmit, trackFormSuccess, trackFormError } = useFormTracking('buyer_settings');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth');
    }

    // Allow buyers, realtors, and admins
    if (status === 'authenticated') {
      const userRole = (session as unknown as ExtendedSession)?.user?.role;
      if (userRole !== 'buyer' && userRole !== 'realtor' && userRole !== 'admin') {
        router.replace('/auth');
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
          // Investor preferences
          dealTypePreference: data.profile.dealTypePreference || 'all',
          arvThreshold: data.profile.arvThreshold?.toString() || '85',
          searchRadius: data.profile.searchRadius?.toString() || data.profile.filter?.radiusMiles?.toString() || '30',
          // Optional property filters
          minBedrooms: data.profile.minBedrooms?.toString() || '',
          maxBedrooms: data.profile.maxBedrooms?.toString() || '',
          minBathrooms: data.profile.minBathrooms?.toString() || '',
          maxBathrooms: data.profile.maxBathrooms?.toString() || '',
          minSquareFeet: data.profile.minSquareFeet?.toString() || '',
          maxSquareFeet: data.profile.maxSquareFeet?.toString() || '',
          minPrice: data.profile.minPrice?.toString() || '',
          maxPrice: data.profile.maxPrice?.toString() || '',
          minYearBuilt: data.profile.minYearBuilt?.toString() || '',
          maxYearBuilt: data.profile.maxYearBuilt?.toString() || '',
          // Default true; respect explicit false if user has already opted out.
          smsNotifications: data.profile.smsNotifications !== false,
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
    trackFormSubmit();

    if (!formData.city) {
      setError('Please enter a search location');
      trackFormError('missing_location');
      setSaving(false);
      return;
    }

    try {
      // Extract city and state from the city string (e.g., "Dallas, TX")
      const cityParts = formData.city.trim().split(',');
      const city = cityParts[0]?.trim() || formData.city.trim();
      const state = cityParts[1]?.trim();
      if (!state) {
        setError('Please include the state (e.g. "Dallas, TX")');
        trackFormError('missing_state');
        setSaving(false);
        return;
      }

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
          // Investor preferences
          ...(formData.isInvestor && { dealTypePreference: formData.dealTypePreference }),
          ...(formData.isInvestor && { arvThreshold: Number(formData.arvThreshold) }),
          ...(formData.isInvestor && { searchRadius: Number(formData.searchRadius) }),
          // Optional property filters (only send if provided)
          ...(formData.minBedrooms && { minBedrooms: Number(formData.minBedrooms) }),
          ...(formData.maxBedrooms && { maxBedrooms: Number(formData.maxBedrooms) }),
          ...(formData.minBathrooms && { minBathrooms: Number(formData.minBathrooms) }),
          ...(formData.maxBathrooms && { maxBathrooms: Number(formData.maxBathrooms) }),
          ...(formData.minSquareFeet && { minSquareFeet: Number(formData.minSquareFeet) }),
          ...(formData.maxSquareFeet && { maxSquareFeet: Number(formData.maxSquareFeet) }),
          ...(formData.minPrice && { minPrice: Number(formData.minPrice) }),
          ...(formData.maxPrice && { maxPrice: Number(formData.maxPrice) }),
          ...(formData.minYearBuilt && { minYearBuilt: Number(formData.minYearBuilt) }),
          ...(formData.maxYearBuilt && { maxYearBuilt: Number(formData.maxYearBuilt) }),
          // Communication preferences — write explicitly so toggling back to
          // true is persisted (not just captured on initial signup).
          smsNotifications: formData.smsNotifications,
        }),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
        trackFormError(data.error);
      } else {
        trackFormSuccess({ city: formData.city });
        setSuccess('Preferences updated successfully!');

        // Always redirect to regular dashboard - it handles investor mode internally
        router.push('/dashboard');
      }
    } catch {
      setError('Failed to save preferences');
      trackFormError('save_failed');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00BC7D] to-blue-500 rounded-3xl animate-pulse"></div>
            <div className="absolute inset-2 bg-[#111625] rounded-2xl flex items-center justify-center">
              <span className="text-3xl">⚙️</span>
            </div>
          </div>
          <div className="w-16 h-16 border-4 border-slate-700 border-t-[#00BC7D] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300 font-semibold text-lg">Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 pb-20 md:pb-8">
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
            <div className="bg-gradient-to-r from-[#00BC7D]/10 to-[#00BC7D]/10 border border-[#00BC7D]/50 rounded-2xl p-4 backdrop-blur-xl animate-slideIn">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#00BC7D]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[#00BC7D]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-[#00d68f] font-semibold mb-1">Success!</h3>
                  <p className="text-[#66E0B8] text-sm">{success}</p>
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

          {/* Communication Preferences Card */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 border border-slate-700/50 rounded-xl p-4 backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💬</span>
              <h2 className="text-base font-bold text-white">Communication Preferences</h2>
            </div>

            <label className="flex items-center gap-3 p-3 bg-[#111625]/30 rounded-lg cursor-pointer hover:bg-[#111625]/50 transition-all group">
              <input
                type="checkbox"
                checked={formData.smsNotifications}
                onChange={(e) => setFormData(prev => ({ ...prev, smsNotifications: e.target.checked }))}
                className="w-5 h-5 text-[#00BC7D] bg-slate-700 border-slate-600 rounded focus:ring-[#00BC7D] cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-sm font-semibold text-white group-hover:text-[#00BC7D] transition-colors">
                  Marketing and deal-alert SMS
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  When off, we&apos;ll stop sending you property-match and deal-alert SMS. Transactional texts (like OTP codes) still go through.
                </p>
              </div>
            </label>
            <p className="text-[11px] text-slate-500 mt-2 px-1">
              To fully revoke consent and stop all messaging, reply <strong>STOP</strong> to any text or use <Link href="/do-not-sell" className="text-[#00BC7D] hover:underline">the Do Not Sell/Share form</Link>.
            </p>
          </div>

          {/* User Type Card */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 border border-slate-700/50 rounded-xl p-4 backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">👤</span>
              <h2 className="text-base font-bold text-white">About You</h2>
            </div>

            <div className="space-y-3">
              {/* Are you a realtor? */}
              <label className="flex items-center gap-3 p-3 bg-[#111625]/30 rounded-lg cursor-pointer hover:bg-[#111625]/50 transition-all group">
                <input
                  type="checkbox"
                  checked={formData.isRealtor}
                  onChange={(e) => setFormData(prev => ({ ...prev, isRealtor: e.target.checked }))}
                  onFocus={trackFormStart}
                  className="w-5 h-5 text-[#00BC7D] bg-slate-700 border-slate-600 rounded focus:ring-[#00BC7D] cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-white group-hover:text-[#00BC7D] transition-colors">
                    I am a licensed realtor
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Check this if you have a real estate license</p>
                </div>
              </label>

              {/* Are you an investor? */}
              <label className="flex items-center gap-3 p-3 bg-[#111625]/30 rounded-lg cursor-pointer hover:bg-[#111625]/50 transition-all group">
                <input
                  type="checkbox"
                  checked={formData.isInvestor}
                  onChange={(e) => setFormData(prev => ({ ...prev, isInvestor: e.target.checked }))}
                  className="w-5 h-5 text-[#00BC7D] bg-slate-700 border-slate-600 rounded focus:ring-[#00BC7D] cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-white group-hover:text-[#00BC7D] transition-colors">
                    I am a real estate investor
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Looking to buy properties for investment purposes</p>
                </div>
              </label>

              {/* Deal Type Preference - shown only for investors */}
              {formData.isInvestor && (
                <div className="ml-8 p-3 bg-[#004D33]/20 border border-[#00BC7D]/30 rounded-lg">
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Default Deal View
                  </label>
                  <p className="text-[10px] text-slate-400 mb-2.5">
                    Choose which deals to show first on your investor dashboard
                  </p>
                  <div className="flex gap-2">
                    {([
                      { value: 'all', label: 'All Deals' },
                      { value: 'owner_finance', label: 'Owner Finance' },
                      { value: 'cash_deal', label: 'Cash Deals' },
                    ] as const).map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, dealTypePreference: option.value }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          formData.dealTypePreference === option.value
                            ? 'bg-[#00BC7D] text-white shadow-lg shadow-[#00BC7D]/25'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ARV Threshold for Deal Alerts - shown only for investors */}
              {formData.isInvestor && (
                <div className="ml-8 mt-3 p-3 bg-[#004D33]/20 border border-[#00BC7D]/30 rounded-lg">
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Deal Alert ARV Threshold
                  </label>
                  <p className="text-[10px] text-slate-400 mb-2">
                    Get SMS alerts for deals priced below this % of estimated value
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="60"
                      max="90"
                      step="5"
                      value={formData.arvThreshold}
                      onChange={(e) => setFormData(prev => ({ ...prev, arvThreshold: e.target.value }))}
                      className="flex-1 accent-[#00BC7D] h-2 bg-slate-700 rounded-lg cursor-pointer"
                    />
                    <span className="text-[#00BC7D] font-bold text-sm w-12 text-right">
                      {formData.arvThreshold}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
                    <span>60% (Deep discount)</span>
                    <span>90% (More deals)</span>
                  </div>
                </div>
              )}

              {/* Search Radius - shown only for investors */}
              {formData.isInvestor && (
                <div className="ml-8 mt-3 p-3 bg-[#004D33]/20 border border-[#00BC7D]/30 rounded-lg">
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Search Radius
                  </label>
                  <p className="text-[10px] text-slate-400 mb-2">
                    How far from your city to search for deals
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={formData.searchRadius}
                      onChange={(e) => setFormData(prev => ({ ...prev, searchRadius: e.target.value }))}
                      className="flex-1 accent-[#00BC7D] h-2 bg-slate-700 rounded-lg cursor-pointer"
                    />
                    <span className="text-[#00BC7D] font-bold text-sm w-16 text-right">
                      {formData.searchRadius} mi
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
                    <span>10 mi (Nearby)</span>
                    <span>100 mi (Wide area)</span>
                  </div>
                </div>
              )}
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
                    className="w-full bg-[#111625]/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={formData.maxBedrooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxBedrooms: e.target.value }))}
                    className="w-full bg-[#111625]/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
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
                    className="w-full bg-[#111625]/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={formData.maxBathrooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxBathrooms: e.target.value }))}
                    className="w-full bg-[#111625]/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
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
                    className="w-full bg-[#111625]/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
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
                    className="w-full bg-[#111625]/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
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
                  <div className="bg-[#111625]/50 border border-slate-600/50 rounded-lg px-2 py-1 focus-within:border-purple-500/50 transition-all">
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
                  <div className="bg-[#111625]/50 border border-slate-600/50 rounded-lg px-2 py-1 focus-within:border-purple-500/50 transition-all">
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

              {/* Year Built - Only show for investors */}
              {formData.isInvestor && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                    <span>🏗️</span>
                    <span>Year Built</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="1800"
                      max={new Date().getFullYear()}
                      value={formData.minYearBuilt}
                      onChange={(e) => setFormData(prev => ({ ...prev, minYearBuilt: e.target.value }))}
                      className="w-full bg-[#111625]/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
                      placeholder="Min (1950)"
                    />
                    <input
                      type="number"
                      min="1800"
                      max={new Date().getFullYear()}
                      value={formData.maxYearBuilt}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxYearBuilt: e.target.value }))}
                      className="w-full bg-[#111625]/50 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none transition-all"
                      placeholder={`Max (${new Date().getFullYear()})`}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-[#00BC7D]/50 to-[#00BC7D] hover:from-[#00BC7D] hover:to-[#00BC7D]/50 text-white py-3 px-4 rounded-xl font-bold text-base transition-all duration-300 hover:scale-[1.01] shadow-lg shadow-[#00BC7D]/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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

        {/* Privacy rights — data export + account deletion (CCPA/GDPR) */}
        <div className="mt-3 bg-gradient-to-br from-slate-800/50 to-slate-800/30 border border-slate-700/50 rounded-xl p-4 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🔒</span>
            <h2 className="text-base font-bold text-white">Your Privacy Rights</h2>
          </div>

          <button
            type="button"
            onClick={() => { window.location.href = '/api/account/export'; }}
            className="w-full mb-2 bg-slate-700 hover:bg-slate-600 text-white py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors"
          >
            Download a copy of my data
          </button>

          <button
            type="button"
            onClick={async () => {
              const confirm = window.prompt(
                'This will delete your account and stop all messaging. Type DELETE to confirm.',
              );
              if (confirm !== 'DELETE') return;
              const res = await fetch('/api/account/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm }),
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok) {
                window.alert(data.message || 'Account deleted.');
                signOut({ callbackUrl: '/' });
              } else {
                window.alert(data.error || 'Failed to delete account.');
              }
            }}
            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors"
          >
            Delete my account
          </button>
          <p className="text-[11px] text-slate-500 mt-2 px-1">
            Deletion stops all messaging and scrubs your contact information. Audit records required for legal compliance (TCPA, 4-year retention) are retained.
          </p>
        </div>

        {/* Sign Out - visible on mobile since header logout is hidden */}
        <div className="mt-3 md:hidden">
          <button
            type="button"
            onClick={() => {
              trackEvent('auth_logout', { method: 'settings_page' });
              signOut({ callbackUrl: '/auth/signout' });
            }}
            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 py-3 px-4 rounded-xl font-semibold text-sm transition-all"
          >
            Sign Out
          </button>
        </div>
      </main>
    </div>
  );
}
