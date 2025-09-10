'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { GooglePlacesAutocomplete } from '@/components/ui/GooglePlacesAutocomplete';

/**
 * SIMPLIFIED BUYER SETUP
 * 
 * Collects ONLY the 3 essential criteria:
 * 1. City
 * 2. Monthly payment budget
 * 3. Down payment budget
 * 
 * NO complex forms, NO realtor stuff, NO overcomplicated logic.
 */

export default function BuyerSetupV2() {
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
      router.push('/auth/signin');
    } else if (status === 'authenticated' && session?.user?.role !== 'buyer') {
      router.push('/auth/signin');
    }
  }, [status, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simple validation
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
      console.log(`🚀 SETTING UP BUYER: ${formData.city}, $${monthlyBudget}/mo, $${downBudget} down`);

      const response = await fetch('/api/buyer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: formData.city.trim(),
          maxMonthlyPayment: monthlyBudget,
          maxDownPayment: downBudget
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        console.log('✅ BUYER SETUP COMPLETE - redirecting to dashboard');
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Setup failed:', err);
      setError('Failed to save your preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Find Your Perfect Home
            </h1>
            <p className="text-gray-600">
              Tell us what you're looking for and we'll show you all available properties.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              {/* City */}
              <GooglePlacesAutocomplete
                label="What city are you looking in? *"
                value={formData.city}
                onChange={(city) => setFormData(prev => ({ ...prev, city }))}
                placeholder="Type city name..."
              />

              {/* Monthly Payment Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum monthly payment you can afford? *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500">$</span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    value={formData.maxMonthlyPayment}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxMonthlyPayment: e.target.value }))}
                    className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="2000"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">This includes principal, interest, insurance, and taxes</p>
              </div>

              {/* Down Payment Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum down payment you can make? *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500">$</span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    value={formData.maxDownPayment}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxDownPayment: e.target.value }))}
                    className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="50000"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">The upfront payment you can afford to make</p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Setting up...
                  </span>
                ) : (
                  'Show Me Properties'
                )}
              </button>
            </form>
          </div>

          <div className="text-center mt-6">
            <p className="text-xs text-gray-500">
              We'll show you every property that matches your criteria - no complex algorithms, just simple matching.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}