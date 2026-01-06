// AUTHORITATIVE Firebase data models - SINGLE SOURCE OF TRUTH
// All interfaces must match Firestore document structure exactly

import { Timestamp } from 'firebase/firestore';

// Base user record (authentication)
export interface User {
  id: string;
  email: string;
  name: string; 
  phone?: string; // Optional phone number
  company?: string; // Optional company name
  licenseState?: string; // Optional license state
  stripeCustomerId?: string; // Optional Stripe customer ID
  role: 'buyer' | 'realtor' | 'admin' | 'pending';
  password: string; // Only for creation, removed after hashing
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Buyer search criteria (nested within BuyerProfile)
export interface BuyerSearchCriteria {
  cities?: string[];
  state?: string;
  minBedrooms?: number;
  minBathrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  minSquareFeet?: number;
}

// Enhanced Buyer profile - CONSOLIDATED from buyerProfiles + buyerLinks
export interface BuyerProfile {
  id: string;
  userId: string; // Links to User.id
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  
  // Location preferences (backward compatibility)
  preferredCity: string;
  preferredState: string;
  city?: string;            // For API compatibility (maps to preferredCity)
  state?: string;           // For API compatibility (maps to preferredState)
  searchRadius: number;     // Miles

  // Property requirements
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  minPrice?: number;         // Minimum asking price
  maxPrice?: number;         // Maximum asking price
  
  // Communication preferences
  languages: string[];       // ['English', 'Spanish']
  emailNotifications: boolean;
  smsNotifications: boolean;
  
  // System fields
  profileComplete: boolean;
  isActive: boolean;
  
  // Property interaction tracking
  searchCriteria?: BuyerSearchCriteria; // Enhanced search criteria
  matchedPropertyIds: string[];         // Cached property matches
  likedPropertyIds: string[];           // Liked properties (unified from both systems)
  passedPropertyIds: string[];          // Passed properties
  viewedPropertyIds?: string[];         // Viewed properties (for analytics)
  notifiedPropertyIds?: string[];       // Properties buyer was notified about (SMS dedup)

  // 🆕 PRE-COMPUTED FILTER (Generated at signup for 100K user scale)
  filter?: {
    nearbyCities: string[];             // Pre-computed list of nearby city names
    nearbyCitiesCount: number;          // Number of cities in radius
    radiusMiles: number;                // Search radius used
    lastCityUpdate: Timestamp;          // When filter was last updated

    // Geographic bounds for efficient DB queries
    boundingBox?: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    };

    // Geohash prefix for future optimization (3-char = ~150km precision)
    geohashPrefix?: string;             // e.g., "9v6" for Houston area
  };

  // Lead selling fields (NEW - from buyerLinks)
  isAvailableForPurchase: boolean;      // Can be purchased by realtors
  purchasedBy?: string;                 // Realtor userId who purchased this lead
  purchasedAt?: Timestamp;              // When lead was purchased
  leadPrice: number;                    // Cost in credits (default: 1)
  
