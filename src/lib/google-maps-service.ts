// Google Maps integration for address parsing and Street View images

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
 */
export async function parseAddress(fullAddress: string): Promise<AddressParsingResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: 'Google Maps API key not configured' };
  }

  try {
    const encodedAddress = encodeURIComponent(fullAddress.trim());
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return { 
        success: false, 
        error: `Google Maps could not parse address: ${data.status}` 
      };
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
    components.forEach((component: any) => {
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
      return { 
        success: false, 
        error: 'Could not extract city and state from address' 
      };
    }

    return {
      success: true,
      address: addressData as ParsedAddress
    };

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
    console.warn('Google Maps API key not configured for Street View images');
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
export function getStreetViewImageByAddress(address: string, options = {}): string {
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
  const result: any = {};

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
      result.streetViewImageUrl = getStreetViewImage(
        result.parsedAddress.latitude,
        result.parsedAddress.longitude,
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