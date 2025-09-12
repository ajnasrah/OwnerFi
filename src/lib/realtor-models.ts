// NEW REALTOR SYSTEM - Single source of truth
// All realtor data embedded in user document for performance

import { Timestamp } from 'firebase/firestore';

// Google Places result for city validation
export interface GooglePlace {
  place_id: string;
  formatted_address: string;
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

// Standardized city data from Google Places
export interface ValidatedCity {
  name: string;          // "Dallas"
  state: string;         // "Texas" 
  stateCode: string;     // "TX"
  placeId: string;       // Google Places ID for consistency
  coordinates: {
    lat: number;
    lng: number;
  };
  formattedAddress: string; // "Dallas, TX, USA"
}

// Service area with nearby cities within 30 miles
export interface ServiceArea {
  primaryCity: ValidatedCity;
  nearbyCities: ValidatedCity[];
  radiusMiles: number;          // Always 30 miles
  totalCitiesServed: number;    // primaryCity + nearbyCities.length
  lastUpdated: Timestamp;
  setupRequired?: boolean;      // Optional flag for incomplete setup
}

// Embedded realtor data structure (stored in users document)
export interface RealtorData {
  // Basic info from registration
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  
  // Service area (Google-validated)
  serviceArea: ServiceArea;
  
  // Business info
  company?: string;
  licenseNumber?: string;
  
  // System fields
  isActive: boolean;
  profileComplete: boolean;
  
  // Trial and credits
  credits: number;
  isOnTrial: boolean;
  trialStartDate: Timestamp;
  trialEndDate: Timestamp;
  
  // Stripe integration
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Enhanced user model with embedded realtor data
export interface UserWithRealtorData {
  id: string;
  email: string;
  role: 'buyer' | 'realtor' | 'admin';
  
  // Embedded realtor data (only exists if role === 'realtor')
  realtorData?: RealtorData;
  
  // Standard user fields
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// City search request/response
export interface CitySearchRequest {
  query: string;        // "Dallas, TX" or "Dallas"
  limitResults?: number; // Default 5
}

export interface CitySearchResponse {
  cities: ValidatedCity[];
  hasMore: boolean;
}

// Service area update request
export interface ServiceAreaUpdateRequest {
  cityQuery: string;    // "Dallas, TX"
}

export interface ServiceAreaUpdateResponse {
  serviceArea: ServiceArea;
  citiesAdded: number;
}

// Realtor registration request
export interface RealtorRegistrationRequest {
  // Basic info
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  
  // Primary city
  primaryCityQuery: string; // "Dallas, TX"
  
  // Optional business info
  company?: string;
  licenseNumber?: string;
}

export interface RealtorRegistrationResponse {
  success: boolean;
  userId: string;
  realtorData: RealtorData;
  serviceArea: ServiceArea;
}

// Helper functions for realtor data
export class RealtorDataHelper {
  
  // Create new realtor data structure
  static createRealtorData(
    firstName: string,
    lastName: string,
    phone: string,
    email: string,
    serviceArea: ServiceArea,
    company?: string,
    licenseNumber?: string
  ): RealtorData {
    const now = Timestamp.now();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7); // 7-day trial
    
    return {
      firstName,
      lastName,
      phone,
      email,
      serviceArea,
      company,
      licenseNumber,
      isActive: true,
      profileComplete: true,
      credits: 3, // 3 free trial credits
      isOnTrial: true,
      trialStartDate: now,
      trialEndDate: Timestamp.fromDate(trialEndDate),
      createdAt: now,
      updatedAt: now
    };
  }
  
  // Check if realtor trial is active
  static isTrialActive(realtorData: RealtorData): boolean {
    if (!realtorData.isOnTrial) return false;
    const now = new Date();
    const trialEnd = realtorData.trialEndDate.toDate();
    return now < trialEnd;
  }
  
  // Get days remaining in trial
  static getTrialDaysRemaining(realtorData: { isOnTrial?: boolean; trialEndDate?: { toDate: () => Date } }): number {
    if (!realtorData.isOnTrial) return 0;
    const now = new Date();
    const trialEnd = realtorData.trialEndDate.toDate();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
  
  // Get all cities served (primary + nearby)
  static getAllCitiesServed(realtorData: { serviceArea: { primaryCity: ValidatedCity; nearbyCities: ValidatedCity[] } }): ValidatedCity[] {
    return [realtorData.serviceArea.primaryCity, ...realtorData.serviceArea.nearbyCities];
  }
  
  // Check if realtor serves a specific city
  static servesCity(realtorData: RealtorData, cityName: string, stateCode: string): boolean {
    const allCities = this.getAllCitiesServed(realtorData);
    return allCities.some(city => 
      city.name.toLowerCase() === cityName.toLowerCase() && 
      city.stateCode === stateCode
    );
  }
  
  // Update realtor timestamp
  static updateTimestamp(realtorData: RealtorData): RealtorData {
    return {
      ...realtorData,
      updatedAt: Timestamp.now()
    };
  }
}

// Validation helpers
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  // Remove all non-digits
  const digitsOnly = phone.replace(/\D/g, '');
  // Must be 10 or 11 digits (with or without country code)
  return digitsOnly.length === 10 || digitsOnly.length === 11;
}

export function formatPhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    const tenDigit = digitsOnly.slice(1);
    return `(${tenDigit.slice(0, 3)}) ${tenDigit.slice(3, 6)}-${tenDigit.slice(6)}`;
  }
  return phone; // Return original if can't format
}

// Constants
export const REALTOR_CONSTANTS = {
  SERVICE_RADIUS_MILES: 30,
  TRIAL_DAYS: 7,
  TRIAL_CREDITS: 3,
  MAX_NEARBY_CITIES: 50, // Limit to prevent data bloat
  GOOGLE_PLACES_MAX_RESULTS: 5
} as const;