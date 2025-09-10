'use client';

import { useState, useEffect } from 'react';

interface SimpleCitySelectProps {
  value: string;
  onChange: (city: string) => void;
  label?: string;
}

const AVAILABLE_CITIES = [
  'Anthem', 'Arlington', 'Atlanta', 'Bishop', 'Bradenton', 'Brooksville', 'Casa Grande',
  'Corpus Christi', 'Crestview', 'Dallas', 'Decatur', 'Delray Beach', 'Denton', 
  'Dunnellon', 'Edinburg', 'El Paso', 'Floresville', 'Fort Worth', 'Georgetown',
  'Golden Valley', 'Granbury', 'Horizon City', 'Houston', 'Inverness', 'Iva',
  'Jacksonville', 'Killeen', 'La Feria', 'La Vernia', 'Leesburg', 'Lynn Haven',
  'Mary Esther', 'McAllen', 'Mesa', 'Miami', 'Milton', 'New Port Richey', 'Ocala',
  'Orlando', 'Palatka', 'Panama City', 'Pensacola', 'Pharr', 'Richlands', 'Rio Rico',
  'San Angelo', 'San Antonio', 'Sandy Springs', 'Seguin', 'Socorro', 'St. Augustine',
  'St. Petersburg', 'Stuart', 'Surfside Beach', 'Tempe', 'Union City', 'Woodstock'
];

export function SimpleCitySelect({ value, onChange, label }: SimpleCitySelectProps) {
  const [query, setQuery] = useState(value);
  const [filteredCities, setFilteredCities] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (query.length >= 1) {
      const filtered = AVAILABLE_CITIES.filter(city =>
        city.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8);
      
      setFilteredCities(filtered);
      setShowDropdown(filtered.length > 0);
    } else {
      setFilteredCities([]);
      setShowDropdown(false);
    }
  }, [query]);

  const handleSelect = (city: string) => {
    setQuery(city);
    onChange(city);
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.length >= 1 && setShowDropdown(true)}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Type city name..."
        autoComplete="off"
      />

      {showDropdown && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredCities.map(city => (
            <button
              key={city}
              type="button"
              onClick={() => handleSelect(city)}
              className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
            >
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}