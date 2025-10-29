// VIEW MODELS - View-specific type extensions for UI components
// These extend the authoritative firebase-models.ts types with computed/display fields
// NEVER modify firebase-models.ts from here - only extend for view purposes

import { BuyerProfile } from './firebase-models';

/**
 * ADMIN BUYER VIEW
 * Extended buyer profile with admin-specific computed fields for the admin table
 */
export interface BuyerAdminView extends BuyerProfile {
  matchedPropertiesCount: number;
  likedPropertiesCount: number;
  loginCount: number;
  lastSignIn?: string;
  // All other fields inherited from BuyerProfile
}

/**
 * BUYER DASHBOARD VIEW
 * Simplified view for buyer's own dashboard - only essential fields
 */
export interface BuyerDashboardView {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  state: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
  likedProperties?: string[];
}

/**
 * Convert BuyerProfile to BuyerAdminView
 * Used in admin APIs and pages
 */
export function toBuyerAdminView(
  profile: BuyerProfile,
  extra: {
    matchedPropertiesCount: number;
    likedPropertiesCount: number;
    loginCount: number;
    lastSignIn?: string;
  }
): BuyerAdminView {
  return {
    ...profile,
    matchedPropertiesCount: extra.matchedPropertiesCount,
    likedPropertiesCount: extra.likedPropertiesCount,
    loginCount: extra.loginCount,
    lastSignIn: extra.lastSignIn,
  };
}

/**
 * Convert BuyerProfile to BuyerDashboardView
 * Used in buyer dashboard components
 */
export function toBuyerDashboardView(profile: BuyerProfile): BuyerDashboardView {
  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    city: profile.preferredCity || profile.city || '',
    state: profile.preferredState || profile.state || '',
    maxMonthlyPayment: profile.maxMonthlyPayment,
    maxDownPayment: profile.maxDownPayment,
    likedProperties: profile.likedPropertyIds,
  };
}

/**
 * Convert Firestore document data to BuyerProfile
 * Handles timestamp conversion and field mapping
 */
export function firestoreToBuyerProfile(docId: string, data: any): BuyerProfile {
  return {
    id: docId,
    userId: data.userId || '',
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.email || '',
    phone: data.phone || '',
    preferredCity: data.preferredCity || data.city || '',
    preferredState: data.preferredState || data.state || '',
    city: data.city || data.preferredCity,
    state: data.state || data.preferredState,
    searchRadius: data.searchRadius || 25,
    maxMonthlyPayment: data.maxMonthlyPayment || 0,
    maxDownPayment: data.maxDownPayment || 0,
    minBedrooms: data.minBedrooms,
    minBathrooms: data.minBathrooms,
    minSquareFeet: data.minSquareFeet,
    minPrice: data.minPrice,
    maxPrice: data.maxPrice,
    languages: data.languages || ['English'],
    emailNotifications: data.emailNotifications !== false,
    smsNotifications: data.smsNotifications !== false,
    profileComplete: data.profileComplete || false,
    isActive: data.isActive !== false,
    searchCriteria: data.searchCriteria,
    matchedPropertyIds: data.matchedPropertyIds || [],
    likedPropertyIds: data.likedPropertyIds || data.likedProperties || [],
    passedPropertyIds: data.passedPropertyIds || [],
    isAvailableForPurchase: data.isAvailableForPurchase !== false,
    purchasedBy: data.purchasedBy,
    purchasedAt: data.purchasedAt,
    leadPrice: data.leadPrice || 1,
    hasBeenSold: data.hasBeenSold,
    preferredStates: data.preferredStates,
    preferredCities: data.preferredCities,
    lastMatchUpdate: data.lastMatchUpdate,
    lastActiveAt: data.lastActiveAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
