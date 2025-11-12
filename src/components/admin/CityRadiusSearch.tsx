'use client';

import { useState, useEffect, useRef } from 'react';

interface CityCoordinates {
  lat: number;
  lng: number;
  city: string;
  state: string;
  formattedAddress: string;
}

interface CityRadiusSearchProps {
  onSearch: (cityData: CityCoordinates | null, radius: number, state: string | null) => void;
  className?: string;
}

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' }
];

export function CityRadiusSearch({ onSearch, className = '' }: CityRadiusSearchProps) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState(30); // Default 30 miles
  const [selectedCity, setSelectedCity] = useState<CityCoordinates | null>(null);
  const [selectedState, setSelectedState] = useState<string>('');
  const [searchType, setSearchType] = useState<'city' | 'state'>('city');

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  // Initialize Google Places services
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google) {
      autocompleteService.current = new google.maps.places.AutocompleteService();

      // Create a dummy div for PlacesService (required by Google API)
      const dummyDiv = document.createElement('div');
      placesService.current = new google.maps.places.PlacesService(dummyDiv);
    }
  }, []);

  // Load Google Maps script
  useEffect(() => {
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      script.onload = () => {
        autocompleteService.current = new google.maps.places.AutocompleteService();
        const dummyDiv = document.createElement('div');
        placesService.current = new google.maps.places.PlacesService(dummyDiv);
      };
    }
  }, []);

  // Search cities when query changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2 && autocompleteService.current) {
        searchCities(query);
      } else {
        setPredictions([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchCities = async (searchQuery: string) => {
    if (!autocompleteService.current) return;

    try {
      setLoading(true);

      autocompleteService.current.getPlacePredictions(
        {
          input: searchQuery,
          types: ['(cities)'],
          componentRestrictions: { country: 'us' } // Restrict to US cities
        },
        (predictions, status) => {
          setLoading(false);

          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setPredictions(predictions);
            setShowDropdown(true);
          } else {
            setPredictions([]);
            setShowDropdown(false);
          }
        }
      );
    } catch (error) {
      console.error('Error searching cities:', error);
      setLoading(false);
    }
  };

  const handleCitySelect = async (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService.current) return;

    setQuery(prediction.description);
    setShowDropdown(false);
    setLoading(true);

    // Get place details including coordinates
    placesService.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'address_components', 'formatted_address', 'name']
      },
      (place, status) => {
        setLoading(false);

        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          // Extract city and state from address components
          let city = '';
          let state = '';

          place.address_components?.forEach(component => {
            if (component.types.includes('locality')) {
              city = component.long_name;
            } else if (component.types.includes('administrative_area_level_1')) {
              state = component.short_name;
            }
          });

          const cityData: CityCoordinates = {
            lat: place.geometry?.location?.lat() || 0,
            lng: place.geometry?.location?.lng() || 0,
            city: city || place.name || '',
            state: state,
            formattedAddress: place.formatted_address || ''
          };

          setSelectedCity(cityData);
          setSearchType('city');
          onSearch(cityData, radius, null);
        }
      }
    );
  };

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    if (selectedCity && searchType === 'city') {
      onSearch(selectedCity, newRadius, null);
    }
  };

  const handleStateChange = (stateCode: string) => {
    setSelectedState(stateCode);
    setSearchType('state');
    setSelectedCity(null);
    setQuery('');
    onSearch(null, radius, stateCode);
  };

  const handleClearSearch = () => {
    setQuery('');
    setSelectedCity(null);
    setSelectedState('');
    setPredictions([]);
    setShowDropdown(false);
    setSearchType('city');
    onSearch(null, radius, null);
  };

  return (
    <div className={`bg-slate-800 rounded-lg p-6 ${className}`}>
      <div className="space-y-4">
        {/* Search Type Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setSearchType('city');
              setSelectedState('');
            }}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
              searchType === 'city'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            Search by City + Radius
          </button>
          <button
            onClick={() => {
              setSearchType('state');
              setSelectedCity(null);
              setQuery('');
            }}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
              searchType === 'state'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            Search by State
          </button>
        </div>

        {/* State Search */}
        {searchType === 'state' && (
          <div>
            <label className="block text-white mb-2 font-semibold">
              Select State
            </label>
            <select
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">All States</option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name} ({state.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* City Search */}
        {searchType === 'city' && (
          <div className="relative" ref={dropdownRef}>
            <label className="block text-white mb-2 font-semibold">
              Search by City
            </label>

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.length >= 2 && predictions.length > 0 && setShowDropdown(true)}
              className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Enter city name (e.g., Memphis, Dallas, Houston...)"
              autoComplete="off"
            />

            {loading && (
              <div className="absolute right-3 top-3.5">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-400"></div>
              </div>
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && predictions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {predictions.map((prediction) => (
                <button
                  key={prediction.place_id}
                  type="button"
                  onClick={() => handleCitySelect(prediction)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-600 focus:bg-slate-600 focus:outline-none border-b border-slate-600 last:border-b-0 text-white"
                >
                  <div className="font-medium">{prediction.structured_formatting.main_text}</div>
                  <div className="text-sm text-slate-400">{prediction.structured_formatting.secondary_text}</div>
                </button>
              ))}
            </div>
          )}
          </div>
        )}

        {/* Radius Slider - Only show for city search */}
        {searchType === 'city' && (
        <div>
          <label className="block text-white mb-2 font-semibold">
            Search Radius: <span className="text-emerald-400">{radius} miles</span>
          </label>

          <div className="flex items-center gap-4">
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={radius}
              onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
              className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />

            <div className="flex gap-2">
              {[10, 25, 50].map((value) => (
                <button
                  key={value}
                  onClick={() => handleRadiusChange(value)}
                  className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                    radius === value
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {value}mi
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>5 miles</span>
            <span>100 miles</span>
          </div>
        </div>
        )}

        {/* Selected Search Info & Clear Button */}
        {(selectedCity || selectedState) && (
          <div className="flex items-center justify-between bg-slate-700 rounded-lg p-3">
            <div className="text-white">
              {selectedCity && (
                <>
                  <div className="font-semibold">
                    {selectedCity.city}, {selectedCity.state}
                  </div>
                  <div className="text-sm text-slate-400">
                    Showing buyers within {radius} miles
                  </div>
                </>
              )}
              {selectedState && (
                <>
                  <div className="font-semibold">
                    {US_STATES.find(s => s.code === selectedState)?.name} ({selectedState})
                  </div>
                  <div className="text-sm text-slate-400">
                    Showing all buyers in this state
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleClearSearch}
              className="text-emerald-400 hover:text-emerald-300 font-semibold text-sm px-3 py-1 rounded hover:bg-slate-600 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
