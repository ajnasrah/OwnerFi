// Google Maps integration for address parsing and Street View images

import { getFirestore, collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

// Initialize Firebase client if not already initialized
function getFirebaseClient() {
  if (getApps().length === 0) {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
    initializeApp(firebaseConfig);
  }
  return getFirestore();
}

export interface ParsedAddress {
  streetNumber: string;
  streetName: string;
  fullStreetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export interface AddressParsingResult {
  success: boolean;
  address?: ParsedAddress;
  error?: string;
}

/**
 * Parse a full address string into components using Google Geocoding API
 * Now with Firestore caching to prevent duplicate API calls (addresses never change)
 */
export async function parseAddress(fullAddress: string): Promise<AddressParsingResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return { success: false, error: 'Google Maps API key not configured' };
  }

  try {
    const normalizedAddress = fullAddress.trim().toLowerCase();
    const cacheKey = Buffer.from(normalizedAddress).toString('base64').replace(/[/+=]/g, '_').substring(0, 100);

    // Check cache first (Firestore collection: geocoding_cache)
    try {
      const db = getFirebaseClient();
      const cacheRef = doc(db, 'geocoding_cache', cacheKey);
      const cachedDoc = await getDoc(cacheRef);

      if (cachedDoc.exists()) {
        const cached = cachedDoc.data();
        console.log(`✅ [Google Maps] Cache HIT for: ${fullAddress.substring(0, 50)}...`);

        return {
          success: cached.success,
          address: cached.address,
          error: cached.error
        };
      }

      console.log(`🔍 [Google Maps] Cache MISS for: ${fullAddress.substring(0, 50)}... (calling API)`);
    } catch (cacheError) {
      console.warn('⚠️  Failed to check geocoding cache:', cacheError);
      // Continue to API call if cache fails
    }

    const encodedAddress = encodeURIComponent(fullAddress.trim());
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      const errorResult = {
        success: false,
        error: `Google Maps could not parse address: ${data.status}`
      };

      // Cache the error result (no need to retry failed addresses)
      try {
        const db = getFirebaseClient();
        const cacheRef = doc(db, 'geocoding_cache', cacheKey);
        await setDoc(cacheRef, {
          ...errorResult,
          originalAddress: fullAddress,
          cachedAt: new Date().toISOString(),
        });
      } catch (cacheError) {
        console.warn('⚠️  Failed to cache geocoding error:', cacheError);
      }

      return errorResult;
    }

    const result = data.results[0];
    const components = result.address_components;
    const geometry = result.geometry;

    // Extract address components
    const addressData: Partial<ParsedAddress> = {
      latitude: geometry.location.lat,
      longitude: geometry.location.lng,
      formattedAddress: result.formatted_address
    };

    // Parse components
    components.forEach((component: { types: string[], long_name: string, short_name: string }) => {
      const types = component.types;

      if (types.includes('street_number')) {
        addressData.streetNumber = component.long_name;
      }
      if (types.includes('route')) {
        addressData.streetName = component.long_name;
      }
      if (types.includes('locality')) {
        addressData.city = component.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        addressData.state = component.short_name;
      }
      if (types.includes('postal_code')) {
        addressData.zipCode = component.long_name;
      }
      if (types.includes('administrative_area_level_2')) {
        addressData.county = component.long_name;
      }
    });

    // Construct full street address
    addressData.fullStreetAddress = `${addressData.streetNumber || ''} ${addressData.streetName || ''}`.trim();

    // Validate we got the essential components
    if (!addressData.city || !addressData.state) {
      const errorResult = {
        success: false,
        error: 'Could not extract city and state from address'
      };

      // Cache the error
      try {
        const db = getFirebaseClient();
        const cacheRef = doc(db, 'geocoding_cache', cacheKey);
        await setDoc(cacheRef, {
          ...errorResult,
          originalAddress: fullAddress,
          cachedAt: new Date().toISOString(),
        });
      } catch (cacheError) {
        console.warn('⚠️  Failed to cache geocoding error:', cacheError);
      }

      return errorResult;
    }

    const successResult = {
      success: true,
      address: addressData as ParsedAddress
    };

    // Cache the successful result (addresses never change, so cache forever)
    try {
      const db = getFirebaseClient();
      const cacheRef = doc(db, 'geocoding_cache', cacheKey);
      await setDoc(cacheRef, {
        ...successResult,
        originalAddress: fullAddress,
        cachedAt: new Date().toISOString(),
      });
      console.log(`💾 [Google Maps] Cached result for: ${fullAddress.substring(0, 50)}...`);
    } catch (cacheError) {
      console.warn('⚠️  Failed to cache geocoding result:', cacheError);
    }

    return successResult;

  } catch (error) {
    return {
      success: false,
      error: `Address parsing failed: ${(error as Error).message}`
    };
  }
}

