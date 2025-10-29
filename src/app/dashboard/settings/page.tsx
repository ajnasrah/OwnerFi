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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // SIMPLIFIED FORM DATA - Search preferences only
  const [formData, setFormData] = useState({
    city: '',
    maxMonthlyPayment: '',
    maxDownPayment: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
    
    // Strict role checking - buyers only
    if (status === 'authenticated' && (session as unknown as ExtendedSession)?.user?.role !== 'buyer') {
      if ((session as unknown as ExtendedSession)?.user?.role === 'realtor') {
        router.push('/realtor/dashboard');
      } else {
        router.push('/auth/signin');
      }
    }
  }, [status, router, session]);

  // Load existing buyer profile data
  useEffect(() => {
    if (status === 'authenticated' && (session as unknown as ExtendedSession)?.user?.role === 'buyer') {
      loadProfile();
    }
  }, [status, session]);

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
          maxMonthlyPayment: data.profile.maxMonthlyPayment?.toString() || '',
          maxDownPayment: data.profile.maxDownPayment?.toString() || '',
        });
      }
    } catch {
      setError('Failed to load your profile');
    } finally {
      setLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (!formData.city || !formData.maxMonthlyPayment || !formData.maxDownPayment) {
      setError('Please fill in all required fields');
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
          maxMonthlyPayment: Number(formData.maxMonthlyPayment),
          maxDownPayment: Number(formData.maxDownPayment)
        }),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess('Preferences updated successfully!');
        
        // Redirect back to dashboard
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } catch {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Minimal Header */}
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="px-3 py-2 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-bold">Settings</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/dashboard/liked" className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors">
              <span className="text-sm">❤️</span>
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-8 h-8 bg-slate-800 hover:bg-red-900/30 rounded-lg flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Compact Mobile Layout */}
      <main className="px-3 py-4 pb-20">
        <div className="max-w-md mx-auto space-y-4">

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Status Messages */}
            {error && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-300 text-sm font-medium">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3">
                <p className="text-green-300 text-sm font-medium">{success}</p>
              </div>
            )}

            {/* City Selection */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <label className="block text-sm font-bold text-white mb-2">
                Search Location
              </label>
              <GooglePlacesAutocomplete
                value={formData.city}
                onChange={(city) => setFormData(prev => ({ ...prev, city }))}
                placeholder="Dallas, TX"
              />
              <p className="text-xs text-slate-400 mt-2">
                City where you want to find properties
              </p>
            </div>

            {/* Budget Settings */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-bold text-white">Budget Limits</h3>

              {/* Monthly Payment */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Max Monthly Payment
                </label>
                <div className="bg-slate-900/50 border border-emerald-500/30 rounded-lg p-3">
                  <div className="flex items-center">
                    <span className="text-lg font-bold text-emerald-400 mr-1">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formData.maxMonthlyPayment ? Number(formData.maxMonthlyPayment).toLocaleString() : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, '');
                        setFormData(prev => ({ ...prev, maxMonthlyPayment: value }));
                      }}
                      className="flex-1 text-lg font-bold text-white bg-transparent border-none outline-none placeholder-slate-500"
                      placeholder="1,500"
                    />
                  </div>
                </div>
              </div>

              {/* Down Payment */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Max Down Payment
                </label>
                <div className="bg-slate-900/50 border border-emerald-500/30 rounded-lg p-3">
                  <div className="flex items-center">
                    <span className="text-lg font-bold text-emerald-400 mr-1">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formData.maxDownPayment ? Number(formData.maxDownPayment).toLocaleString() : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, '');
                        setFormData(prev => ({ ...prev, maxDownPayment: value }));
                      }}
                      className="flex-1 text-lg font-bold text-white bg-transparent border-none outline-none placeholder-slate-500"
                      placeholder="30,000"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-3 px-4 rounded-lg font-bold text-sm transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Updating...
                </span>
              ) : (
                'Save Preferences'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}