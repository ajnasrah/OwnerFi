/**
 * Unified Matching Service for Both Buyers and Realtors
 * 
 * ARCHITECTURE:
 * 1. Setup Phase: User selects center city + radius → saves serviceCities to profile
 * 2. Matching Phase: Uses saved serviceCities for instant matching
 * 3. Dashboard Phase: No API calls, just reads from profile
 */

import { 
  collection, 
  query, 
  where, 
  getDocs,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from './firebase';

// === INTERFACES ===

export interface UserLocation {
  centerCity: string;
  centerState: string;
  searchRadius: number;
  serviceCities: string[]; // Pre-calculated cities within radius
}

export interface BuyerProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: UserLocation;
  budget: {
    maxMonthlyPayment: number;
    maxDownPayment: number;
    minPrice?: number;
    maxPrice?: number;
  };
  requirements: {
    minBedrooms?: number;
    minBathrooms?: number;
    minSquareFeet?: number;
  };
  languages?: string[];
}

export interface RealtorProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  licenseNumber?: string;
  licenseState?: string;
  location: UserLocation;
  credits: number;
  isOnTrial: boolean;
  trialEndDate?: string;
}

export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  listPrice: number;
  downPaymentAmount: number;
  monthlyPayment: number;
  interestRate: number;
  termYears: number;
  isActive: boolean;
  imageUrl?: string;
  description?: string;
}

export interface MatchResult {
  score: number;
  reasons: {
    location: boolean;
    budget: boolean;
    requirements: boolean;
  };
}

// === MAIN SERVICE ===

export class UnifiedMatchingService {

  // === CITY MANAGEMENT ===

