'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ExtendedSession } from '@/types/session';
import { getCitiesWithinRadiusComprehensive } from '@/lib/comprehensive-cities';
import { GooglePlacesAutocomplete } from '@/components/ui/GooglePlacesAutocomplete';
import Link from 'next/link';
import { useFormTracking } from '@/components/analytics/AnalyticsProvider';

export default function RealtorSettings() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [targetCity, setTargetCity] = useState('');
  const [nearbyCities, setNearbyCities] = useState<Array<{name: string, state: string, distance: number}>>([]);
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [sessionCheckPaused, setSessionCheckPaused] = useState(false);
  const [currentSavedCities, setCurrentSavedCities] = useState<string[]>([]);
  const [loadingCurrentCities, setLoadingCurrentCities] = useState(true);

  // Form tracking
  const { trackFormStart, trackFormSubmit, trackFormSuccess, trackFormError } = useFormTracking('realtor_settings');

  // Auth check with session-safe handling
  useEffect(() => {
    // Don't redirect during Google Maps interactions
    if (sessionCheckPaused) return;

    if (status === 'unauthenticated') {
      router.replace('/auth');
    } else if (status === 'authenticated' && (session as unknown as ExtendedSession)?.user?.role !== 'realtor' && (session as unknown as ExtendedSession)?.user?.role !== 'admin') {
      router.replace('/auth');
    }
  }, [status, session, router, sessionCheckPaused]);

  // Pause session checks during form interactions
  useEffect(() => {
    const handleGoogleMapsInteraction = () => {
      setSessionCheckPaused(true);
      // Resume checks after 2 seconds
      setTimeout(() => setSessionCheckPaused(false), 2000);
    };

    window.addEventListener('googleMapsReady', handleGoogleMapsInteraction);
    return () => window.removeEventListener('googleMapsReady', handleGoogleMapsInteraction);
  }, []);

  // Fetch current saved cities
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      fetchCurrentCities();
    }
  }, [status, session]);

  const fetchCurrentCities = async () => {
    try {
      setLoadingCurrentCities(true);
      const response = await fetch('/api/realtor/profile');
      const data = await response.json();
      
      if (data.success) {
        setCurrentSavedCities(data.data.serviceCities || []);
        setTargetCity(data.data.targetCity || '');
      }
    } catch {
      // Failed to fetch current cities
    } finally {
      setLoadingCurrentCities(false);
    }
  };

  const handleRemoveCity = async (cityToRemove: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/realtor/profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityToRemove })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentSavedCities(data.updatedServiceCities);
        setError('');
        setSuccessMessage('City removed successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError('Failed to remove city');
      }
    } catch {
      setError('Failed to remove city');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111625]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00BC7D]"></div>
      </div>
    );
  }

  const handleCitySearch = () => {
    trackFormStart();
    if (!targetCity.trim()) {
      setError('Please enter a target city');
      setSuccessMessage('');
      return;
    }

    try {
      const cityParts = targetCity.split(',');
      const city = cityParts[0]?.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      const state = cityParts[1]?.trim().toUpperCase();
      if (!state) {
        setError('Please include the state (e.g. "Little Rock, AR")');
        setSuccessMessage('');
        return;
      }

      const cities = getCitiesWithinRadiusComprehensive(city, state, 30);
      setNearbyCities(cities);
      
      // Select all cities by default
      const allCityKeys = new Set(cities.map(city => `${city.name}, ${city.state}`));
      setSelectedCities(allCityKeys);
      
      setError('');
      setSuccessMessage('');
    } catch {
      setError('City not found. Please try again.');
      setSuccessMessage('');
    }
  };

  const selectAllCities = () => {
    const allCityKeys = new Set(nearbyCities.map(city => `${city.name}, ${city.state}`));
    setSelectedCities(allCityKeys);
  };

  const deselectAllCities = () => {
    setSelectedCities(new Set());
  };

  const handleCityToggle = (cityKey: string) => {
    const newSelected = new Set(selectedCities);
    if (newSelected.has(cityKey)) {
      newSelected.delete(cityKey);
    } else {
      newSelected.add(cityKey);
    }
    setSelectedCities(newSelected);
  };

  const handleSave = async () => {
    if (selectedCities.size === 0) {
      setError('Please select at least one city');
      trackFormError('no_cities_selected');
      return;
    }

    setLoading(true);
    setError('');
    trackFormSubmit();

    try {
      const response = await fetch('/api/realtor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetCity: targetCity,
          serviceCities: Array.from(selectedCities),
          totalCitiesServed: selectedCities.size
        })
      });

      if (response.ok) {
        trackFormSuccess({ cities_count: selectedCities.size });
        // Refresh the current cities list
        await fetchCurrentCities();
        // Clear the new cities selection
        setNearbyCities([]);
        setSelectedCities(new Set());
        setTargetCity('');
        setSuccessMessage('Cities saved successfully!');
        // Redirect to dashboard after successful save
        setTimeout(() => {
          router.push('/realtor-dashboard');
        }, 1500);
      } else {
        setError('Failed to save settings');
        trackFormError('save_failed');
      }
    } catch {
      setError('Failed to save settings');
      trackFormError('save_failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-[#111625] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 p-3 flex-shrink-0">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Link href="/realtor-dashboard" className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00BC7D"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs><circle cx="50" cy="50" r="45" stroke="url(#lg)" strokeWidth="7" fill="none"/><ellipse cx="50" cy="50" rx="42" ry="22" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/><ellipse cx="50" cy="50" rx="22" ry="42" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/></svg>
            <span className="text-base font-bold text-white">Ownerfi</span>
          </Link>
          <span className="text-slate-400 text-xs">Profile</span>
        </div>
      </header>

      {/* Main Content - Single Screen */}
      <div className="flex-1 px-4 py-2 max-w-md mx-auto w-full overflow-hidden flex flex-col">
        
        {/* Title */}
        <div className="text-center mb-3 flex-shrink-0">
          <h1 className="text-lg font-bold text-white mb-1">Service Area</h1>
          <p className="text-slate-300 text-xs">Set up your coverage area</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-2 mb-2 flex-shrink-0">
            <p className="text-red-300 text-xs">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-[#00BC7D]/20 border border-[#00BC7D]/30 rounded-lg p-2 mb-2 flex-shrink-0">
            <p className="text-[#00d68f] text-xs">{successMessage}</p>
          </div>
        )}

        {/* Current Saved Cities */}
        <div className="flex-shrink-0 mb-2">
          {loadingCurrentCities ? (
            <div>
              <h3 className="text-white font-medium mb-2 text-sm">Current Cities</h3>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00BC7D] mx-auto"></div>
                <p className="text-slate-400 text-xs mt-1">Loading...</p>
              </div>
            </div>
          ) : currentSavedCities.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-medium text-sm">
                  Current Cities ({currentSavedCities.length})
                </h3>
                <button
                  onClick={fetchCurrentCities}
                  className="text-[#00BC7D] hover:text-[#00d68f] text-xs font-medium"
                >
                  Refresh
                </button>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2 max-h-20 overflow-y-auto">
                <div className="space-y-1">
                  {[...currentSavedCities].sort().map((city) => (
                    <div
                      key={city}
                      className="flex items-center justify-between p-1 rounded hover:bg-slate-700/30 transition-colors"
                    >
                      <span className="text-white text-xs">{city}</span>
                      <button
                        onClick={() => handleRemoveCity(city)}
                        disabled={loading}
                        className="text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-white font-medium mb-2 text-sm">Current Cities</h3>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-center">
                <p className="text-slate-400 text-xs">No cities saved yet</p>
              </div>
            </div>
          )}
        </div>

        {/* Add New Cities */}
        <div className="flex-shrink-0 mb-2">
          <h3 className="text-white font-medium mb-2 text-sm">Add New Cities</h3>
          <label className="block text-xs font-medium text-white mb-1">Primary City</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <GooglePlacesAutocomplete
                value={targetCity}
                onChange={setTargetCity}
                placeholder="Dallas, TX"
              />
            </div>
            <button
              onClick={handleCitySearch}
              className="bg-[#00BC7D]/50 hover:bg-[#00BC7D] text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              Find
            </button>
          </div>
        </div>

        {/* Cities Selection */}
        {nearbyCities.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <h3 className="text-white font-medium text-sm">
                Select Cities ({selectedCities.size} selected)
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAllCities}
                  className="text-[#00BC7D] hover:text-[#00d68f] text-xs font-medium"
                >
                  All
                </button>
                <span className="text-slate-400">|</span>
                <button
                  onClick={deselectAllCities}
                  className="text-slate-400 hover:text-white text-xs font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2 flex-1 overflow-y-auto">
              <div className="space-y-1">
                {nearbyCities.map((city) => {
                  const cityKey = `${city.name}, ${city.state}`;
                  const isSelected = selectedCities.has(cityKey);
                  
                  return (
                    <label
                      key={cityKey}
                      className="flex items-center justify-between p-1 rounded cursor-pointer hover:bg-slate-700/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleCityToggle(cityKey)}
                          className="w-3 h-3 text-[#00BC7D] bg-slate-700 border-slate-600 rounded focus:ring-[#00BC7D] focus:ring-1"
                        />
                        <span className="text-white text-xs">{city.name}, {city.state}</span>
                      </div>
                      <span className="text-slate-400 text-xs">{city.distance.toFixed(1)} mi</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex-shrink-0 space-y-2 pt-2">
          {nearbyCities.length > 0 && (
            <button
              onClick={handleSave}
              disabled={loading || selectedCities.size === 0}
              className="w-full bg-[#00BC7D]/50 hover:bg-[#00BC7D] disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
            >
              {loading 
                ? 'Saving...' 
                : selectedCities.size === 0 
                  ? 'Select cities to save' 
                  : `Save ${selectedCities.size} Cities`
              }
            </button>
          )}
          
          <Link
            href="/realtor-dashboard"
            className="block w-full text-center text-slate-400 hover:text-white py-1 transition-colors text-xs"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}