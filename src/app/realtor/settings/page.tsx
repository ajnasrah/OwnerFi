'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PRICING_TIERS, PricingTier } from '@/lib/pricing';
import AccountStatus from './AccountStatus';

interface City {
  name: string;
  state: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  place_id?: string;
  isCenter?: boolean;
  distance?: number;
}

interface Subscription {
  status: string;
  currentPeriodEnd: string;
}

interface RealtorProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  licenseNumber: string;
  licenseState: string;
  primaryCity: string;
  primaryState: string;
  serviceRadius: number;
  credits: number;
  isOnTrial: boolean;
  trialEndDate: string;
  profileComplete: boolean;
  subscription?: Subscription;
}

export default function RealtorSettings() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<RealtorProfile | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [billingType, setBillingType] = useState<'annual' | 'monthly'>('annual');

  // City search functionality
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [citySelected, setCitySelected] = useState(false);
  const [nearbyCities, setNearbyCities] = useState<City[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  
  // Additional cities functionality - auto-populated from radius
  const [selectedServiceCities, setSelectedServiceCities] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/realtor/signin');
    }
    
    if (status === 'authenticated' && session?.user?.role !== 'realtor') {
      if (session?.user?.role === 'buyer') {
        router.push('/dashboard');
      } else {
        router.push('/realtor/signin');
      }
    }
  }, [status, router, session]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'realtor') {
      loadProfile();
    }
  }, [status, session]);

  // Handle Stripe success/cancellation URLs and hash navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('success') === 'true') {
      const plan = urlParams.get('plan');
      setSuccess(`Successfully subscribed to ${plan ? PRICING_TIERS[plan]?.name || plan : 'plan'}! Your subscription is now active.`);
      
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
    
    if (urlParams.get('canceled') === 'true') {
      setError('Subscription was cancelled. You can try again anytime.');
      
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
    
    // Handle hash navigation (e.g., #subscription)
    if (window.location.hash === '#subscription') {
      setActiveTab('subscription');
    }
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/realtor/profile');
      const data = await response.json();
      
      if (data.profile) {
        setProfile(data.profile);
        if (data.profile.primaryCity && data.profile.primaryState) {
          setCityQuery(`${data.profile.primaryCity}, ${data.profile.primaryState}`);
          setCitySelected(true);
        }
        // Load selected service cities if they exist
        if (data.profile.serviceCities) {
          try {
            // Handle both array and JSON string formats
            let cities = [];
            if (Array.isArray(data.profile.serviceCities)) {
              cities = data.profile.serviceCities;
            } else if (typeof data.profile.serviceCities === 'string') {
              cities = JSON.parse(data.profile.serviceCities);
            }
            setSelectedServiceCities(cities || []);
          } catch (e) {
            console.error('Failed to parse service cities, using empty array:', e);
            setSelectedServiceCities([]);
          }
        }
        
        // Load nearby cities if primary city is set and not already loaded
        if (data.profile.primaryCity && data.profile.primaryState && nearbyCities.length === 0) {
          // We need to fetch the city details first to get lat/lng
          setTimeout(async () => {
            try {
              // Try searching with just the city name first
              const cityResponse = await fetch(`/api/cities/search?q=${encodeURIComponent(data.profile.primaryCity)}`);
              const cityData = await cityResponse.json();
              
              if (cityData.cities && cityData.cities.length > 0) {
                // Find the city that matches both name and state
                const centerCity = cityData.cities.find((city: City) => 
                  city.name.toLowerCase() === data.profile.primaryCity.toLowerCase() && 
                  city.state === data.profile.primaryState
                ) || cityData.cities[0]; // Fallback to first result
                
                if (centerCity && centerCity.lat && centerCity.lng) {
                  loadNearbyCities(centerCity, data.profile.serviceRadius || 40);
                }
              }
            } catch (err) {
              console.error('Failed to load center city:', err);
            }
          }, 100);
        }
      }
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // City search functions (same as setup page)
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
    setProfile(prev => prev ? ({
      ...prev,
      primaryCity: city.name,
      primaryState: city.state
    }) : null);
    setCityQuery(`${city.name}, ${city.state}`);
    setCityResults([]);
    setShowDropdown(false);
    setCitySelected(true);
    
    // Get coordinates if not already available
    let cityWithCoords = city;
    if (!city.lat || !city.lng) {
      try {
        const coordsResponse = await fetch(`/api/cities/coordinates?place_id=${city.place_id}`);
        const coordsData = await coordsResponse.json();
        
        if (coordsData.lat && coordsData.lng) {
          cityWithCoords = {
            ...city,
            lat: coordsData.lat,
            lng: coordsData.lng
          };
        }
      } catch (err) {
        console.error('Failed to get coordinates:', err);
      }
    }
    
    // Load nearby cities for the newly selected city
    loadNearbyCities(cityWithCoords, profile?.serviceRadius || 40);
    
    // Clear previously selected service cities since the area changed
    setSelectedServiceCities([]);
  };

  const loadNearbyCities = async (centerCity: City, radius: number) => {
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

      const response = await fetch(`/api/cities/nearby?lat=${centerCity.lat}&lng=${centerCity.lng}&radius=${radius}`);
      const data = await response.json();
      
      if (data.cities && data.cities.length > 0) {
        const citiesWithCenter = [
          { 
            name: centerCity.name, 
            state: centerCity.state, 
            isCenter: true, 
            distance: 0 
          },
          ...data.cities.filter((city: City) => 
            !(city.name === centerCity.name && city.state === centerCity.state)
          )
        ];
        setNearbyCities(citiesWithCenter);
        
        // AUTO-SELECT ALL CITIES BY DEFAULT
        const allCityStrings = data.cities.map((city: City) => `${city.name}, ${city.state}`);
        setSelectedServiceCities(allCityStrings);
        if (profile) {
          setProfile(prev => prev ? ({...prev, serviceCities: JSON.stringify(allCityStrings)}) : null);
        }
        
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

  const formatPhoneNumber = (value: string | number): string => {
    const phoneNumber = String(value).replace(/\D/g, '');
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
      const formatted = formatPhoneNumber(value);
      setProfile(prev => prev ? ({ ...prev, [field]: formatted }) : null);
    } else {
      setProfile(prev => prev ? ({ ...prev, [field]: value }) : null);
      
      // If service radius changed, reload nearby cities
      if (field === 'serviceRadius' && profile?.primaryCity && profile?.primaryState && nearbyCities.length > 0) {
        const centerCity = nearbyCities.find(city => city.isCenter);
        if (centerCity) {
          loadNearbyCities(centerCity, Number(value));
        }
      }
    }
    setError('');
    setSuccess('');
  };

  const handlePlanSelection = async (tier: PricingTier) => {
    if (tier.isEnterprise) {
      window.open('mailto:Abdullah@prosway.com?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }
    
    if (tier.id === 'customPropertyService') {
      window.open('mailto:Abdullah@prosway.com?subject=Custom Property Service Request&body=I am interested in your custom property sourcing service where you find owner-finance deals for my buyers.', '_blank');
      return;
    }
    
    try {
      setSaving(true);
      
      // Route to different endpoints based on tier type
      if (tier.isPayPerLead && tier.id === 'payAsYouGo') {
        // Single credit purchase - one-time payment
        const response = await fetch('/api/stripe/one-time-purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            credits: 1,
            amount: 300
          }),
        });
        
        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
          setSaving(false);
          return;
        }
        
        // Redirect to Stripe Checkout
        if (data.url) {
          window.location.href = data.url;
        }
        
      } else if (tier.stripePrice) {
        // Subscription plans - recurring payments
        let priceId = tier.stripePrice;
        if (billingType === 'annual' && tier.stripePriceAnnual) {
          priceId = tier.stripePriceAnnual;
        }
        
        console.log('Starting checkout for:', { planId: tier.id, priceId, billingType });
        
        const response = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            priceId: priceId,
            planId: tier.id,
            billingType: billingType,
            successUrl: `${window.location.origin}/realtor/settings?success=true&plan=${tier.id}#subscription`,
            cancelUrl: `${window.location.origin}/realtor/settings?canceled=true#subscription`
          }),
        });
        
        const data = await response.json();
        
        console.log('Checkout response:', data);
        
        if (data.error) {
          console.error('Checkout error:', data);
          setError(`Subscription error: ${data.error}${data.details ? ` - ${data.details}` : ''}`);
          setSaving(false);
          return;
        }
        
        // Redirect to Stripe Checkout
        if (data.url) {
          window.location.href = data.url;
        }
      } else {
        setError('Payment method not configured for this plan');
        setSaving(false);
        return;
      }
      
    } catch (err) {
      setError(tier.isPayPerLead ? 'Failed to process credit purchase. Please try again.' : 'Failed to start subscription process. Please try again.');
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      console.log('Saving profile:', profile);
      const response = await fetch('/api/realtor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      const data = await response.json();
      console.log('Save response:', data);
      
      if (data.error) {
        setError(data.error);
      } else if (response.ok) {
        setSuccess('Profile updated successfully!');
        // Reload profile to get fresh data
        setTimeout(() => loadProfile(), 500);
      } else {
        setError('Update failed. Please try again.');
      }
    } catch (err) {
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getTrialDaysRemaining = () => {
    if (!profile?.isOnTrial || !profile?.trialEndDate) return 0;
    const endDate = new Date(profile.trialEndDate);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Profile not found</p>
          <Link href="/realtor/setup" className="text-blue-600 hover:text-blue-500">
            Complete Setup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-bg">
      {/* Modern Mobile-First Header */}
      <div className="bg-gradient-to-r from-accent-primary to-accent-success shadow-medium">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <Link 
              href="/realtor/dashboard"
              className="flex items-center space-x-2 text-surface-bg/80 hover:text-surface-bg"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Dashboard</span>
            </Link>

            <div className="flex items-center space-x-3">
              <div className="bg-surface-bg/10 rounded-lg px-3 py-2">
                <div className="text-surface-bg font-semibold text-sm">{profile?.credits || 0} Credits</div>
              </div>
            </div>
          </div>
          
          <div className="text-surface-bg">
            <h1 className="text-2xl font-bold mb-2">
              Account Settings ⚙️
            </h1>
            <p className="text-surface-bg/80 text-sm">
              Manage your profile, billing, and preferences
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-4xl mx-auto">
        {/* Alert Messages */}
        {error && (
          <div className="mb-6 bg-accent-danger/10 border border-accent-danger/20 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-accent-danger" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-accent-danger font-medium">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-accent-success/10 border border-accent-success/20 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-accent-success" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-accent-success font-medium">{success}</p>
            </div>
          </div>
        )}

        {/* Modern Tabs */}
        <div className="mb-8">
          <div className="bg-surface-bg rounded-xl shadow-soft border border-neutral-border p-2">
            <nav className="flex space-x-1" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                  activeTab === 'profile'
                    ? 'bg-accent-primary text-surface-bg shadow-soft'
                    : 'text-secondary-text hover:text-primary-text hover:bg-neutral-hover'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <span>Profile</span>
              </button>
              <button
                onClick={() => setActiveTab('subscription')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                  activeTab === 'subscription'
                    ? 'bg-accent-primary text-surface-bg shadow-soft'
                    : 'text-secondary-text hover:text-primary-text hover:bg-neutral-hover'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                </svg>
                <span>Billing</span>
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                  activeTab === 'notifications'
                    ? 'bg-accent-primary text-surface-bg shadow-soft'
                    : 'text-secondary-text hover:text-primary-text hover:bg-neutral-hover'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
                <span>Alerts</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Information</h2>
            
            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={profile.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={profile.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                  />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={profile.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company/Brokerage *</label>
                  <input
                    type="text"
                    required
                    value={profile.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* License Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">License Information (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                  <input
                    type="text"
                    value={profile.licenseNumber || ''}
                    onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License State</label>
                  <select
                    value={profile.licenseState || ''}
                    onChange={(e) => handleInputChange('licenseState', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                  >
                    <option value="">Select State</option>
                    {['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'].map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Service Area */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Service Area</h3>
              <div className="relative mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Service City *</label>
                <input
                  type="text"
                  required
                  value={cityQuery}
                  onChange={(e) => {
                    setCityQuery(e.target.value);
                    if (!citySelected) {
                      setShowDropdown(true);
                    }
                    setCitySelected(false);
                  }}
                  onFocus={() => {
                    if (cityResults.length > 0) {
                      setShowDropdown(true);
                    }
                  }}
                  className={`w-full p-3 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium ${
                    citySelected ? 'border-green-500 bg-green-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter your primary service city"
                />
                
                {/* City Dropdown */}
                {cityResults.length > 0 && showDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-blue-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {cityResults.map((city, index) => (
                      <button
                        key={`${city.name}-${city.state}-${index}`}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          selectCity(city);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-green-50 focus:bg-green-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{city.name}, {city.state}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Service Radius Slider */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Service Radius: {profile.serviceRadius} miles
                </label>
                <div className="px-3">
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={profile.serviceRadius}
                    onChange={(e) => handleInputChange('serviceRadius', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>5 mi</span>
                    <span>25 mi</span>
                    <span>50 mi</span>
                    <span>100 mi</span>
                  </div>
                </div>
              </div>

              {/* Cities Within Service Radius */}
              {profile.primaryCity && profile.primaryState && (
                <div className="mt-6">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Cities Within Service Radius</h4>
                  <p className="text-sm text-gray-600 mb-4">Select additional cities within your {profile.serviceRadius}-mile radius where you want to receive leads</p>
                  
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="mb-3">
                      <p className="text-sm font-medium text-blue-900">Service Area: {profile.primaryCity}, {profile.primaryState}</p>
                      <p className="text-xs text-blue-600">Radius: {profile.serviceRadius} miles</p>
                    </div>
                    
                    {nearbyCities.length > 1 && (
                      <div className="mb-3">
                        <button
                          onClick={() => {
                            const allCityStrings = nearbyCities
                              .filter(city => !city.isCenter)
                              .map(city => `${city.name}, ${city.state}`);
                            
                            const allSelected = allCityStrings.every(cityStr => selectedServiceCities.includes(cityStr));
                            
                            if (allSelected) {
                              // Deselect all
                              setSelectedServiceCities([]);
                              if (profile) {
                                setProfile(prev => prev ? ({...prev, serviceCities: JSON.stringify([])}) : null);
                              }
                            } else {
                              // Select all
                              setSelectedServiceCities(allCityStrings);
                              if (profile) {
                                setProfile(prev => prev ? ({...prev, serviceCities: JSON.stringify(allCityStrings)}) : null);
                              }
                            }
                          }}
                          className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                        >
                          {(() => {
                            const allCityStrings = nearbyCities
                              .filter(city => !city.isCenter)
                              .map(city => `${city.name}, ${city.state}`);
                            const allSelected = allCityStrings.every(cityStr => selectedServiceCities.includes(cityStr));
                            return allSelected ? 'Deselect All' : 'Select All';
                          })()}
                        </button>
                      </div>
                    )}
                    
                    {loadingNearby ? (
                      <div className="text-sm text-blue-700">Loading nearby cities...</div>
                    ) : (
                      <div className="space-y-2">
                        {nearbyCities.map((city, index) => {
                          const cityString = `${city.name}, ${city.state}`;
                          const isSelected = selectedServiceCities.includes(cityString);
                          const isCenter = city.isCenter;
                          
                          return (
                            <label key={index} className="flex items-center space-x-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isCenter || isSelected}
                                disabled={isCenter}
                                onChange={(e) => {
                                  const newSelected = e.target.checked
                                    ? [...selectedServiceCities, cityString]
                                    : selectedServiceCities.filter(c => c !== cityString);
                                  setSelectedServiceCities(newSelected);
                                  if (profile) {
                                    setProfile(prev => prev ? ({...prev, serviceCities: JSON.stringify(newSelected)}) : null);
                                  }
                                }}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className={`text-sm ${isCenter ? 'font-medium text-blue-900' : 'text-blue-800'}`}>
                                {cityString} {isCenter ? '(Primary)' : city.distance ? `(${city.distance} mi)` : ''}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    
                    <p className="text-xs text-blue-600 mt-3 italic">
                      You&apos;ll receive buyer leads from selected cities within your service radius
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="pt-6 border-t">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Billing & Credits Tab */}
        {activeTab === 'subscription' && (
          <div className="space-y-6">
            {/* Current Status Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-accent-primary/10 to-accent-primary/5 border border-accent-primary/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-accent-primary/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-accent-primary">{profile.credits}</div>
                    <div className="text-sm text-secondary-text">Available</div>
                  </div>
                </div>
                <h3 className="font-semibold text-primary-text">Credits Balance</h3>
                <p className="text-sm text-secondary-text mt-1">Leads you can purchase</p>
              </div>
              
              <div className={`border rounded-xl p-6 ${
                profile.isOnTrial 
                  ? 'bg-gradient-to-br from-accent-success/10 to-accent-success/5 border-accent-success/20' 
                  : 'bg-surface-bg border-neutral-border'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    profile.isOnTrial ? 'bg-accent-success/10' : 'bg-neutral-border/50'
                  }`}>
                    <svg className={`w-6 h-6 ${profile.isOnTrial ? 'text-accent-success' : 'text-secondary-text'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-bold ${
                      profile.isOnTrial ? 'text-accent-success' : 
                      profile.subscription?.status === 'active' ? 'text-accent-primary' : 'text-secondary-text'
                    }`}>
                      {profile.isOnTrial ? 'Trial' : 
                       profile.subscription?.status === 'active' ? 'Pro' : 'Free'}
                    </div>
                  </div>
                </div>
                <h3 className="font-semibold text-primary-text">Current Plan</h3>
                {profile.isOnTrial && (
                  <p className="text-sm text-accent-success mt-1 font-medium">
                    {getTrialDaysRemaining()} days remaining
                  </p>
                )}
                {profile.subscription?.status === 'active' && (
                  <p className="text-sm text-secondary-text mt-1">
                    Renews {new Date(profile.subscription!.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="bg-gradient-to-br from-accent-warm/10 to-accent-warm/5 border border-accent-warm/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-accent-warm/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-accent-warm" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-accent-warm">0</div>
                    <div className="text-sm text-secondary-text">This Month</div>
                  </div>
                </div>
                <h3 className="font-semibold text-primary-text">Leads Purchased</h3>
                <p className="text-sm text-secondary-text mt-1">Leads bought this month</p>
              </div>
            </div>

            {/* Account Status */}
            <AccountStatus 
              profile={profile}
              setError={setError}
              setSuccess={setSuccess}
              setSaving={setSaving}
              loadProfile={loadProfile}
            />

            {/* Subscription Plans */}
            <div className="bg-surface-bg rounded-xl shadow-soft border border-neutral-border p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8">
                <div className="mb-4 lg:mb-0">
                  <h3 className="text-xl font-bold text-primary-text">Choose Your Plan</h3>
                  <p className="text-secondary-text mt-1">Select the plan that fits your business needs</p>
                </div>
                
                {/* Clean iOS-Style Toggle */}
                <div className="flex items-center space-x-3">
                  <span className={`text-sm font-medium transition-colors ${billingType === 'monthly' ? 'text-primary-text' : 'text-secondary-text'}`}>Monthly</span>
                  <button
                    onClick={() => setBillingType(billingType === 'monthly' ? 'annual' : 'monthly')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      billingType === 'annual' ? 'bg-accent-success' : 'bg-neutral-border'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-surface-bg transition-transform ${
                        billingType === 'annual' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium transition-colors ${billingType === 'annual' ? 'text-primary-text' : 'text-secondary-text'}`}>Annual</span>
                    <div className="bg-accent-success text-surface-bg text-xs font-bold px-2 py-1 rounded-full">
                      50% OFF
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.values(PRICING_TIERS).map((tier: PricingTier) => (
                  <div key={tier.id} className={`relative border rounded-xl p-6 transition-all hover:shadow-medium flex flex-col h-full ${
                    tier.id === 'professional' 
                      ? 'border-2 border-accent-primary bg-gradient-to-br from-accent-primary/5 to-accent-primary/10' 
                      : tier.isPayPerLead
                      ? 'border-accent-warm/30 bg-gradient-to-br from-accent-warm/5 to-accent-warm/10'
                      : 'border-neutral-border bg-surface-bg hover:border-accent-primary/30'
                  }`}>
                    {tier.id === 'professional' && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                        <span className="bg-accent-primary text-surface-bg text-xs px-3 py-1 rounded-full font-bold shadow-soft">
                          ⭐ Most Popular
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-primary-text text-lg">{tier.name}</h4>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        tier.isEnterprise ? 'bg-purple-100' :
                        tier.isPayPerLead ? 'bg-accent-warm/10' :
                        tier.id === 'professional' ? 'bg-accent-primary/10' :
                        'bg-accent-success/10'
                      }`}>
                        {tier.isEnterprise ? (
                          <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : tier.isPayPerLead ? (
                          <svg className="w-5 h-5 text-accent-warm" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-accent-success" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-6 min-h-[100px] flex flex-col justify-center">
                      {tier.isEnterprise ? (
                        <div>
                          <div className="text-3xl font-bold text-purple-600 mb-1">Custom</div>
                          <p className="text-sm text-secondary-text">Contact for pricing</p>
                        </div>
                      ) : tier.isPayPerLead ? (
                        <div>
                          <div className="text-3xl font-bold text-accent-warm mb-1">
                            {tier.id === 'customPropertyService' ? 'Custom' : `$${tier.monthlyPrice}`}
                          </div>
                          <p className="text-sm text-secondary-text">
                            {tier.id === 'customPropertyService' ? 'Service pricing' : 'per lead'}
                          </p>
                          {tier.id === 'payAsYouGo' && (
                            <p className="text-xs text-accent-warm/70 mt-1 font-medium">
                              One-time purchase
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          {billingType === 'annual' && (
                            <div className="text-lg text-secondary-text line-through mb-1">${tier.monthlyPrice}/month</div>
                          )}
                          <div className={`text-3xl font-bold mb-1 ${
                            billingType === 'annual' ? 'text-accent-success' : 'text-primary-text'
                          }`}>
                            ${billingType === 'annual' ? Math.round(tier.monthlyPrice * 0.5) : tier.monthlyPrice}
                          </div>
                          <p className={`text-sm font-medium ${
                            billingType === 'annual' ? 'text-accent-success' : 'text-secondary-text'
                          }`}>
                            {billingType === 'annual' ? '/month (billed annually)' : '/month'}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 mb-6">
                      <div className="space-y-3 min-h-[140px]">
                        {tier.features.map((feature, index) => (
                          <div key={index} className="flex items-start space-x-2">
                            <svg className="w-4 h-4 text-accent-success mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-secondary-text">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mt-auto">
                      <button 
                        className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                        tier.isEnterprise 
                          ? 'bg-purple-600 text-surface-bg hover:bg-purple-700 shadow-soft'
                          : tier.id === 'customPropertyService'
                          ? 'bg-accent-warm text-surface-bg hover:bg-accent-warm-hover shadow-soft'
                          : tier.stripePrice
                          ? tier.id === 'professional'
                            ? 'bg-accent-primary text-surface-bg hover:bg-accent-hover shadow-soft'
                            : 'bg-accent-success text-surface-bg hover:bg-accent-success/80 shadow-soft'
                          : 'bg-neutral-border text-secondary-text cursor-not-allowed'
                      }`}
                      onClick={() => handlePlanSelection(tier)}
                    >
                      {tier.isEnterprise 
                        ? '📞 Contact Sales'
                        : tier.id === 'customPropertyService'
                        ? '🛠️ Request Service'
                        : tier.isPayPerLead
                        ? '💳 Buy Credit'
                        : tier.stripePrice
                        ? '🚀 Subscribe Now'
                        : '⏳ Coming Soon'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Preferences</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">New Lead Alerts</h3>
                  <p className="text-sm text-gray-600">Get notified when new buyer leads become available</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Credit Low Warning</h3>
                  <p className="text-sm text-gray-600">Alert when credits are running low</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Weekly Summary</h3>
                  <p className="text-sm text-gray-600">Weekly report of your lead activity</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="pt-6 border-t">
              <button className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition-colors font-medium">
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}