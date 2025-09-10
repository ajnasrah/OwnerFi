'use client';

import { useEffect, useRef } from 'react';

// Extend window to include Google Maps
declare global {
  interface Window {
    google: typeof google;
    googleMapsLoaded?: Event;
  }
}

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (city: string) => void;
  label?: string;
  placeholder?: string;
}

export function GooglePlacesAutocomplete({ 
  value, 
  onChange, 
  label, 
  placeholder = "Type city name..." 
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    const initAutocomplete = () => {
      if (!inputRef.current || !window.google?.maps?.places) return;

      // Initialize Google Places Autocomplete
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['(cities)'],
        componentRestrictions: { country: 'US' }
      });

      // Listen for place selection
      const listener = autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.formatted_address) {
          // Extract city and state from formatted address
          const addressComponents = place.address_components;
          let city = '';
          let state = '';
          
          addressComponents?.forEach(component => {
            if (component.types.includes('locality')) {
              city = component.long_name;
            }
            if (component.types.includes('administrative_area_level_1')) {
              state = component.short_name;
            }
          });

          const fullCityName = state ? `${city}, ${state}` : city;
          onChange(fullCityName);
        }
      });

      return () => {
        if (listener) {
          google.maps.event.removeListener(listener);
        }
      };
    };

    if (window.google?.maps?.places) {
      initAutocomplete();
    } else {
      const handleLoad = () => initAutocomplete();
      window.addEventListener('googleMapsLoaded', handleLoad);
      return () => window.removeEventListener('googleMapsLoaded', handleLoad);
    }
  }, [onChange]);

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder={placeholder}
      />
    </div>
  );
}