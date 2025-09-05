'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RealtorSetup() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data for realtor profile
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
    serviceStates: [] as string[],
    serviceCities: '',
  });

  // City search functionality (same as buyer setup)
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [citySelected, setCitySelected] = useState(false);
  const [nearbyCities, setNearbyCities] = useState<any[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/realtor/signin');
    }
    
    // Strict role checking - realtors only
    if (status === 'authenticated' && session?.user?.role !== 'realtor') {
      if (session?.user?.role === 'buyer') {
        router.push('/dashboard');
      } else {
        router.push('/realtor/signin');
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

  // City search with timeout (same as buyer setup)
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
        setNearbyCities([{ 
          name: centerCity.name, 
          state: centerCity.state, 
          isCenter: true, 
          distance: 0 
        }]);
        return;
      }

      const response = await fetch(`/api/cities/nearby?lat=${centerCity.lat}&lng=${centerCity.lng}&radius=${formData.serviceRadius}`);
      const data = await response.json();
      
      if (data.cities) {
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
      primaryCity: city.name,
      primaryState: city.state
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

  const handleStateChange = (state: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        serviceStates: [...prev.serviceStates, state]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        serviceStates: prev.serviceStates.filter(s => s !== state)
      }));
    }
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.firstName || !formData.lastName || !formData.phone || !formData.company || !formData.primaryCity || !formData.primaryState) {
      setError('Please fill in all required fields including company/brokerage and primary service city');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/realtor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          email: session?.user?.email,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // Redirect to Buyer Link dashboard
      router.push('/realtor/dashboard');
      
    } catch (err) {
      setError('Failed to save profile. Please try again.');
      setLoading(false);
    }
  };

  const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-blue-600 px-6 py-8 text-center">
            <div className="text-white">
              <div className="flex justify-between items-start mb-4">
                <Link href="/" className="text-blue-100 hover:text-white text-sm">
                  ← Home
                </Link>
                <div className="text-center flex-1">
                  <h1 className="text-3xl font-bold mb-2">🏠 Buyer Link Setup</h1>
                  <p className="text-blue-100">
                    Complete your realtor profile to start accessing buyer leads
                  </p>
                </div>
                <div className="w-16"></div> {/* Spacer for centering */}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Trial Benefits */}
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <h3 className="font-medium text-green-900 mb-2">🎉 Your 7-Day Free Trial Includes:</h3>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• 3 free buyer lead purchases</li>
                <li>• Full access to Buyer Link dashboard</li>
                <li>• View qualified buyer profiles with contact info</li>
                <li>• Lead management and tracking tools</li>
              </ul>
            </div>

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
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Company/Brokerage *</label>
                <input
                  type="text"
                  required
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                  placeholder="ABC Realty"
                />
              </div>
            </div>

            {/* License Information - Optional */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">License Information (Optional)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                    placeholder="ABC123456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License State</label>
                  <select
                    value={formData.licenseState}
                    onChange={(e) => handleInputChange('licenseState', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                  >
                    <option value="">Select State</option>
                    {US_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Primary Service City */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📍 Primary Service City</h2>
              <p className="text-sm text-gray-600 mb-4">
                This is your main service area. We'll show you buyer leads within {formData.serviceRadius} miles of this city.
              </p>
              
              {/* City Input with Autocomplete */}
              <div className="relative mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What city do you primarily work in? *
                </label>
                <input
                  type="text"
                  required
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
                  placeholder="Enter your primary service city (e.g., Dallas, TX)"
                />
                {citySelected && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 mt-6">
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
                      <p className="text-sm font-medium text-blue-900">Select your primary service city:</p>
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
                        <div className="text-xs text-green-600 mt-1">→ Click to select and find service area</div>
                      </button>
                    ))}
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-1">Start typing to search US cities</p>
              </div>

              {/* Service Radius - Adjustable Slider */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Service Radius: {formData.serviceRadius} miles
                </label>
                <div className="px-3">
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={formData.serviceRadius}
                    onChange={(e) => {
                      const newRadius = parseInt(e.target.value);
                      handleInputChange('serviceRadius', newRadius);
                      // If a city is selected, reload nearby cities with new radius
                      if (formData.primaryCity && formData.primaryState && nearbyCities.length > 0) {
                        const centerCity = { 
                          name: formData.primaryCity, 
                          state: formData.primaryState,
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
                <div className="bg-green-50 p-3 rounded-md border border-green-200 mt-3">
                  <p className="text-sm text-green-700">
                    <strong>{formData.serviceRadius} mile service area</strong> - You'll receive buyer leads within this distance from {formData.primaryCity || 'your selected city'}
                  </p>
                </div>
              </div>

              {/* Selected City Display & Cities Within Radius */}
              {formData.primaryCity && formData.primaryState && (
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <div className="mb-3">
                    <h4 className="font-medium text-blue-900">Selected Service Area:</h4>
                    <p className="text-blue-800">{formData.primaryCity}, {formData.primaryState}</p>
                    <p className="text-sm text-blue-600">Service Radius: {formData.serviceRadius} miles</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-blue-900 mb-2">Cities within {formData.serviceRadius} miles:</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      {loadingNearby ? (
                        <>
                          <p>• {formData.primaryCity}, {formData.primaryState} (Center)</p>
                          <p>• Loading nearby cities...</p>
                        </>
                      ) : (
                        nearbyCities.map((city, index) => (
                          <p key={index}>
                            • {city.name}, {city.state} {city.isCenter ? '(Center)' : city.distance ? `(${city.distance} mi)` : ''}
                          </p>
                        ))
                      )}
                      <p className="text-xs text-blue-600 mt-2 italic">You'll receive buyer leads from ALL cities within this radius</p>
                    </div>
                  </div>
                </div>
              )}
            </div>


            {/* Profile Preview */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Your Buyer Link Profile</h3>
              <div className="text-blue-800 text-sm space-y-1">
                <div>👤 {formData.firstName} {formData.lastName}</div>
                <div>📞 {formData.phone || '[Phone Number]'}</div>
                <div>🏢 {formData.company || '[Company/Brokerage]'}</div>
                <div>📍 Service Area: {formData.primaryCity && formData.primaryState ? `${formData.primaryCity}, ${formData.primaryState} (${formData.serviceRadius} mile radius)` : '[Select Primary City]'}</div>
                {formData.licenseNumber && (
                  <div>📋 License: {formData.licenseNumber} {formData.licenseState && `(${formData.licenseState})`}</div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400"
              >
                {loading ? 'Setting Up Profile...' : 'Complete Setup & Start 7-Day Trial'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}