  // Legacy/backup fields
  hasBeenSold?: boolean;                // Whether buyer has purchased a home
  preferredStates?: string;             // JSON string of preferred states array
  preferredCities?: string;             // JSON string of preferred cities array
  lastMatchUpdate?: Timestamp;          // Last time matches were calculated
  lastActiveAt?: Timestamp;             // Last time buyer used platform
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Realtor profile (linked to User via userId)
export interface RealtorProfile {
  id: string;
  userId: string; // Links to User.id
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  licenseNumber?: string;
  licenseState?: string;
  primaryCity: string; // Main operating city
  primaryState: string; // Main operating state
  serviceRadius: number; // Miles from primary city
  serviceStates: string[]; // ['Texas', 'Florida'] - full state names
  serviceCities: string[]; // ['Austin, TX', 'Dallas, TX'] - city, state format
  languages: string[]; // ['English', 'Spanish']
  credits: number;
  isOnTrial: boolean;
  trialStartDate: Timestamp;
  trialEndDate: Timestamp;
  profileComplete: boolean;
  isActive: boolean;
  // Stripe integration fields
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  // Performance metrics
  avgResponseTimeHours?: number;
  successRate?: number; // 0-100 percentage
  specializations?: string[]; // ['first-time-buyers', 'luxury', 'owner-financing']
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Lead purchase transaction
export interface LeadPurchase {
  id: string;
  realtorId: string; // Links to RealtorProfile.id
  buyerId: string; // Links to BuyerProfile.id
  creditsCost: number;
  purchasePrice: number; // Dollar amount
  status: 'purchased' | 'contacted' | 'converted' | 'refunded';
  notes?: string;
  purchasedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Lead dispute/complaint
export interface LeadDispute {
  id: string;
  transactionId: string; // Links to LeadPurchase.id
  realtorId: string;
  realtorName: string;
  realtorEmail: string;
  buyerName: string;
  buyerPhone?: string;
  buyerEmail?: string;
  buyerCity?: string;
  buyerState?: string;
  purchaseDate: string;
  reason: 'no_response' | 'invalid_contact' | 'not_qualified' | 'already_working' | 'false_information' | 'duplicate' | 'wrong_info' | 'not_interested' | 'other';
  explanation: string;
  contactAttempts?: string;
  evidence?: string;
  status: 'pending' | 'approved' | 'denied' | 'refunded';
  adminNotes?: string;
  refundAmount?: number;
  submittedAt: Timestamp;
  resolvedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Note: Property interface moved to /lib/property-schema.ts as PropertyListing
// Use PropertyListing from property-schema.ts for all property operations

// Property-buyer match
export interface PropertyMatch {
  id: string;
  propertyId: string;
  buyerId: string;
  matchScore: number; // 0-100 compatibility percentage
  withinBudget: boolean;
  withinRadius: boolean;
  meetsRequirements: boolean;
  distanceMiles?: number;
  createdAt: Timestamp;
}

// Realtor subscription
export interface RealtorSubscription {
  id: string;
  realtorId: string;
  plan: 'trial' | 'basic' | 'professional' | 'enterprise' | 'pay-per-lead';
  status: 'active' | 'cancelled' | 'expired';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  monthlyPrice: number;
  creditsPerMonth: number;
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 🆕 PROPERTY INTERACTION TRACKING (For ML and algorithm improvements)
// Stored in subcollection: propertyInteractions/{buyerId}/liked|passed|viewed/{interactionId}
export interface PropertyInteraction {
  propertyId: string;
  timestamp: Timestamp;

  // Property context at time of interaction (for ML training)
  context?: {
    // Property details
    monthlyPayment: number;
    downPayment: number;
    bedrooms: number;
    bathrooms: number;
    squareFeet?: number;
    city: string;
    distanceFromUser?: number;        // Miles from user's preferred city

    // Match quality metrics
    withinRadius?: boolean;

    // Property source (for A/B testing)
    source?: 'curated' | 'zillow' | 'manual';
  };

  // Why user passed (for ML training on preferences)
  passReason?: 'too_expensive' | 'wrong_location' | 'too_small' | 'needs_work' | 'other' | null;

  // Analytics metadata
  deviceType?: 'mobile' | 'desktop';
  sessionId?: string;
}

// Transaction history entry
export interface Transaction {
  id: string;
  realtorId: string;
  type: 'lead_purchase' | 'credit_purchase' | 'subscription_credit' | 'trial_credit' | 'refund';
  description: string;
  creditsChange: number; // Positive = added, negative = spent
  runningBalance: number;
  relatedId?: string; // LeadPurchase.id, RealtorSubscription.id, etc.
  details?: {
    buyerName?: string;
    buyerCity?: string;
    purchasePrice?: number;
    subscriptionPlan?: string;
  };
  createdAt: Timestamp;
}

// System log entry
export interface SystemLog {
  id: string;
  level: 'info' | 'warning' | 'error';
  action: string;
  message: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
  };
  createdAt: Timestamp;
}

// Referral Agreement - Auto-filled when realtor accepts a lead
export interface ReferralAgreement {
  id: string;
  agreementNumber: string;           // e.g., "RA-2024-001234"

  // Parties
  realtorUserId: string;
  buyerId: string;

  // Realtor details (auto-filled)
  realtorName: string;
  realtorEmail: string;
  realtorPhone: string;
  realtorCompany?: string;
  realtorLicenseNumber?: string;
  realtorLicenseState?: string;
  realtorAddress?: string;

  // Buyer/Lead details (auto-filled)
  buyerFirstName: string;
  buyerLastName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerCity: string;
  buyerState: string;

