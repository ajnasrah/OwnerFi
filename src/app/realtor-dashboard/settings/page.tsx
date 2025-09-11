'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCitiesWithinRadiusComprehensive } from '@/lib/comprehensive-cities';
import { GooglePlacesAutocomplete } from '@/components/ui/GooglePlacesAutocomplete';

export default function RealtorSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [targetCity, setTargetCity] = useState('');
  const [nearbyCities, setNearbyCities] = useState<Array<{name: string, state: string, distance: number}>>([]);
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());

  const handleCitySearch = () => {
    if (!targetCity.trim()) {
      setError('Please enter a target city');
      return;
    }

    try {
      // Parse city and state
      const cityParts = targetCity.split(',');
      const city = cityParts[0]?.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase()); // Proper case
      const state = cityParts[1]?.trim().toUpperCase() || 'TX';

      
      // Get cities within 30 miles
      const cities = getCitiesWithinRadiusComprehensive(city, state, 30);
      
      
      setNearbyCities(cities);
      
      // Select all cities by default
      const allCityNames = cities.map(c => `${c.name}, ${c.state}`);
      setSelectedCities(new Set(allCityNames));
      
      setError('');
      
    } catch (err) {
      setError('Failed to find nearby cities. Please check city format (e.g., "Dallas, TX")');
    }
  };

  const toggleCity = (cityName: string, state: string) => {
    const fullName = `${cityName}, ${state}`;
    const newSelected = new Set(selectedCities);
    
    if (newSelected.has(fullName)) {
      newSelected.delete(fullName);
    } else {
      newSelected.add(fullName);
    }
    
    setSelectedCities(newSelected);
  };

  const selectAll = () => {
    const allCityNames = nearbyCities.map(c => `${c.name}, ${c.state}`);
    setSelectedCities(new Set(allCityNames));
  };

  const deselectAll = () => {
    setSelectedCities(new Set());
  };

  const saveSettings = async () => {
    if (selectedCities.size === 0) {
      setError('Please select at least one city to serve');
      return;
    }

    setLoading(true);
    
    try {
      // Save realtor service areas
      const response = await fetch('/api/realtor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetCity: targetCity,
          serviceCities: Array.from(selectedCities),
          totalCitiesServed: selectedCities.size
        })
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        // Force redirect using window.location to ensure it works
        window.location.href = '/realtor-dashboard';
      }
      
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Realtor Settings</h1>
          <p className="text-gray-600">Set up your service areas to connect with local buyers</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Target City Input */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Target City</h2>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <GooglePlacesAutocomplete
                value={targetCity}
                onChange={setTargetCity}
                placeholder="Dallas, TX"
              />
            </div>
            <button
              onClick={handleCitySearch}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Find Nearby Cities
            </button>
          </div>
          
          <p className="text-sm text-gray-500 mt-2">
            Enter your primary city to find all cities within 30 miles
          </p>
        </div>

        {/* Cities Selection */}
        {nearbyCities.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Service Areas ({selectedCities.size} of {nearbyCities.length} selected)
              </h2>
              
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="bg-green-100 text-green-700 px-4 py-2 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Deselect All
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
              {nearbyCities.map((city) => {
                const fullName = `${city.name}, ${city.state}`;
                const isSelected = selectedCities.has(fullName);
                
                return (
                  <label
                    key={fullName}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-green-50 border-green-300' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCity(city.name, city.state)}
                      className="mr-3 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{city.name}</div>
                      <div className="text-xs text-gray-500">{city.distance.toFixed(1)} miles</div>
                    </div>
                  </label>
                );
              })}
            </div>
            
            {/* Save Button */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={saveSettings}
                disabled={loading || selectedCities.size === 0}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : `Save Service Areas (${selectedCities.size} cities)`}
              </button>
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/realtor-dashboard')}
            className="text-gray-600 hover:text-gray-800"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}