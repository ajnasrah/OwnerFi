'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
    if (status === 'authenticated' && session?.user?.role !== 'buyer') {
      if (session?.user?.role === 'realtor') {
        router.push('/realtor/dashboard');
      } else {
        router.push('/auth/signin');
      }
    }
  }, [status, router, session]);

  // Load existing buyer profile data
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'buyer') {
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
    } catch (err) {
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

  const handleInputChange = (field: string, value: string | number) => {
    if (field === 'phone') {
      const formatted = formatPhoneNumber(String(value));
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    setError('');
    setSuccess('');
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
    } catch (err) {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header with Navigation */}
      <header className="relative z-20 bg-white/80 backdrop-blur-lg border-b border-white/20 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Settings</h1>
            <p className="text-xs text-gray-500 mt-1">Update your search preferences</p>
          </div>
          
          <div className="flex space-x-6">
            <Link href="/dashboard" className="flex flex-col items-center">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-lg">🏠</span>
              </div>
              <span className="text-xs font-medium text-gray-500 mt-1">Browse</span>
            </Link>
            
            <Link href="/dashboard/liked" className="flex flex-col items-center">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-lg">♥</span>
              </div>
              <span className="text-xs font-medium text-gray-500 mt-1">Saved</span>
            </Link>
            
            <Link href="/dashboard/settings" className="flex flex-col items-center">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">⚙</span>
              </div>
              <span className="text-xs font-medium text-blue-600 mt-1">Settings</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 pt-12 pb-12">
        <div className="max-w-md mx-auto">
          
          {/* Settings Card */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden p-8">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Update Search Preferences  
              </h2>
              <p className="text-gray-600 text-sm">
                Change your city or budget to see different properties.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-green-600 text-sm">{success}</p>
                </div>
              )}

              {/* City */}
              <div>
                <GooglePlacesAutocomplete
                  label="What city are you looking in? *"
                  value={formData.city}
                  onChange={(city) => setFormData(prev => ({ ...prev, city }))}
                  placeholder="Type city name..."
                />
              </div>

              {/* Monthly Payment Budget */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Monthly Budget *
                </label>
                <div className="bg-gray-50 rounded-2xl p-4 focus-within:bg-white focus-within:shadow-lg transition-all">
                  <div className="flex items-center">
                    <span className="text-2xl font-bold text-gray-600 mr-2">$</span>
                    <input
                      type="text"
                      required
                      value={formData.maxMonthlyPayment ? Number(formData.maxMonthlyPayment).toLocaleString() : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, '');
                        setFormData(prev => ({ ...prev, maxMonthlyPayment: value }));
                      }}
                      className="flex-1 text-2xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder-gray-400"
                      placeholder="1,500"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Monthly payment you can afford</p>
                </div>
              </div>

              {/* Down Payment Budget */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Down Payment *
                </label>
                <div className="bg-gray-50 rounded-2xl p-4 focus-within:bg-white focus-within:shadow-lg transition-all">
                  <div className="flex items-center">
                    <span className="text-2xl font-bold text-gray-600 mr-2">$</span>
                    <input
                      type="text"
                      required
                      value={formData.maxDownPayment ? Number(formData.maxDownPayment).toLocaleString() : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, '');
                        setFormData(prev => ({ ...prev, maxDownPayment: value }));
                      }}
                      className="flex-1 text-2xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder-gray-400"
                      placeholder="30,000"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Upfront payment you can make</p>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white py-4 px-4 rounded-2xl hover:bg-blue-700 transition-colors font-semibold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transform active:scale-95"
              >
                {saving ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Updating...
                  </span>
                ) : (
                  'Update Preferences'
                )}
              </button>

              {/* Back Link */}
              <div className="text-center pt-6">
                <Link 
                  href="/dashboard"
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  ← Back to Properties
                </Link>
              </div>
            </form>
          </div>

          <div className="text-center mt-8">
            <p className="text-xs text-gray-500">
              Changes will show new properties that match your updated criteria.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}