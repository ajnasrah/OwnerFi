'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ProfileSetup() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // CORE FORM DATA
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    maxMonthlyPayment: '',
    maxDownPayment: '',
    preferredCity: '',
    preferredState: '',
    searchRadius: 25,
    minBedrooms: '',
    minBathrooms: '',
    emailNotifications: true,
    smsNotifications: false,
  });

  // Simple city search
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [nearbyCities, setNearbyCities] = useState<any[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [citySelected, setCitySelected] = useState(false);

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

  useEffect(() => {
    if (session?.user?.name) {
      const nameParts = session.user.name.split(' ');
      setFormData(prev => ({
        ...prev,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
      }));
    }
  }, [session]);

  // Load existing buyer profile data if it exists
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'buyer') {
      loadExistingProfile();
    }
  }, [status, session]);

  const loadExistingProfile = async () => {
    try {
      const response = await fetch('/api/buyer/profile');
      const data = await response.json();
      
      if (data.profile) {
        // Get name from session if available, otherwise use profile data
        const sessionFirstName = session?.user?.name?.split(' ')[0] || '';
        const sessionLastName = session?.user?.name?.split(' ').slice(1).join(' ') || '';
        
        // Populate form with existing data - override everything including session data
        setFormData({
          firstName: data.profile.firstName || sessionFirstName,
          lastName: data.profile.lastName || sessionLastName,
          phone: data.profile.phone || '',
          maxMonthlyPayment: data.profile.maxMonthlyPayment?.toString() || '',
          maxDownPayment: data.profile.maxDownPayment?.toString() || '',
          preferredCity: data.profile.preferredCity || '',
          preferredState: data.profile.preferredState || '',
          searchRadius: data.profile.searchRadius || 25,
          minBedrooms: data.profile.minBedrooms?.toString() || '',
          minBathrooms: data.profile.minBathrooms?.toString() || '',
          emailNotifications: data.profile.emailNotifications ?? true,
          smsNotifications: data.profile.smsNotifications ?? false,
        });
        
        // Set city query for display
        if (data.profile.preferredCity && data.profile.preferredState) {
          setCityQuery(`${data.profile.preferredCity}, ${data.profile.preferredState}`);
          setCitySelected(true);
        }
      }
    } catch (err) {
      console.error('Failed to load existing profile:', err);
      // Continue with empty form - maybe they're creating a new profile
    }
  };

  // Simple city search with timeout
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
      console.log('Searching for:', query);
      const response = await fetch(`/api/cities/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      console.log('Results:', data.cities?.length || 0);
      
      setCityResults(data.cities || []);
      setShowDropdown(true);
    } catch (err) {
      console.error('Search failed:', err);
      setCityResults([]);
      setShowDropdown(false);
    }
  };

  const loadNearbyCities = async (centerCity: any) => {
    setLoadingNearby(true);
    try {
      if (!centerCity.lat || !centerCity.lng) {
        // If no coordinates, just show the center city
        setNearbyCities([{ 
          name: centerCity.name, 
          state: centerCity.state, 
          isCenter: true, 
          distance: 0 
        }]);
        return;
      }

      const response = await fetch(`/api/cities/nearby?lat=${centerCity.lat}&lng=${centerCity.lng}&radius=${formData.searchRadius}`);
      const data = await response.json();
      
      if (data.cities) {
        // Add the center city at the top
        const citiesWithCenter = [
          { 
            name: centerCity.name, 
            state: centerCity.state, 
            isCenter: true, 
            distance: 0 
          },
          ...data.cities.filter((city: any) => 
            !(city.name === centerCity.name && city.state === centerCity.state)
          )
        ];
        setNearbyCities(citiesWithCenter);
      } else {
        setNearbyCities([{ 
          name: centerCity.name, 
          state: centerCity.state, 
          isCenter: true, 
          distance: 0 
        }]);
      }
    } catch (err) {
      console.error('Failed to load nearby cities:', err);
      setNearbyCities([{ 
        name: centerCity.name, 
        state: centerCity.state, 
        isCenter: true, 
        distance: 0 
      }]);
    } finally {
      setLoadingNearby(false);
    }
  };

  const selectCity = (city: any) => {
    setFormData(prev => ({
      ...prev,
      preferredCity: city.name,
      preferredState: city.state
    }));
    setCityQuery(`${city.name}, ${city.state}`);
    setCityResults([]);
    setShowDropdown(false);
    setCitySelected(true);
    loadNearbyCities(city);
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const phoneNumber = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.firstName || !formData.lastName || !formData.phone) {
      setError('Please fill in all contact information');
      setLoading(false);
      return;
    }

    if (!formData.maxMonthlyPayment || !formData.maxDownPayment || !formData.preferredCity) {
      setError('Please fill in monthly payment, down payment, and city');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/buyer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-bg flex flex-col">
      <Header />
      
      <div className="flex-1" style={{padding: '48px 16px'}}>
        <div style={{width: '100%', maxWidth: '672px', margin: '0 auto'}}>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-text mb-4">
              🏠 Set Your Search Filter
            </h1>
            <p className="text-lg text-secondary-text mb-4">
              This filter will automatically show you matching properties when you return
            </p>
          </div>

          <div className="bg-surface-bg rounded-xl p-6 shadow-soft">
            <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Contact Information */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            {/* Monthly Payment */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">🏦 Monthly Payment</h2>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Monthly Payment You Can Afford *
              </label>
              <input
                type="number"
                required
                value={formData.maxMonthlyPayment}
                onChange={(e) => handleInputChange('maxMonthlyPayment', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                placeholder="1500"
              />
              <p className="text-xs text-gray-500 mt-1">Only properties with monthly payments ≤ this amount</p>
            </div>

            {/* Down Payment */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">💰 Down Payment</h2>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Down Payment You Can Afford *
              </label>
              <input
                type="number"
                required
                value={formData.maxDownPayment}
                onChange={(e) => handleInputChange('maxDownPayment', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                placeholder="30000"
              />
              <p className="text-xs text-gray-500 mt-1">Only properties requiring ≤ this down payment</p>
            </div>

            {/* 📍 Location & Radius */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📍 Location & Radius</h2>
              
              {/* Single City Input with Autocomplete */}
              <div className="relative mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What city are you in?
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
                  className={`w-full p-3 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium ${
                    citySelected ? 'border-green-500 bg-green-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter any US city and state (e.g., Memphis, TN)"
                />
                {citySelected && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
                
                {citySelected && (
                  <p className="text-sm text-green-600 mt-2 font-medium">✓ City selected! Finding nearby cities...</p>
                )}
                
                {/* City Dropdown */}
                {cityResults.length > 0 && showDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-blue-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
                      <p className="text-sm font-medium text-blue-900">Select your city:</p>
                    </div>
                    {cityResults.map((city, index) => (
                      <button
                        key={`${city.name}-${city.state}-${index}`}
                        type="button"
                        onClick={() => selectCity(city)}
                        className="w-full text-left px-4 py-3 hover:bg-green-50 focus:bg-green-50 focus:outline-none border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{city.name}, {city.state}</div>
                        {city.population && (
                          <div className="text-sm text-gray-500">Population: {city.population.toLocaleString()}</div>
                        )}
                        <div className="text-xs text-green-600 mt-1">→ Click to select and find nearby cities</div>
                      </button>
                    ))}
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-1">Start typing to search US cities</p>
              </div>

              {/* Search Radius - Adjustable Slider */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Search Radius: {formData.searchRadius} miles
                </label>
                <div className="px-3">
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={formData.searchRadius}
                    onChange={(e) => {
                      const newRadius = parseInt(e.target.value);
                      handleInputChange('searchRadius', newRadius);
                      // If a city is selected, reload nearby cities with new radius
                      if (formData.preferredCity && formData.preferredState && nearbyCities.length > 0) {
                        const centerCity = { 
                          name: formData.preferredCity, 
                          state: formData.preferredState,
                          lat: nearbyCities[0]?.lat || 0,
                          lng: nearbyCities[0]?.lng || 0
                        };
                        loadNearbyCities(centerCity);
                      }
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>5 miles</span>
                    <span>25 miles</span>
                    <span>50 miles</span>
                    <span>100 miles</span>
                  </div>
                </div>
                <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mt-3">
                  <p className="text-sm text-blue-700">
                    <strong>{formData.searchRadius} mile radius</strong> - We'll find properties within this distance from your selected city
                  </p>
                </div>
              </div>

              {/* Selected City Display & Cities Within Radius */}
              {formData.preferredCity && formData.preferredState && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="mb-3">
                    <h4 className="font-medium text-blue-900">Selected Location:</h4>
                    <p className="text-blue-800">{formData.preferredCity}, {formData.preferredState}</p>
                    <p className="text-sm text-blue-600">Search Radius: {formData.searchRadius} miles</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-blue-900 mb-2">Cities within {formData.searchRadius} miles:</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      {loadingNearby ? (
                        <>
                          <p>• {formData.preferredCity}, {formData.preferredState} (Center)</p>
                          <p>• Loading nearby cities...</p>
                        </>
                      ) : (
                        nearbyCities.map((city, index) => (
                          <p key={index}>
                            • {city.name}, {city.state} {city.isCenter ? '(Center)' : city.distance ? `(${city.distance} mi)` : ''}
                          </p>
                        ))
                      )}
                      <p className="text-xs text-blue-600 mt-2 italic">We'll find properties in ALL cities within this radius</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Filters */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">🏠 Optional Filters</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Bedrooms</label>
                  <select
                    value={formData.minBedrooms}
                    onChange={(e) => handleInputChange('minBedrooms', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                  >
                    <option value="">Any</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                    <option value="4">4+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Bathrooms</label>
                  <select
                    value={formData.minBathrooms}
                    onChange={(e) => handleInputChange('minBathrooms', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                  >
                    <option value="">Any</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Filter Preview */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Your Search Filter</h3>
              <div className="text-blue-800 text-sm space-y-1">
                <div>💵 Monthly payment ≤ {formData.maxMonthlyPayment ? `$${parseInt(formData.maxMonthlyPayment).toLocaleString()}` : '[Set Amount]'}</div>
                <div>💰 Down payment ≤ {formData.maxDownPayment ? `$${parseInt(formData.maxDownPayment).toLocaleString()}` : '[Set Amount]'}</div>
                <div>📍 Within {formData.searchRadius} miles of {formData.preferredCity ? `${formData.preferredCity}, ${formData.preferredState}` : '[Select City]'}</div>
                {formData.minBedrooms && <div>🛏️ {formData.minBedrooms}+ bedrooms</div>}
                {formData.minBathrooms && <div>🛁 {formData.minBathrooms}+ bathrooms</div>}
              </div>
              <p className="text-blue-700 text-xs mt-2">
                Shows properties from ALL cities within your radius
              </p>
            </div>

            <div className="pt-6 border-t">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400"
              >
                {loading ? 'Saving Filter...' : 'Save Filter & View Properties'}
              </button>
            </div>
            </form>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}