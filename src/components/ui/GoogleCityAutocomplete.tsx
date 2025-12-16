'use client';

import { useState, useEffect, useRef } from 'react';

interface GoogleCityAutocompleteProps {
  value: string;
  onChange: (city: string) => void;
  label?: string;
  placeholder?: string;
}

export function GoogleCityAutocomplete({ value, onChange, label, placeholder = "Type city name..." }: GoogleCityAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        searchCities(query);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

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
      
      const response = await fetch(`/api/cities/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const cityNames = data
          .filter(place => place.description)
          .map(place => place.description)
          .slice(0, 8);
        
        setSuggestions(cityNames);
        setShowDropdown(cityNames.length > 0);
      }
    } catch (error) {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (cityName: string) => {
    setQuery(cityName);
    onChange(cityName);
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      handleSelect(suggestions[0]);
    }
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
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && suggestions.length > 0 && setShowDropdown(true)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={placeholder}
          autoComplete="off"
        />
        
        {loading && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">{suggestion}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}