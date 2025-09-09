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

  const handleInputChange = (field: string, value: any) => {
    if (field === 'phone') {
      const formatted = formatPhoneNumber(value);
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
        
        // Don't redirect - let them stay and make more changes
      }
    } catch (err) {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Update Search Preferences  
          </h1>
          <p className="text-gray-600">
            Change your city or budget to see different properties.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Back Link */}
            <div className="text-center">
              <Link 
                href="/dashboard"
                className="text-blue-600 hover:text-blue-500 font-medium text-sm"
              >
                ← Back to Properties
              </Link>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 text-sm">{success}</p>
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
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </span>
              ) : (
                'Update Preferences'
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Changes will show new properties that match your updated criteria.
          </p>
        </div>
      </div>
    </div>
  );
}