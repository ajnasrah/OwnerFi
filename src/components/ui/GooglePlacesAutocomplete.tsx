'use client';

import React, { useEffect, useRef, useState } from 'react';

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
  const [mapsLoadError, setMapsLoadError] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Check if Google Maps API key is available
  const hasGoogleMapsKey = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    const initAutocomplete = () => {
      try {
        if (!inputRef.current || !window.google?.maps?.places) {
          return;
        }

        // Clear any existing autocomplete
        if (autocompleteRef.current) {
          google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }

        // Initialize Google Places Autocomplete
        autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ['(cities)'],
          componentRestrictions: { country: 'US' }
        });

        // Prevent autocomplete from interfering with React's input handling
        autocompleteRef.current.set('strictBounds', false);
        setMapsLoaded(true);
        setMapsLoadError(false);
        setIsLoading(false);

        // Listen for place selection with session isolation
        const listener = autocompleteRef.current.addListener('place_changed', () => {
          try {
            const place = autocompleteRef.current?.getPlace();
            if (place?.formatted_address && place?.address_components) {
              // Extract city and state from formatted address
              const addressComponents = place.address_components;
              let city = '';
              let state = '';
              
              addressComponents.forEach(component => {
                if (component.types.includes('locality')) {
                  city = component.long_name;
                }
                if (component.types.includes('administrative_area_level_1')) {
                  state = component.short_name;
                }
              });

              const fullCityName = state ? `${city}, ${state}` : city;
              
              // CRITICAL: Isolate from session validation by using async microtask
              Promise.resolve().then(() => {
                React.startTransition(() => {
                  onChange(fullCityName);
                });
              });
            }
          } catch (error) {
            console.error('Place selection error:', error);
          }
        });

        return () => {
          if (listener) {
            google.maps.event.removeListener(listener);
          }
        };
      } catch (error) {
        console.error('Autocomplete initialization failed:', error);
        setMapsLoadError(true);
        setIsLoading(false);
      }
    };

    // Handle Google Maps state changes
    const handleMapsReady = () => {
      initAutocomplete();
    };

    const handleMapsError = () => {
      setIsLoading(false);
      setMapsLoadError(true);
    };

    // Check current Google Maps state
    const mapsState = (window as Window & { googleMapsState?: { loaded?: boolean; error?: boolean } }).googleMapsState;
    if (mapsState?.loaded && window.google?.maps?.places) {
      handleMapsReady();
    } else if (mapsState?.error) {
      handleMapsError();
    } else {
      // Listen for loading events
      window.addEventListener('googleMapsReady', handleMapsReady);
      window.addEventListener('googleMapsError', handleMapsError);
      
      return () => {
        window.removeEventListener('googleMapsReady', handleMapsReady);
        window.removeEventListener('googleMapsError', handleMapsError);
        if (autocompleteRef.current) {
          google.maps.event.clearInstanceListeners(autocompleteRef.current);
          autocompleteRef.current = null;
        }
      };
    }

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, []);

  // Handle manual input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-white mb-2">
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          className="w-full px-4 py-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-white placeholder-slate-400 font-normal"
          placeholder={isLoading ? "Loading maps..." : placeholder}
          disabled={isLoading}
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>
      
      {mapsLoadError && (
        <div className="mt-1 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
          <p className="text-orange-800 font-medium">
            🗺️ Maps autocomplete unavailable
          </p>
          <p className="text-orange-600 text-xs mt-1">
            You can still type city names manually (e.g., "Dallas, TX")
          </p>
        </div>
      )}
      
      {mapsLoaded && !mapsLoadError && (
        <p className="mt-1 text-xs text-green-600">
          ✓ Maps autocomplete ready
        </p>
      )}
    </div>
  );
}