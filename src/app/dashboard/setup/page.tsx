'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ExtendedSession } from '@/types/session';
import { useRouter } from 'next/navigation';
import { GooglePlacesAutocomplete } from '@/components/ui/GooglePlacesAutocomplete';
import Link from 'next/link';

export default function BuyerSetup() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    city: '',
    maxMonthlyPayment: '',
    maxDownPayment: ''
  });

  // Auth check - allow all authenticated users
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    }
    // Both buyers and realtors can set up buyer preferences
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="h-screen overflow-hidden flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.city || !formData.maxMonthlyPayment || !formData.maxDownPayment) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    const monthlyBudget = Number(formData.maxMonthlyPayment);
    const downBudget = Number(formData.maxDownPayment);

    if (monthlyBudget <= 0 || downBudget <= 0) {
      setError('Budget amounts must be greater than zero');
      setLoading(false);
      return;
    }

    try {
      // Parse city and state from the city field
      const cityParts = formData.city.split(',');
      const city = cityParts[0]?.trim() || formData.city;
      const state = cityParts[1]?.trim() || 'TX'; // Default to TX

      
      // Get user's name and phone from session
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
          city: city,
          state: state,
          maxMonthlyPayment: monthlyBudget,
          maxDownPayment: downBudget
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        // Mark this as a new user who should see the tutorial
        localStorage.setItem('isNewBuyerAccount', 'true');
        router.push('/dashboard');
      }
    } catch {
      setError('Failed to save your preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-900 overflow-y-auto flex flex-col">
      <style jsx global>{`
        .pac-container {
          z-index: 1051 !important;
          transform: scale(1) !important;
          transform-origin: top left !important;
        }
      `}</style>
      {/* Compact Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-3 py-2 sm:px-4 sm:py-3 flex-shrink-0">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs sm:text-sm">O</span>
            </div>
            <span className="text-sm sm:text-lg font-bold text-white">OwnerFi</span>
          </Link>
          <span className="text-slate-400 text-xs sm:text-sm">Setup</span>
        </div>
      </header>

      {/* Main Content - Flexible */}
      <div className="flex-1 flex items-center justify-center px-4 py-3 sm:px-6 sm:py-4">
        <div className="max-w-sm">
          <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-xl p-4 sm:p-6 shadow-2xl">
            <div className="text-center mb-4 sm:mb-6">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">Set Your Preferences</h1>
              <p className="text-sm sm:text-base text-white font-normal">Tell us what you&apos;re looking for</p>
            </div>

            {error && (
              <div className="p-3 mb-4 bg-red-600/20 backdrop-blur-lg border border-red-500/30 rounded-lg text-red-300 font-semibold text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-xs sm:text-sm font-semibold mb-2 text-white">Search Location</label>
                <GooglePlacesAutocomplete
                  value={formData.city}
                  onChange={(city) => setFormData(prev => ({ ...prev, city }))}
                  placeholder="Dallas, TX"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold mb-2 text-white">
                  Maximum Monthly Payment
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.maxMonthlyPayment ? Number(formData.maxMonthlyPayment).toLocaleString() : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d]/g, '');
                    setFormData(prev => ({ ...prev, maxMonthlyPayment: value }));
                  }}
                  className="w-full p-3 sm:p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm sm:text-base"
                  placeholder="2,000"
                  required
                />
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  This includes principal, interest, insurance, and taxes
                </p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold mb-2 text-white">
                  Maximum Down Payment
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.maxDownPayment ? Number(formData.maxDownPayment).toLocaleString() : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d]/g, '');
                    setFormData(prev => ({ ...prev, maxDownPayment: value }));
                  }}
                  className="w-full p-3 sm:p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal text-sm sm:text-base"
                  placeholder="50,000"
                  required
                />
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  The upfront payment you can afford to make
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-3 px-4 sm:py-4 sm:px-6 rounded-lg font-semibold text-sm sm:text-base md:text-lg transition-all duration-300 hover:scale-105 shadow-2xl shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed mt-6 sm:mt-8"
              >
                {loading ? 'Setting up...' : 'Show Me Properties'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}