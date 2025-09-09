'use client';

import { useState, useEffect, useRef } from 'react';

interface City {
  name: string;
  state: string;
  displayName: string;
}

interface CityAutocompleteProps {
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

export function CityAutocomplete({ 
  value, 
  onChange, 
  placeholder = "Enter city name", 
  className = "",
  label 
}: CityAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [cities, setCities] = useState<City[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update query when value prop changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Search cities when query changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        searchCities(query);
      } else {
        setCities([]);
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
    try {
      setLoading(true);
      
      // Use Google Places API for city autocomplete
      const response = await fetch('/api/cities/search', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const data = await response.json();
        const filtered = data
          .filter((city: any) => 
            city.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            city.description?.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((city: any) => ({
            name: city.name || city.description,
            state: city.state || '',
            displayName: city.description || city.name
          }))
          .slice(0, 8);
        
        setCities(filtered);
        setShowDropdown(filtered.length > 0);
      }
    } catch (error) {
      console.error('City search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
  };

  const handleCitySelect = (city: City) => {
    setQuery(city.name);
    onChange(city.name);
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setCities.length > 0 && setShowDropdown(true)}
          className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
          placeholder={placeholder}
          autoComplete="off"
        />
        
        {loading && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && cities.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {cities.map((city, index) => (
            <button
              key={`${city.name}-${index}`}
              type="button"
              onClick={() => handleCitySelect(city)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">{city.name}</div>
              {city.state && (
                <div className="text-sm text-gray-500">{city.state}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}