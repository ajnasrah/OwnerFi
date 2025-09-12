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

  // SIMPLIFIED FORM DATA
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
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
          firstName: data.profile.firstName || '',
          lastName: data.profile.lastName || '',
          phone: data.profile.phone || '',
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

  const formatPhoneNumber = (value: string) => {
    const phoneNumber = value.replace(/\D/g, '');
    if (phoneNumber.length >= 6) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    } else if (phoneNumber.length >= 3) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    } else {
      return phoneNumber;
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

      const response = await fetch('/api/buyer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      {/* Header with Navigation */}
      <header className="relative z-20 bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white">SETTINGS</h1>
            <p className="text-sm text-slate-400 mt-1 font-semibold">UPDATE YOUR SEARCH PREFERENCES</p>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex space-x-4">
              <Link href="/dashboard" className="flex flex-col items-center group">
                <div className="w-12 h-12 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl flex items-center justify-center transition-colors group-hover:scale-110">
                  <span className="text-slate-300 text-xl">🏠</span>
                </div>
                <span className="text-xs font-bold text-slate-400 mt-1">BROWSE</span>
              </Link>
              
              <Link href="/dashboard/liked" className="flex flex-col items-center group">
                <div className="w-12 h-12 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl flex items-center justify-center transition-colors group-hover:scale-110">
                  <span className="text-slate-300 text-xl">♥</span>
                </div>
                <span className="text-xs font-bold text-slate-400 mt-1">SAVED</span>
              </Link>
              
              <Link href="/dashboard/settings" className="flex flex-col items-center group">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <span className="text-white text-xl">⚙</span>
                </div>
                <span className="text-xs font-bold text-emerald-400 mt-1">SETTINGS</span>
              </Link>
            </div>
            
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex flex-col items-center group"
            >
              <div className="w-12 h-12 bg-slate-700/50 hover:bg-red-600/30 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 duration-300">
                <span className="text-slate-300 group-hover:text-red-400 text-xl transition-colors">⏻</span>
              </div>
              <span className="text-xs font-bold text-slate-400 group-hover:text-red-400 mt-1 transition-colors">LOGOUT</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - COMPLETELY REDESIGNED */}
      <main className="px-4 pt-8 pb-8">
        <div className="max-w-lg mx-auto">
          
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Status Messages */}
            {error && (
              <div className="bg-red-600/20 backdrop-blur-lg border border-red-500/30 rounded-xl p-4">
                <p className="text-red-300 font-semibold">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-600/20 backdrop-blur-lg border border-green-500/30 rounded-xl p-4">
                <p className="text-green-300 font-semibold">{success}</p>
              </div>
            )}

            {/* City Selection */}
            <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6">
              <label className="block text-lg font-bold text-white mb-4">
                SEARCH LOCATION
              </label>
              <GooglePlacesAutocomplete
                value={formData.city}
                onChange={(city) => setFormData(prev => ({ ...prev, city }))}
                placeholder="Dallas, TX"
              />
              <p className="text-sm text-slate-400 mt-3 font-medium">
                Enter the city where you want to find properties
              </p>
            </div>

            {/* Budget Settings */}
            <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 space-y-6">
              <h3 className="text-lg font-bold text-white">BUDGET LIMITS</h3>
              
              {/* Monthly Payment */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  Maximum Monthly Payment
                </label>
                <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-4">
                  <div className="flex items-center">
                    <span className="text-2xl font-bold text-emerald-400 mr-2">$</span>
                    <input
                      type="text"
                      required
                      value={formData.maxMonthlyPayment ? Number(formData.maxMonthlyPayment).toLocaleString() : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, '');
                        setFormData(prev => ({ ...prev, maxMonthlyPayment: value }));
                      }}
                      className="flex-1 text-2xl font-bold text-white bg-transparent border-none outline-none placeholder-slate-400"
                      placeholder="1,500"
                    />
                  </div>
                </div>
              </div>

              {/* Down Payment */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  Maximum Down Payment
                </label>
                <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-4">
                  <div className="flex items-center">
                    <span className="text-2xl font-bold text-emerald-400 mr-2">$</span>
                    <input
                      type="text"
                      required
                      value={formData.maxDownPayment ? Number(formData.maxDownPayment).toLocaleString() : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, '');
                        setFormData(prev => ({ ...prev, maxDownPayment: value }));
                      }}
                      className="flex-1 text-2xl font-bold text-white bg-transparent border-none outline-none placeholder-slate-400"
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
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-105 shadow-2xl shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  UPDATING PREFERENCES...
                </span>
              ) : (
                'UPDATE SEARCH PREFERENCES'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}