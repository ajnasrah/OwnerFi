'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfileSetup() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  // STREAMLINED SEARCH CRITERIA ONLY - No contact info duplicates
  const [formData, setFormData] = useState({
    maxMonthlyPayment: '',
    maxDownPayment: '',
    preferredCity: '',
    preferredState: '',
    searchRadius: 25,
    minBedrooms: '',
    minBathrooms: '',
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

  // Remove contact info population since we're not collecting it anymore

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
        // Only populate search criteria fields - no contact info
        setFormData({
          maxMonthlyPayment: data.profile.maxMonthlyPayment?.toString() || '',
          maxDownPayment: data.profile.maxDownPayment?.toString() || '',
          preferredCity: data.profile.preferredCity || '',
          preferredState: data.profile.preferredState || '',
          searchRadius: data.profile.searchRadius || 25,
          minBedrooms: data.profile.minBedrooms?.toString() || '',
          minBathrooms: data.profile.minBathrooms?.toString() || '',
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

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Only validate search criteria - no contact info needed
    if (!formData.maxMonthlyPayment || !formData.maxDownPayment || !formData.preferredCity) {
      setError('Please fill in monthly payment, down payment, and city');
      setLoading(false);
      return;
    }

    try {
      // Only send search criteria to the API - no contact info
      const response = await fetch('/api/buyer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxMonthlyPayment: formData.maxMonthlyPayment,
          maxDownPayment: formData.maxDownPayment,
          preferredCity: formData.preferredCity,
          preferredState: formData.preferredState,
          searchRadius: formData.searchRadius,
          minBedrooms: formData.minBedrooms,
          minBathrooms: formData.minBathrooms,
        }),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Failed to save search preferences');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        {/* Modern Header */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="flex items-center justify-between mb-8">
            <Link href="/dashboard" className="group flex items-center space-x-2 text-secondary-text hover:text-accent-primary transition-all duration-200">
              <div className="p-2 rounded-full bg-surface-bg group-hover:bg-accent-light transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-medium">Back to Dashboard</span>
            </Link>

            {/* Progress Indicator */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                {[1, 2, 3].map((step) => (
                  <div key={step} className={`w-2 h-2 rounded-full transition-colors ${
                    currentStep >= step ? 'bg-accent-primary' : 'bg-neutral-border'
                  }`} />
                ))}
              </div>
              <span className="text-sm text-secondary-text ml-2">Step {currentStep} of 3</span>
            </div>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-accent-primary to-purple-600 rounded-2xl mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-primary-text mb-4 bg-gradient-to-r from-accent-primary to-purple-600 bg-clip-text text-transparent">
              Find Your Perfect Home
            </h1>
            <p className="text-lg text-secondary-text max-w-2xl mx-auto leading-relaxed">
              Tell us your budget and preferences, and we'll find owner-financed properties that match your lifestyle.
            </p>
          </div>
        </div>

        {/* Modern Form Container */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-surface-bg/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-neutral-border/30 overflow-hidden">
            <form onSubmit={handleSubmit} className="p-8 space-y-12">
              {error && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-6">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-red-800 font-medium">{error}</p>
                  </div>
                </div>
              )}

              {/* Budget Section */}
              <div className="space-y-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-xl mb-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-primary-text mb-2">Budget</h2>
                  <p className="text-secondary-text">Let's establish your comfortable payment range</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Monthly Payment */}
                  <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl p-6 border border-green-200/50">
                    <label className="block text-lg font-semibold text-primary-text mb-4">
                      Maximum Monthly Payment *
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl text-gray-400">$</span>
                      <input
                        type="number"
                        required
                        value={formData.maxMonthlyPayment}
                        onChange={(e) => handleInputChange('maxMonthlyPayment', e.target.value)}
                        className="w-full pl-8 pr-4 py-4 text-2xl font-bold bg-white border-2 border-green-200 rounded-xl focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all text-primary-text"
                        placeholder="1500"
                      />
                    </div>
                    <p className="text-sm text-secondary-text mt-3 bg-white/50 rounded-lg p-3">
                      We'll only show properties with monthly payments at or below this amount
                    </p>
                  </div>

                  {/* Down Payment */}
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200/50">
                    <label className="block text-lg font-semibold text-primary-text mb-4">
                      Maximum Down Payment *
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl text-gray-400">$</span>
                      <input
                        type="number"
                        required
                        value={formData.maxDownPayment}
                        onChange={(e) => handleInputChange('maxDownPayment', e.target.value)}
                        className="w-full pl-8 pr-4 py-4 text-2xl font-bold bg-white border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all text-primary-text"
                        placeholder="30000"
                      />
                    </div>
                    <p className="text-sm text-secondary-text mt-3 bg-white/50 rounded-lg p-3">
                      Properties requiring more than this upfront will be filtered out
                    </p>
                  </div>
                </div>
              </div>

              {/* Location Section */}
              <div className="space-y-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-500 rounded-xl mb-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-primary-text mb-2">Location</h2>
                  <p className="text-secondary-text">Where would you like to search for properties?</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200/50 space-y-6">
                  {/* City Search */}
                  <div className="relative">
                    <label className="block text-lg font-semibold text-primary-text mb-4">
                      Search City *
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
                        className={`w-full px-4 py-4 text-lg bg-white border-2 rounded-xl focus:ring-2 focus:ring-accent-primary transition-all ${
                          citySelected 
                            ? 'border-green-400 bg-green-50/30 text-primary-text' 
                            : 'border-purple-200 text-primary-text focus:border-accent-primary'
                        }`}
                        placeholder="Enter any US city (e.g., Memphis, TN)"
                      />
                      {citySelected && (
                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                          <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {citySelected && (
                      <div className="flex items-center mt-3 text-green-600">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <p className="font-medium">City selected! Finding nearby areas...</p>
                      </div>
                    )}
                    
                    {/* City Dropdown */}
                    {cityResults.length > 0 && showDropdown && (
                      <div className="absolute z-50 w-full mt-2 bg-white border border-purple-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                        <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200">
                          <p className="font-medium text-primary-text">Select your city:</p>
                        </div>
                        {cityResults.map((city, index) => (
                          <button
                            key={`${city.name}-${city.state}-${index}`}
                            type="button"
                            onClick={() => selectCity(city)}
                            className="w-full text-left px-4 py-4 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 focus:from-purple-50 focus:to-pink-50 focus:outline-none border-b border-gray-100 last:border-b-0 transition-all group"
                          >
                            <div className="font-semibold text-primary-text group-hover:text-accent-primary transition-colors">
                              {city.name}, {city.state}
                            </div>
                            {city.population && (
                              <div className="text-sm text-secondary-text mt-1">
                                Population: {city.population.toLocaleString()}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Search Radius Slider */}
                  <div>
                    <label className="block text-lg font-semibold text-primary-text mb-4">
                      Search Radius: <span className="text-accent-primary">{formData.searchRadius} miles</span>
                    </label>
                    <div className="space-y-4">
                      <div className="relative">
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
                            setCurrentStep(2);
                          }}
                          className="w-full h-3 bg-gradient-to-r from-purple-200 to-pink-200 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(formData.searchRadius - 5) / 95 * 100}%, #e5e7eb ${(formData.searchRadius - 5) / 95 * 100}%, #e5e7eb 100%)`
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-sm text-secondary-text">
                        <span className="font-medium">5 mi</span>
                        <span className="font-medium">25 mi</span>
                        <span className="font-medium">50 mi</span>
                        <span className="font-medium">100 mi</span>
                      </div>
                    </div>
                  </div>

                  {/* Selected Location Preview */}
                  {formData.preferredCity && formData.preferredState && (
                    <div className="bg-white/80 rounded-xl p-4 border border-purple-200">
                      <h4 className="font-semibold text-primary-text mb-2">Search Area Preview</h4>
                      <div className="text-sm text-secondary-text space-y-2">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                          <span><strong>{formData.preferredCity}, {formData.preferredState}</strong> (Center)</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-pink-400 rounded-full mr-3"></div>
                          <span>Within <strong>{formData.searchRadius} miles</strong></span>
                        </div>
                        {nearbyCities.length > 1 && (
                          <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                            <p className="font-medium text-primary-text mb-1">Including nearby cities:</p>
                            <div className="text-sm text-secondary-text">
                              {loadingNearby ? (
                                <p className="italic">Loading nearby areas...</p>
                              ) : (
                                <p>{nearbyCities.slice(1, 4).map(city => city.name).join(', ')}{nearbyCities.length > 4 && ` and ${nearbyCities.length - 4} more`}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Property Preferences */}
              <div className="space-y-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl mb-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h0a2 2 0 012 2v0M8 5a2 2 0 012-2h0a2 2 0 012 2v0" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-primary-text mb-2">Property Preferences</h2>
                  <p className="text-secondary-text">Tell us about your ideal home (optional)</p>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-6 border border-orange-200/50 space-y-8">
                  {/* Bedrooms */}
                  <div>
                    <label className="block text-lg font-semibold text-primary-text mb-4">Minimum Bedrooms</label>
                    <div className="flex flex-wrap gap-3">
                      {['', '1', '2', '3', '4'].map((beds) => (
                        <button
                          key={beds}
                          type="button"
                          onClick={() => {
                            handleInputChange('minBedrooms', beds);
                            setCurrentStep(3);
                          }}
                          className={`px-6 py-3 rounded-xl font-medium transition-all transform hover:scale-105 ${
                            formData.minBedrooms === beds
                              ? 'bg-accent-primary text-white shadow-lg'
                              : 'bg-white text-secondary-text border-2 border-orange-200 hover:border-accent-primary hover:text-accent-primary'
                          }`}
                        >
                          {beds === '' ? 'Any' : `${beds}+ bed${beds === '1' ? '' : 's'}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bathrooms */}
                  <div>
                    <label className="block text-lg font-semibold text-primary-text mb-4">Minimum Bathrooms</label>
                    <div className="flex flex-wrap gap-3">
                      {['', '1', '2', '3'].map((baths) => (
                        <button
                          key={baths}
                          type="button"
                          onClick={() => handleInputChange('minBathrooms', baths)}
                          className={`px-6 py-3 rounded-xl font-medium transition-all transform hover:scale-105 ${
                            formData.minBathrooms === baths
                              ? 'bg-accent-primary text-white shadow-lg'
                              : 'bg-white text-secondary-text border-2 border-orange-200 hover:border-accent-primary hover:text-accent-primary'
                          }`}
                        >
                          {baths === '' ? 'Any' : `${baths}+ bath${baths === '1' ? '' : 's'}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-8 border border-indigo-200/50">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl mb-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-primary-text mb-2">Your Search Summary</h3>
                  <p className="text-secondary-text">Here's what we'll look for</p>
                </div>

                <div className="bg-white/70 rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-secondary-text">Monthly Payment</p>
                        <p className="font-semibold text-primary-text">
                          ≤ {formData.maxMonthlyPayment ? `$${parseInt(formData.maxMonthlyPayment).toLocaleString()}` : '[Not Set]'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-secondary-text">Down Payment</p>
                        <p className="font-semibold text-primary-text">
                          ≤ {formData.maxDownPayment ? `$${parseInt(formData.maxDownPayment).toLocaleString()}` : '[Not Set]'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-secondary-text">Location</p>
                        <p className="font-semibold text-primary-text">
                          {formData.preferredCity ? 
                            `${formData.searchRadius}mi around ${formData.preferredCity}, ${formData.preferredState}` : 
                            '[Select City]'
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-secondary-text">Property Type</p>
                        <p className="font-semibold text-primary-text">
                          {formData.minBedrooms || formData.minBathrooms ? (
                            <>
                              {formData.minBedrooms && `${formData.minBedrooms}+ beds`}
                              {formData.minBedrooms && formData.minBathrooms && ', '}
                              {formData.minBathrooms && `${formData.minBathrooms}+ baths`}
                            </>
                          ) : 'Any size'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="text-center">
                <button
                  type="submit"
                  disabled={loading || !formData.maxMonthlyPayment || !formData.maxDownPayment || !formData.preferredCity}
                  className="group relative px-8 py-4 bg-gradient-to-r from-accent-primary to-purple-600 text-white text-lg font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <span className="relative z-10 flex items-center justify-center">
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving Your Preferences...
                      </>
                    ) : (
                      <>
                        Start Finding Properties
                        <svg className="ml-2 -mr-1 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-accent-primary opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity"></div>
                </button>
                
                {(!formData.maxMonthlyPayment || !formData.maxDownPayment || !formData.preferredCity) && (
                  <p className="text-secondary-text text-sm mt-4">
                    Please fill in budget and location to continue
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}