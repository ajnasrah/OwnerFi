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

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signup');
    } else if (status === 'authenticated' && (session as ExtendedSession)?.user?.role !== 'buyer') {
      router.push('/realtor-signup');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
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

      
      const response = await fetch('/api/buyer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        router.push('/dashboard');
      }
    } catch {
      setError('Failed to save your preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900" style={{zoom: '0.8'}}>
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 p-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <span className="text-lg font-bold text-white">OwnerFi</span>
          </Link>
          <span className="text-slate-400 text-sm">Setup</span>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ paddingTop: '2rem', paddingBottom: '2rem' }} className="px-6">
        <div className="max-w-md mx-auto w-full">
          <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-3">Set Your Preferences</h1>
              <p className="text-lg text-white font-normal mb-4">Tell us what you&apos;re looking for</p>
            </div>

            {error && (
              <div className="p-4 mb-6 bg-red-600/20 backdrop-blur-lg border border-red-500/30 rounded-xl text-red-300 font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-3" style={{color: 'white'}}>Search Location</label>
                <GooglePlacesAutocomplete
                  value={formData.city}
                  onChange={(city) => setFormData(prev => ({ ...prev, city }))}
                  placeholder="Dallas, TX"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3" style={{color: 'white'}}>
                  Maximum Monthly Payment
                </label>
                <input
                  type="number"
                  value={formData.maxMonthlyPayment}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxMonthlyPayment: e.target.value }))}
                  className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
                  placeholder="2000"
                  min="1"
                  required
                />
                <p className="text-slate-400 text-sm mt-2">
                  This includes principal, interest, insurance, and taxes
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3" style={{color: 'white'}}>
                  Maximum Down Payment
                </label>
                <input
                  type="number"
                  value={formData.maxDownPayment}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxDownPayment: e.target.value }))}
                  className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
                  placeholder="50000"
                  min="1"
                  required
                />
                <p className="text-slate-400 text-sm mt-2">
                  The upfront payment you can afford to make
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 shadow-2xl shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed mt-8"
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