  // Agreement terms
  referralFeePercent: number;        // Referral fee percentage (e.g., 30)
  agreementTermDays: number;         // How long the agreement is valid (e.g., 180 days)
  effectiveDate: Timestamp;
  expirationDate: Timestamp;

  // Status tracking
  status: 'pending' | 'signed' | 'expired' | 'voided' | 'completed';

  // Signature (simple MVP approach)
  signedAt?: Timestamp;
  signatureTypedName?: string;       // Realtor types their name
  signatureCheckbox: boolean;        // "I agree" checkbox
  signatureIpAddress?: string;
  signatureUserAgent?: string;

  // After signing - lead info released
  leadInfoReleased: boolean;
  leadReleasedAt?: Timestamp;

  // Outcome tracking
  propertyPurchased?: boolean;
  purchasePrice?: number;
  commissionEarned?: number;
  closingDate?: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Helper to generate agreement number
export function generateAgreementNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RA-${year}-${random}`;
}

// Firestore collection names (consistent across the app)
export const COLLECTIONS = {
  USERS: 'users',
  BUYER_PROFILES: 'buyerProfiles',
  REALTOR_PROFILES: 'realtors',
  PROPERTIES: 'properties',
  LEAD_PURCHASES: 'buyerLeadPurchases',
  LEAD_DISPUTES: 'leadDisputes',
  PROPERTY_MATCHES: 'propertyMatches',
  REALTOR_SUBSCRIPTIONS: 'realtorSubscriptions',
  TRANSACTIONS: 'transactions',
  SYSTEM_LOGS: 'systemLogs',
  REFERRAL_AGREEMENTS: 'referralAgreements'
} as const;

// Type guards for runtime validation
export function isValidUser(data: unknown): data is User {
  return data !== null && typeof data === 'object' && 
    typeof (data as Record<string, unknown>).email === 'string' &&
    typeof (data as Record<string, unknown>).name === 'string' &&
    ['buyer', 'realtor', 'admin', 'pending'].includes((data as Record<string, unknown>).role as string);
}

export function isValidBuyerProfile(data: unknown): data is BuyerProfile {
  const obj = data as Record<string, unknown>;
  return data !== null && typeof data === 'object' &&
    typeof obj.userId === 'string' &&
    typeof obj.firstName === 'string' &&
    typeof obj.lastName === 'string' &&
    typeof obj.email === 'string' &&
    typeof obj.preferredCity === 'string' &&
    typeof obj.preferredState === 'string' &&
    Array.isArray(obj.languages) &&
    typeof obj.profileComplete === 'boolean';
}

export function isValidRealtorProfile(data: unknown): data is RealtorProfile {
  const obj = data as Record<string, unknown>;
  return data !== null && typeof data === 'object' &&
    typeof obj.userId === 'string' &&
    typeof obj.firstName === 'string' &&
    typeof obj.lastName === 'string' &&
    typeof obj.email === 'string' &&
    typeof obj.company === 'string' &&
    typeof obj.primaryCity === 'string' &&
    typeof obj.primaryState === 'string' &&
    Array.isArray(obj.serviceStates) &&
    Array.isArray(obj.serviceCities) &&
    Array.isArray(obj.languages) &&
    typeof obj.credits === 'number' &&
    typeof obj.profileComplete === 'boolean';
}

// Helper to generate consistent IDs
export function generateFirebaseId(): string {
  return crypto.randomUUID();
}

// Helper to create Firestore timestamps
export function createTimestamp(): Timestamp {
  return Timestamp.now();
}

// Data transformation helpers
export function convertTimestampToDate(timestamp: unknown): string {
  if (!timestamp) return new Date().toISOString();
  const ts = timestamp as { toDate?: () => Date };
  if (ts.toDate && typeof ts.toDate === 'function') {
    return ts.toDate().toISOString();
  }
  if (typeof timestamp === 'string') return timestamp;
  return new Date().toISOString();
}

// State normalization for consistent matching
export const STATE_MAPPINGS = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY'
} as const;

export function normalizeState(state: string): string {
  if (!state) return '';
  return STATE_MAPPINGS[state as keyof typeof STATE_MAPPINGS] || state.toUpperCase();
}

// City formatting helper
export function formatCityState(city: string, state: string): string {
  return `${city}, ${normalizeState(state)}`;
}