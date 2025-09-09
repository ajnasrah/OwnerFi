'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useDebounce } from 'use-debounce';

interface City {
  name: string;
  state: string;
}

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  listPrice: number;
  monthlyPayment: number;
  downPaymentAmount: number;
  isActive: boolean;
}

export default function BuyerRegistration() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    // Personal Info
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    
    // Search Criteria
    minPrice: '',
    maxPrice: '',
    minBedrooms: '',
    minBathrooms: '',
    minSquareFeet: '',
    preferredCity: '',
    preferredState: '',
    searchRadius: 50, // miles
    maxDownPayment: '',
  });

  const [matchedProperties, setMatchedProperties] = useState<Property[]>([]);
  
  // City autocomplete
  const [cityQuery, setCityQuery] = useState('');
  const [debouncedCityQuery] = useDebounce(cityQuery, 300);
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  // Search for cities when debounced query changes
  const searchCities = async (query: string) => {
    if (!query || query.length < 2) {
      setCityResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/cities/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      console.log('City search results:', data.cities);
      setCityResults(data.cities || []);
      setShowCityDropdown(true);
    } catch (err) {
      console.error('City search error:', err);
      setCityResults([]);
    }
  };

  // Effect for city search
  useEffect(() => {
    console.log('City search effect:', { debouncedCityQuery, showCityDropdown, cityResultsLength: cityResults.length });
    if (debouncedCityQuery) {
      searchCities(debouncedCityQuery);
    } else {
      setCityResults([]);
    }
  }, [debouncedCityQuery]);

  const handleCitySelect = (city: City) => {
    setFormData(prev => ({
      ...prev,
      preferredCity: city.name,
      preferredState: city.state
    }));
    setCityQuery(`${city.name}, ${city.state}`);
    setShowCityDropdown(false);
    setCityResults([]);
  };

  const validateStep1 = () => {
    if (!formData.firstName.trim()) return 'First name is required';
    if (!formData.lastName.trim()) return 'Last name is required';
    if (!formData.email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'Valid email is required';
    if (!formData.phone.trim()) return 'Phone number is required';
    return null;
  };

  const validateStep2 = () => {
    if (!formData.preferredCity) return 'Please select a preferred city';
    if (!formData.maxPrice) return 'Maximum price is required';
    if (!formData.maxDownPayment) return 'Maximum down payment is required';
    return null;
  };

  const handleNext = () => {
    if (step === 1) {
      const error = validateStep1();
      if (error) {
        setError(error);
        return;
      }
    }
    
    if (step === 2) {
      const error = validateStep2();
      if (error) {
        setError(error);
        return;
      }
    }
    
    setStep(step + 1);
    setError(null);
  };

  const handleSubmit = async () => {
    const error = validateStep2();
    if (error) {
      setError(error);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/buyer/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          // Send city and radius instead of states
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setMatchedProperties(data.matchedProperties || []);
        setSuccess(true);
        setStep(3);
      }
    } catch (err) {
      setError('Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (success && step === 3) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Success Header */}
            <div className="bg-green-600 px-6 py-8 text-center">
              <div className="text-white">
                <div className="text-6xl mb-4">🎉</div>
                <h1 className="text-3xl font-bold mb-2">Registration Complete!</h1>
                <p className="text-green-100">
                  We found {matchedProperties.length} properties that match your criteria
                </p>
              </div>
            </div>

            {/* Matched Properties */}
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Matched Properties</h2>
              
              {matchedProperties.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-6xl mb-4">🏠</div>
                  <p className="text-gray-600">No properties match your current criteria.</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Try adjusting your search preferences or check back later for new listings.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {matchedProperties.map((property) => (
                    <div key={property.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      {/* Property Image Placeholder */}
                      <div className="bg-gradient-to-br from-green-400 to-blue-500 h-32 flex items-center justify-center">
                        <div className="text-white text-center">
                          <div className="text-2xl mb-1">🏠</div>
                          <p className="text-xs">Your Match</p>
                        </div>
                      </div>
                      
                      <div className="p-4">
                        {/* Address */}
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {property.address}
                        </h3>
                        <p className="text-gray-600 text-sm mb-3">
                          {property.city}, {property.state} {property.zipCode}
                        </p>

                        {/* Property Details */}
                        <div className="flex justify-between items-center mb-3 text-sm text-gray-600">
                          <span>{property.bedrooms} bed</span>
                          <span>{property.bathrooms} bath</span>
                          <span>{property.squareFeet.toLocaleString()} sqft</span>
                        </div>

                        {/* Pricing */}
                        <div className="border-t pt-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xl font-bold text-gray-900">
                              {formatCurrency(property.listPrice)}
                            </span>
                            <span className="text-sm text-gray-600">
                              {property.interestRate}% APR
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex justify-between">
                              <span>Down Payment:</span>
                              <span className="font-medium">{formatCurrency(property.downPaymentAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Monthly:</span>
                              <span className="font-medium">{formatCurrency(property.monthlyPayment)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Next Steps */}
              <div className="bg-blue-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">What Happens Next?</h3>
                <div className="text-blue-800 text-sm space-y-2">
                  <p>✅ Your profile has been saved and you're now in our system</p>
                  <p>✅ Real estate agents in your area will see your interest in these properties</p>
                  <p>✅ Qualified agents can purchase your lead to help you with the buying process</p>
                  <p>✅ We'll notify you when new properties matching your criteria become available</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="border rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-900 mb-2">Your Contact Information</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{formData.firstName} {formData.lastName}</p>
                  <p>{formData.email}</p>
                  {formData.phone && <p>{formData.phone}</p>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/"
                  className="flex-1 bg-blue-600 text-white text-center py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View All Properties
                </Link>
                <Link
                  href="/admin"
                  className="flex-1 bg-gray-600 text-white text-center py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Admin Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-8 text-center">
            <div className="text-white">
              <h1 className="text-3xl font-bold mb-2">Find Your Dream Home</h1>
              <p className="text-blue-100">
                Get matched to owner-financed properties in Texas, Florida, and Georgia
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-4 bg-gray-50">
            <div className="flex items-center">
              <div className={`flex-1 h-2 rounded-l ${step >= 1 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`flex-1 h-2 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`flex-1 h-2 rounded-r ${step >= 3 ? 'bg-green-600' : 'bg-gray-300'}`}></div>
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>Personal Info</span>
              <span>Search Criteria</span>
              <span>Results</span>
            </div>
          </div>

          <form className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="text-red-800 text-sm">{error}</div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="John"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="john.doe@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Next: Search Criteria →
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">What Are You Looking For?</h2>

                {/* 📍 Location & Radius */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">📍 Location & Radius</h3>
                  
                  {/* Single City Input with Autocomplete */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      What city are you in?
                    </label>
                    <input
                      type="text"
                      value={cityQuery}
                      onChange={(e) => {
                        setCityQuery(e.target.value);
                        setShowCityDropdown(true);
                      }}
                      onFocus={() => setShowCityDropdown(true)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter any US city and state (e.g., Memphis, TN)"
                    />
                    
                    {/* City Dropdown */}
                    {cityResults.length > 0 && showCityDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {cityResults.map((city, index) => (
                          <button
                            key={`${city.name}-${city.state}-${index}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleCitySelect(city);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{city.name}, {city.state}</div>
                            {city.population && (
                              <div className="text-sm text-gray-500">Population: {city.population.toLocaleString()}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 mt-1">We'll add autocomplete later - for now, type your city and state</p>
                  </div>

                  {/* Selected City Display & Cities Within Radius */}
                  {formData.preferredCity && formData.preferredState && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <div className="mb-3">
                        <h4 className="font-medium text-blue-900">Selected Location:</h4>
                        <p className="text-blue-800">{formData.preferredCity}, {formData.preferredState}</p>
                        <p className="text-sm text-blue-600">Search Radius: {formData.searchRadius} miles</p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-blue-900 mb-2">Cities within {formData.searchRadius} miles:</h4>
                        <div className="text-sm text-blue-800">
                          <p>• {formData.preferredCity}, {formData.preferredState} (Center)</p>
                          <p>• Loading nearby cities...</p>
                          <p className="text-xs text-blue-600 mt-1">We'll find properties in ALL cities within this radius</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Price Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Price (Optional)
                    </label>
                    <input
                      type="number"
                      value={formData.minPrice}
                      onChange={(e) => handleInputChange('minPrice', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="100000"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Price *
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.maxPrice}
                      onChange={(e) => handleInputChange('maxPrice', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="300000"
                    />
                  </div>
                </div>

                {/* Property Features */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Bedrooms
                    </label>
                    <select
                      value={formData.minBedrooms}
                      onChange={(e) => handleInputChange('minBedrooms', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Any</option>
                      <option value="1">1+</option>
                      <option value="2">2+</option>
                      <option value="3">3+</option>
                      <option value="4">4+</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Bathrooms
                    </label>
                    <select
                      value={formData.minBathrooms}
                      onChange={(e) => handleInputChange('minBathrooms', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Any</option>
                      <option value="1">1+</option>
                      <option value="2">2+</option>
                      <option value="3">3+</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Square Feet
                    </label>
                    <input
                      type="number"
                      value={formData.minSquareFeet}
                      onChange={(e) => handleInputChange('minSquareFeet', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="1200"
                    />
                  </div>
                </div>

                {/* Down Payment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum Down Payment You Can Afford *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.maxDownPayment}
                    onChange={(e) => handleInputChange('maxDownPayment', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="30000"
                  />
                  <p className="text-xs text-gray-500 mt-1">This helps us filter properties you can actually afford</p>
                </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="bg-gray-300 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400"
                  >
                    {loading ? 'Finding Matches...' : 'Find My Properties →'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            ← Back to Property Listings
          </Link>
        </div>
      </div>
    </div>
  );
}