  /**
   * Search cities for autocomplete (external API with fallback)
   */
  static async searchCities(query: string, limit = 10): Promise<any[]> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', USA')}&format=json&addressdetails=1&limit=${limit}&countrycodes=us`,
        {
          headers: { 'User-Agent': 'OwnerFi Platform v1.0' },
          signal: AbortSignal.timeout(5000)
        }
      );

      if (!response.ok) throw new Error('API failed');

      const data = await response.json();
      
      return data
        .filter((item: any) => 
          item.address?.state && 
          (item.address?.city || item.address?.town || item.address?.village)
        )
        .map((item: any) => ({
          name: item.address.city || item.address.town || item.address.village,
          state: this.getStateAbbr(item.address.state),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }))
        .slice(0, limit);

    } catch (error) {
      console.warn('External city search failed, using basic fallback');
      
      // Basic fallback for major cities only
      const majorCities = [
        { name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
        { name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
        { name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
        { name: 'Memphis', state: 'TN', lat: 35.1495, lng: -90.0490 },
        { name: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816 },
        { name: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880 },
        { name: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918 },
        { name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 }
      ];
      
      return majorCities.filter(city => 
        city.name.toLowerCase().includes(query.toLowerCase())
      );
    }
  }

  /**
   * Get cities within radius of center city (external API call)
   * This is called ONCE during setup/settings and saved to profile
   */
  static async getCitiesWithinRadius(
    centerLat: number, 
    centerLng: number, 
    radiusMiles: number
  ): Promise<string[]> {
    
    try {
      // Convert miles to degrees for bounding box
      const radiusDeg = radiusMiles * 0.015;
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=100&countrycodes=us&q=city&bounded=1&viewbox=${centerLng-radiusDeg},${centerLat+radiusDeg},${centerLng+radiusDeg},${centerLat-radiusDeg}`,
        {
          headers: { 'User-Agent': 'OwnerFi Platform v1.0' },
          signal: AbortSignal.timeout(10000)
        }
      );

      if (!response.ok) throw new Error('API failed');

      const data = await response.json();
      
      const cities = data
        .filter((item: any) => 
          item.address?.state && 
          (item.address?.city || item.address?.town || item.address?.village)
        )
        .map((item: any) => {
          const cityName = item.address.city || item.address.town || item.address.village;
          const distance = this.haversineDistance(
            centerLat, centerLng,
            parseFloat(item.lat), parseFloat(item.lon)
          );
          return { name: cityName, distance };
        })
        .filter(city => city.distance <= radiusMiles)
        .sort((a, b) => a.distance - b.distance)
        .map(city => city.name);

      return [...new Set(cities)]; // Remove duplicates

    } catch (error) {
      console.warn('External radius search failed, using center city only');
      // Return just the center city if API fails
      return ['Center City']; // Will be replaced with actual center city name
    }
  }

  // === PROPERTY MATCHING ===

  /**
   * Find properties for buyer criteria
   */
  static async findPropertiesForBuyer(
    buyerLocation: UserLocation,
    budget: { maxMonthlyPayment: number; maxDownPayment: number; },
    requirements: { minBedrooms?: number; minBathrooms?: number; }
  ): Promise<Property[]> {
    
    const properties = await this.getAllProperties();
    
    return properties.filter(property => {
      // Location match: property city must be in buyer's service cities
      const locationMatch = buyerLocation.serviceCities.some(serviceCity =>
        property.city.toLowerCase() === serviceCity.toLowerCase() &&
        property.state === buyerLocation.centerState
      );
      
      // Budget match
      const budgetMatch = 
        property.monthlyPayment <= budget.maxMonthlyPayment &&
        property.downPaymentAmount <= budget.maxDownPayment;
      
      // Requirements match
      const requirementsMatch = 
        (!requirements.minBedrooms || property.bedrooms >= requirements.minBedrooms) &&
        (!requirements.minBathrooms || property.bathrooms >= requirements.minBathrooms);
      
      return locationMatch && budgetMatch && requirementsMatch;
    });
  }

  /**
   * Find buyers for realtor's service area
   */
  static async findBuyersForRealtor(
    realtorLocation: UserLocation
  ): Promise<any[]> {
    
    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('preferredState', '==', realtorLocation.centerState),
      firestoreLimit(100)
    );
    const buyerDocs = await getDocs(buyersQuery);
    
    const buyers = [];
    
    for (const doc of buyerDocs.docs) {
      const buyerData = doc.data();
      
      // Location match: buyer's preferred city must be in realtor's service cities
      const locationMatch = realtorLocation.serviceCities.some(serviceCity =>
        buyerData.preferredCity?.toLowerCase() === serviceCity.toLowerCase()
      );
      
      if (locationMatch) {
        // Calculate property matches for this buyer
        const properties = await this.findPropertiesForBuyer(
          {
            centerCity: buyerData.preferredCity,
            centerState: buyerData.preferredState,
            searchRadius: buyerData.searchRadius || 25,
            serviceCities: [buyerData.preferredCity] // Use their preferred city
          },
          {
            maxMonthlyPayment: buyerData.maxMonthlyPayment || 0,
            maxDownPayment: buyerData.maxDownPayment || 0
          },
          {
            minBedrooms: buyerData.minBedrooms,
            minBathrooms: buyerData.minBathrooms
          }
        );
        
        buyers.push({
          id: doc.id,
          ...buyerData,
          matchedProperties: properties.length,
          exactCityMatches: properties.filter(p => 
            p.city.toLowerCase() === buyerData.preferredCity?.toLowerCase()
          ).length,
          nearbyMatches: properties.filter(p => 
            p.city.toLowerCase() !== buyerData.preferredCity?.toLowerCase()
          ).length
        });
      }
    }
    
    return buyers.sort((a, b) => b.matchedProperties - a.matchedProperties);
  }

  // === UTILITY METHODS ===

  /**
   * Get all active properties
   */
  private static async getAllProperties(): Promise<Property[]> {
    const propertiesQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      firestoreLimit(5000)
    );
    
    const snapshot = await getDocs(propertiesQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
  }

  /**
   * Calculate distance between coordinates
   */
  private static haversineDistance(
    lat1: number, lng1: number, lat2: number, lng2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convert state name to abbreviation
   */
  private static getStateAbbr(stateName: string): string {
    const stateMap: Record<string, string> = {
      'Texas': 'TX', 'Tennessee': 'TN', 'Florida': 'FL', 'Georgia': 'GA',
      'California': 'CA', 'Arizona': 'AZ', 'Colorado': 'CO', 'Nevada': 'NV',
      'Illinois': 'IL', 'New York': 'NY', 'North Carolina': 'NC'
    };
    
    return stateMap[stateName] || stateName.substring(0, 2).toUpperCase();
  }
}

export default UnifiedMatchingService;