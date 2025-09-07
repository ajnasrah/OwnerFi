'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BuyerSettings() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // CORE FORM DATA
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    maxMonthlyPayment: '',
    maxDownPayment: '',
    preferredCity: '',
    preferredState: '',
    searchRadius: 40,
    minBedrooms: '',
    minBathrooms: '',
    emailNotifications: true,
    smsNotifications: false,
  });

  // City search functionality
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [citySelected, setCitySelected] = useState(false);
  const [nearbyCities, setNearbyCities] = useState<any[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

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
        console.log('🔍 Settings loading profile data:', {
          firstName: data.profile.firstName,
          lastName: data.profile.lastName, 
          phone: data.profile.phone,
          preferredCity: data.profile.preferredCity
        });
        
        // Populate form with existing data
        setFormData({
          firstName: data.profile.firstName || '',
          lastName: data.profile.lastName || '',
          phone: data.profile.phone || '',
          maxMonthlyPayment: data.profile.maxMonthlyPayment?.toString() || '',
          maxDownPayment: data.profile.maxDownPayment?.toString() || '',
          preferredCity: data.profile.preferredCity || '',
          preferredState: data.profile.preferredState || '',
          searchRadius: data.profile.searchRadius || 40,
          minBedrooms: data.profile.minBedrooms?.toString() || '',
          minBathrooms: data.profile.minBathrooms?.toString() || '',
          emailNotifications: data.profile.emailNotifications ?? true,
          smsNotifications: data.profile.smsNotifications ?? false,
        });
        
        console.log('📝 Form data after setting:', {
          firstName: data.profile.firstName || '',
          phone: data.profile.phone || ''
        });
        
        // Set city query for display
        if (data.profile.preferredCity && data.profile.preferredState) {
          setCityQuery(`${data.profile.preferredCity}, ${data.profile.preferredState}`);
          setCitySelected(true);
          
          // Load saved cities from database so they show up immediately  
          const savedCitiesList = data.profile.cities || data.profile.searchAreaCities || [];
          if (savedCitiesList && savedCitiesList.length > 0) {
            const savedCities = savedCitiesList.map((cityName: string, index: number) => ({
              name: cityName,
              state: data.profile.preferredState,
              isCenter: cityName === data.profile.preferredCity,
              distance: cityName === data.profile.preferredCity ? 0 : null,
              selected: true // All cities selected by default
            }));
            setNearbyCities(savedCities);
            console.log('🏙️ Loaded saved cities:', savedCities.map(c => c.name));
          }
        }
      }
    } catch (err) {
      setError('Failed to load your profile');
    } finally {
      setLoading(false);
    }
  };

  // City search functions (same as setup)
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

      const response = await fetch(`/api/cities/nearby?lat=${centerCity.lat}&lng=${centerCity.lng}&radius=${formData.searchRadius}`);
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

  const selectCity = async (city: any) => {
    // Clear old data first
    setNearbyCities([]);
    setLoadingNearby(true);
    
    // Fetch coordinates to get correct state and city data
    if (city.place_id) {
      try {
        const response = await fetch(`/api/cities/coordinates?place_id=${city.place_id}`);
        const cityWithCoords = await response.json();
        console.log('🏙️ Settings - Coordinates API returned:', cityWithCoords);
        
        // Update form data with correct city and state from API
        const finalCityData = {
          name: cityWithCoords.name || city.name,
          state: cityWithCoords.state || city.state,
          lat: cityWithCoords.lat,
          lng: cityWithCoords.lng
        };
        
        setFormData(prev => ({
          ...prev,
          preferredCity: finalCityData.name,
          preferredState: finalCityData.state
        }));
        
        setCityQuery(`${finalCityData.name}, ${finalCityData.state}`);
        setCityResults([]);
        setShowDropdown(false);
        setCitySelected(true);
        
        // Load nearby cities with correct coordinates
        if (finalCityData.lat && finalCityData.lng) {
          loadNearbyCities(finalCityData);
        } else {
          setLoadingNearby(false);
        }
        
      } catch (err) {
        console.error('Failed to fetch coordinates in settings:', err);
        // Fallback to original data
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
      }
    } else {
      // No place_id, use original data
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

    if (!formData.firstName || !formData.lastName || !formData.phone) {
      setError('Please fill in all contact information');
      setSaving(false);
      return;
    }

    if (!formData.maxMonthlyPayment || !formData.maxDownPayment || !formData.preferredCity) {
      setError('Please fill in monthly payment, down payment, and city');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/buyer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cities: nearbyCities.filter(city => city.selected !== false).map(city => city.name) // All selected cities
        }),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess('Preferences updated successfully!');
        
        // Trigger dashboard refresh by dispatching a custom event
        window.dispatchEvent(new CustomEvent('preferencesUpdated', {
          detail: { 
            preferredCity: formData.preferredCity,
            preferredState: formData.preferredState,
            maxMonthlyPayment: formData.maxMonthlyPayment,
            maxDownPayment: formData.maxDownPayment
          }
        }));
        
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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-blue-600 px-6 py-8 text-center">
            <div className="text-white">
              <div className="flex justify-between items-start mb-4">
                <Link href="/" className="text-blue-100 hover:text-white text-sm">
                  ← Home
                </Link>
                <div className="text-center flex-1">
                  <h1 className="text-3xl font-bold mb-2">🏠 Edit Your Preferences</h1>
                  <p className="text-blue-100">
                    Update your search criteria to find better property matches
                  </p>
                </div>
                <div className="w-16"></div> {/* Spacer for centering */}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Back to Dashboard */}
            <div className="flex justify-between items-center">
              <Link 
                href="/dashboard"
                className="text-blue-600 hover:text-blue-500 font-medium"
              >
                ← Back to Dashboard
              </Link>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-green-800 text-sm">{success}</p>
              </div>
            )}

            {/* Contact Information */}
            <div className="flex gap-8">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
                
                <div className="grid grid-cols-1 gap-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                      placeholder="Enter first name"
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
                      placeholder="Enter last name"
                    />
                  </div>
                  <div>
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
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <div className="w-full p-3 bg-gray-50 border border-gray-300 rounded-md text-gray-700 font-medium min-h-[48px] flex items-center">
                      {session?.user?.email || 'Not available'}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Email cannot be changed here</p>
                  </div>
                </div>
              </div>
              
              {/* Explanation */}
              <div className="flex-1">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-3">About This Page</h3>
                  <div className="text-sm text-blue-800 space-y-2">
                    <p>• Update your search preferences to find better property matches</p>
                    <p>• Set your budget limits for monthly payments and down payments</p>
                    <p>• Choose your location and how far you're willing to travel</p>
                    <p>• Optional filters help narrow down to your ideal property type</p>
                    <p>• Changes apply immediately to your property matches</p>
                  </div>
                  <div className="mt-4 p-3 bg-white/60 rounded border border-blue-300">
                    <p className="text-xs text-blue-700 font-medium">
                      💡 Tip: Start with broader criteria, then narrow down as you browse properties!
                    </p>
                  </div>
                </div>
              </div>
            </div>


            {/* Monthly Payment Slider */}
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">🏦 Monthly Payment Budget</h2>
                <p className="text-gray-700">What's the maximum monthly payment you can afford?</p>
              </div>
              
              <div className="mb-6">
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    ${(formData.maxMonthlyPayment || 1500).toLocaleString()}/month
                  </div>
                  <p className="text-gray-600">Your maximum monthly budget</p>
                </div>
                
                <div className="px-4">
                  <input
                    type="range"
                    min="500"
                    max="5000"
                    step="50"
                    value={formData.maxMonthlyPayment || 1500}
                    onChange={(e) => handleInputChange('maxMonthlyPayment', e.target.value)}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #10b981 0%, #10b981 ${(((formData.maxMonthlyPayment || 1500) - 500) / 4500) * 100}%, #e5e7eb ${(((formData.maxMonthlyPayment || 1500) - 500) / 4500) * 100}%, #e5e7eb 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>$500</span>
                    <span>$1,500</span>
                    <span>$3,000</span>
                    <span>$5,000+</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/80 rounded-lg p-3">
                <p className="text-sm text-green-700">
                  <strong>Budget set!</strong> We'll only show properties with monthly payments ≤ ${(formData.maxMonthlyPayment || 1500).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Down Payment Slider */}
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">💰 Down Payment Budget</h2>
                <p className="text-gray-700">How much can you put down upfront?</p>
              </div>
              
              <div className="mb-6">
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-orange-600 mb-2">
                    ${(formData.maxDownPayment || 30000).toLocaleString()}
                  </div>
                  <p className="text-gray-600">Your maximum down payment</p>
                </div>
                
                <div className="px-4">
                  <input
                    type="range"
                    min="5000"
                    max="100000"
                    step="2500"
                    value={formData.maxDownPayment || 30000}
                    onChange={(e) => handleInputChange('maxDownPayment', e.target.value)}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #ea580c 0%, #ea580c ${(((formData.maxDownPayment || 30000) - 5000) / 95000) * 100}%, #e5e7eb ${(((formData.maxDownPayment || 30000) - 5000) / 95000) * 100}%, #e5e7eb 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>$5K</span>
                    <span>$25K</span>
                    <span>$50K</span>
                    <span>$100K+</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/80 rounded-lg p-3">
                <p className="text-sm text-orange-700">
                  <strong>Budget set!</strong> We'll only show properties requiring ≤ ${(formData.maxDownPayment || 30000).toLocaleString()} down
                </p>
              </div>
            </div>

            {/* Location & Radius - PROMINENT */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white mb-8">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold mb-2">🎯 Set Your Search Area</h2>
                <p className="text-blue-100 text-lg">Choose your radius FIRST, then select your city!</p>
              </div>
              
              {/* Search Radius - FIRST */}
              <div className="mb-8">
                <div className="text-center mb-4">
                  <div className="text-5xl font-bold text-yellow-300 mb-2">
                    {formData.searchRadius} MILES
                  </div>
                  <p className="text-blue-100 text-lg">Your search radius</p>
                </div>
                
                <div className="px-4">
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={formData.searchRadius}
                    onChange={(e) => {
                      const newRadius = parseInt(e.target.value);
                      handleInputChange('searchRadius', newRadius);
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
                    className="w-full h-4 bg-white/30 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${((formData.searchRadius - 5) / 45) * 100}%, rgba(255,255,255,0.3) ${((formData.searchRadius - 5) / 45) * 100}%, rgba(255,255,255,0.3) 100%)`
                    }}
                  />
                  <div className="flex justify-between text-sm text-blue-200 mt-2">
                    <span>5 mi</span>
                    <span>15 mi</span>
                    <span>25 mi</span>
                    <span>35 mi</span>
                    <span>50 mi+</span>
                  </div>
                </div>
              </div>
              
              {/* City Selection */}
              <div className="mb-6">
                <label className="block text-lg font-semibold text-white mb-3">
                  What city are you in? *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cityQuery}
                    onChange={(e) => {
                      setCityQuery(e.target.value);
                      setShowDropdown(true);
                      setCitySelected(false);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className={`w-full p-4 text-lg border-2 rounded-lg focus:ring-2 focus:ring-yellow-300 text-gray-900 font-semibold ${
                      citySelected ? 'border-green-400 bg-green-50' : 'border-white bg-white'
                    }`}
                    placeholder="Enter any US city (e.g., Memphis, TN)"
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
                  <p className="text-sm text-green-300 mt-2 font-semibold">✓ City selected! Finding nearby cities...</p>
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
                </div>
                
                <p className="text-xs text-white/70 mt-1">Start typing to search US cities</p>
              </div>


              {/* Selected City Display & Cities Within Radius */}
              {formData.preferredCity && formData.preferredState && (
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="mb-3">
                    <h4 className="font-semibold text-white">Selected Location:</h4>
                    <p className="text-blue-100 text-lg font-semibold">{formData.preferredCity}, {formData.preferredState}</p>
                    <p className="text-blue-200">Search Radius: {formData.searchRadius} miles</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-white">Search Area Cities:</h4>
                      <button
                        type="button"
                        onClick={() => {
                          // Select all cities
                          setNearbyCities(prev => prev.map(city => ({ ...city, selected: true })));
                        }}
                        className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-sm rounded-lg transition-colors"
                      >
                        Select All
                      </button>
                    </div>
                    <div className="text-sm text-blue-100">
                      {loadingNearby ? (
                        <div className="space-y-2">
                          <p>• {formData.preferredCity}, {formData.preferredState} (Center)</p>
                          <p>• Loading nearby cities...</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                            {nearbyCities.map((city, index) => (
                              <label key={index} className="flex items-center space-x-3 cursor-pointer hover:bg-white/10 rounded px-2 py-1">
                                <input
                                  type="checkbox"
                                  checked={city.selected !== false} // Default to selected
                                  onChange={(e) => {
                                    setNearbyCities(prev => prev.map((c, i) => 
                                      i === index ? { ...c, selected: e.target.checked } : c
                                    ));
                                  }}
                                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                                />
                                <span className="truncate">
                                  {city.name}, {city.state} {city.isCenter ? '(Center)' : city.distance ? `(${city.distance} mi)` : ''}
                                </span>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-blue-200 mt-3 italic">Only checked cities will be included in your property search</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Filters */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">🏠 Optional Filters</h2>
              
              {/* Min Bedrooms - Button Style */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Min Bedrooms</label>
                <div className="flex flex-wrap gap-2">
                  {['', '1', '2', '3'].map((value, index) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleInputChange('minBedrooms', value)}
                      className={`px-4 py-2 rounded-lg border-2 font-medium transition-colors ${
                        formData.minBedrooms === value
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      {index === 0 ? 'Any' : index === 3 ? '3+ bed' : `${value} bed`}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Min Bathrooms - Button Style */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Min Bathrooms</label>
                <div className="flex flex-wrap gap-2">
                  {['', '1', '2', '3'].map((value, index) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleInputChange('minBathrooms', value)}
                      className={`px-4 py-2 rounded-lg border-2 font-medium transition-colors ${
                        formData.minBathrooms === value
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      {index === 0 ? 'Any' : `${value}+ bath`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Preview */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Your Updated Search Filter</h3>
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
                disabled={saving}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400"
              >
                {saving ? 'Saving Changes...' : 'Save Updated Preferences'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}