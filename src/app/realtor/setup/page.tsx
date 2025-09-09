'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface City {
  name: string;
  state: string;
  selected?: boolean;
}

// All 50 US States
const ALL_US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' }
];

export default function RealtorSetup() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form data - pre-populate from existing user data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    company: '',
    licenseNumber: '',
    licenseState: '',
    primaryCity: '',
    primaryState: '',
    serviceRadius: 25,
    serviceCities: [] as string[],
  });

  // City search functionality
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [citySelected, setCitySelected] = useState(false);
  const [nearbyCities, setNearbyCities] = useState<City[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/realtor/signin');
    }
    
    if (status === 'authenticated' && session?.user?.role !== 'realtor') {
      router.push('/dashboard');
    }

    if (status === 'authenticated' && session?.user?.role === 'realtor') {
      loadExistingUserData();
    }
  }, [status, router, session]);

  const loadExistingUserData = async () => {
    try {
      // Pre-fill form with existing data from database
      if (session?.user?.id) {
        try {
          // Get user data directly from database using user ID
          const userDoc = await fetch(`/api/users/${session.user.id}`);
          if (userDoc.ok) {
            const userData = await userDoc.json();
            
            if (userData.user) {
              const name = userData.user.name || '';
              const nameParts = name.split(' ');
              
              setFormData(prev => ({
                ...prev,
                firstName: nameParts[0] || '',
                lastName: nameParts.slice(1).join(' ') || '',
                phone: userData.user.phone || '',
                company: userData.user.company || '',
                licenseState: userData.user.licenseState || '',
              }));
              
              console.log('📋 Pre-filled realtor data from database:', {
                phone: userData.user.phone,
                company: userData.user.company,
                licenseState: userData.user.licenseState
              });
            }
          }
        } catch (error) {
          console.warn('Could not fetch user data, using session fallback');
          
          // Fallback to session data
          const name = session.user.name || '';
          const nameParts = name.split(' ');
          
          setFormData(prev => ({
            ...prev,
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            // These might be empty from session
            phone: '',
            company: '',
            licenseState: '',
          }));
        }
      }

      // Check if realtor profile already exists
      const profileResponse = await fetch('/api/realtor/profile');
      const profileData = await profileResponse.json();
      
      if (profileData.profile) {
        // Profile exists, redirect to dashboard
        router.push('/realtor/dashboard');
      }
      
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // City search with timeout
  useEffect(() => {
    if (cityQuery.length >= 3 && !cityQuery.includes(', ')) {
      const timer = setTimeout(() => {
        searchCities(cityQuery);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setCityResults([]);
      setShowDropdown(false);
    }
  }, [cityQuery]);

  const searchCities = async (query: string) => {
    try {
      const response = await fetch(`/api/cities/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      setCityResults(data.cities || []);
      setShowDropdown(true);
    } catch (err) {
      console.error('Search failed:', err);
      setCityResults([]);
      setShowDropdown(false);
    }
  };

  const selectCity = async (city: City) => {
    setFormData(prev => ({
      ...prev,
      primaryCity: city.name,
      primaryState: city.state
    }));
    setCityQuery(`${city.name}, ${city.state}`);
    setCityResults([]);
    setShowDropdown(false);
    setCitySelected(true);
    
    if (city.place_id) {
      try {
        const coordsResponse = await fetch(`/api/cities/coordinates?place_id=${city.place_id}`);
        const coordsData = await coordsResponse.json();
        
        if (coordsData.lat && coordsData.lng) {
          const nearbyResponse = await fetch(`/api/cities/nearby?lat=${coordsData.lat}&lng=${coordsData.lng}&radius=${formData.serviceRadius}`);
          const nearbyData = await nearbyResponse.json();
          
          if (nearbyData.cities) {
            setNearbyCities([
              { name: city.name, state: city.state, isCenter: true, distance: 0, selected: true },
              ...nearbyData.cities.map((c: City) => ({ ...c, selected: true }))
            ]);
            setFormData(prev => ({
              ...prev,
              serviceCities: [city.name, ...nearbyData.cities.map((c: City) => c.name)]
            }));
          }
        }
      } catch (error) {
        console.error('Failed to load nearby cities:', error);
      }
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // Validation
    if (!formData.firstName || !formData.lastName || !formData.phone || !formData.company) {
      setError('Please fill in all required fields');
      setSaving(false);
      return;
    }

    if (!formData.primaryCity || !formData.primaryState) {
      setError('Please select your primary service city');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/realtor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess('Profile setup completed successfully!');
        setTimeout(() => router.push('/realtor/dashboard'), 1500);
      }
    } catch (err) {
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Complete Your Realtor Profile
            </h1>
            <p className="text-lg text-gray-600">
              Set up your service area and start connecting with qualified buyers
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              
              {/* Error/Success Messages */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-red-800">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p className="text-green-800">{success}</p>
                  </div>
                </div>
              )}

              {/* Personal Information */}
              <div className="space-y-6">
                <div className="text-center pb-4 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900">Personal Information</h2>
                  <p className="text-gray-600 mt-2">Your basic contact details</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="John"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Smith"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Brokerage/Company *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="ABC Realty"
                    />
                  </div>
                </div>
              </div>

              {/* License Information */}
              <div className="space-y-6">
                <div className="text-center pb-4 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900">License Information</h2>
                  <p className="text-gray-600 mt-2">Your real estate license details</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      License Number
                    </label>
                    <input
                      type="text"
                      value={formData.licenseNumber}
                      onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="123456789"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      License State *
                    </label>
                    <select
                      required
                      value={formData.licenseState}
                      onChange={(e) => handleInputChange('licenseState', e.target.value)}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    >
                      <option value="">Select your license state...</option>
                      {ALL_US_STATES.map(state => (
                        <option key={state.value} value={state.value}>
                          {state.label} ({state.value})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Service Area */}
              <div className="space-y-6">
                <div className="text-center pb-4 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900">Service Area</h2>
                  <p className="text-gray-600 mt-2">Where you help buyers find properties</p>
                </div>

                <div className="space-y-6">
                  {/* Primary City Search */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Primary Service City *
                    </label>
                    <input
                      type="text"
                      value={cityQuery}
                      onChange={(e) => {
                        setCityQuery(e.target.value);
                        setShowDropdown(true);
                        setCitySelected(false);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Enter city name (e.g., Jacksonville, FL)"
                    />
                    
                    {/* City Dropdown */}
                    {cityResults.length > 0 && showDropdown && (
                      <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                        {cityResults.map((city, index) => (
                          <button
                            key={`${city.name}-${city.state}-${index}`}
                            type="button"
                            onClick={() => selectCity(city)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0 transition-all"
                          >
                            <div className="font-medium text-gray-900">{city.name}, {city.state}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {citySelected && (
                      <div className="flex items-center mt-3 text-green-600">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <p className="font-medium">City selected! Loading service area...</p>
                      </div>
                    )}
                  </div>

                  {/* Service Radius */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-4">
                      Service Radius: <span className="text-blue-600 font-bold">{formData.serviceRadius} miles</span>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={formData.serviceRadius}
                      onChange={(e) => {
                        const newRadius = parseInt(e.target.value);
                        handleInputChange('serviceRadius', newRadius);
                      }}
                      className="w-full h-3 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-2">
                      <span>10 mi</span>
                      <span>25 mi</span>
                      <span>50 mi</span>
                      <span>100 mi</span>
                    </div>
                  </div>

                  {/* Service Cities Preview */}
                  {nearbyCities.length > 0 && (
                    <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-4">Your Service Area</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {nearbyCities.slice(0, 12).map((city, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${city.isCenter ? 'bg-blue-600' : 'bg-blue-400'}`}></div>
                            <span className="text-blue-800">
                              {city.name} {city.isCenter ? '(Center)' : `(${city.distance}mi)`}
                            </span>
                          </div>
                        ))}
                        {nearbyCities.length > 12 && (
                          <div className="text-blue-600 font-medium">
                            +{nearbyCities.length - 12} more cities
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="text-center pt-6">
                <button
                  type="submit"
                  disabled={saving || !formData.firstName || !formData.lastName || !formData.phone || !formData.company || !formData.primaryCity}
                  className="w-full px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Setting Up Your Profile...
                    </span>
                  ) : (
                    'Complete Setup'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}