/**
 * Generate Google Street View image URL for a property
 */
export function getStreetViewImage(
  latitude: number, 
  longitude: number, 
  options: {
    size?: string;
    fov?: number;
    heading?: number;
    pitch?: number;
  } = {}
): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    return '';
  }

  const {
    size = '640x400',
    fov = 90,
    heading = 0,
    pitch = 0
  } = options;

  return `https://maps.googleapis.com/maps/api/streetview?` +
    `size=${size}&` +
    `location=${latitude},${longitude}&` +
    `heading=${heading}&` +
    `fov=${fov}&` +
    `pitch=${pitch}&` +
    `key=${apiKey}`;
}

/**
 * Generate Street View image URL from address string
 */
export function getStreetViewImageByAddress(address: string, options: {
  size?: string;
  fov?: number;
  heading?: number;
  pitch?: number;
} = {}): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    return '';
  }

  const {
    size = '640x400',
    fov = 90,
    heading = 0,
    pitch = 0
  } = options;

  const encodedAddress = encodeURIComponent(address);
  
  return `https://maps.googleapis.com/maps/api/streetview?` +
    `size=${size}&` +
    `location=${encodedAddress}&` +
    `heading=${heading}&` +
    `fov=${fov}&` +
    `pitch=${pitch}&` +
    `key=${apiKey}`;
}

/**
 * Enhanced property processing with Google Maps integration
 */
export async function enhancePropertyWithGoogleMaps(property: {
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  imageUrl?: string;
}): Promise<{
  parsedAddress?: ParsedAddress;
  streetViewImageUrl?: string;
  enhancedImageUrl?: string;
}> {
  const result: Record<string, unknown> = {};

  // Parse address if city/state/zip are missing or incomplete
  if (!property.city || !property.state || !property.zipCode) {
    const parseResult = await parseAddress(property.address);
    if (parseResult.success && parseResult.address) {
      result.parsedAddress = parseResult.address;
    }
  }

  // Generate Street View image if no image URL provided
  if (!property.imageUrl) {
    if (result.parsedAddress) {
      // Use coordinates from parsed address
      const addr = result.parsedAddress as { latitude: number; longitude: number };
      result.streetViewImageUrl = getStreetViewImage(
        addr.latitude,
        addr.longitude,
        { size: '800x500', fov: 90, heading: 0, pitch: 10 }
      );
    } else {
      // Use address string directly
      result.streetViewImageUrl = getStreetViewImageByAddress(
        property.address,
        { size: '800x500', fov: 90, heading: 0, pitch: 10 }
      );
    }
    
    result.enhancedImageUrl = result.streetViewImageUrl;
  } else {
    result.enhancedImageUrl = property.imageUrl;
  }

  return result;
}

/**
 * Batch process multiple addresses (with rate limiting)
 */
export async function batchParseAddresses(
  addresses: string[], 
  delayMs: number = 100
): Promise<AddressParsingResult[]> {
  const results: AddressParsingResult[] = [];
  
  for (const address of addresses) {
    const result = await parseAddress(address);
    results.push(result);
    
    // Rate limiting to avoid hitting API limits
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}