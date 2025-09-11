'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
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
    } else if (status === 'authenticated' && (session?.user as any)?.role !== 'buyer') {
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
      const cityParts = formData.city.split(',');
      const city = cityParts[0]?.trim() || formData.city;
      const state = cityParts[1]?.trim() || 'TX';

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
    } catch (err) {
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
      <div className="flex flex-col justify-center min-h-[calc(100vh-80px)] px-4">
        <div className="max-w-md mx-auto w-full">
          
          <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-xl p-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">Set Your Preferences</h1>
              <p className="text-slate-300 text-sm">Tell us what you're looking for</p>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Search Location</label>
                <GooglePlacesAutocomplete
                  value={formData.city}
                  onChange={(city) => setFormData(prev => ({ ...prev, city }))}
                  placeholder="Dallas, TX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Maximum Monthly Payment
                </label>
                <input
                  type="number"
                  value={formData.maxMonthlyPayment}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxMonthlyPayment: e.target.value }))}
                  className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400"
                  placeholder="2000"
                  min="1"
                  required
                />
                <p className="text-slate-400 text-xs mt-1">
                  This includes principal, interest, insurance, and taxes
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Maximum Down Payment
                </label>
                <input
                  type="number"
                  value={formData.maxDownPayment}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxDownPayment: e.target.value }))}
                  className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400"
                  placeholder="50000"
                  min="1"
                  required
                />
                <p className="text-slate-400 text-xs mt-1">
                  The upfront payment you can afford to make
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 mt-6"
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