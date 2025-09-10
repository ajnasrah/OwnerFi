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
  role: 'buyer' | 'realtor' | 'admin';
  password: string; // Only for creation, removed after hashing
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Buyer search criteria (nested within BuyerProfile)
export interface BuyerSearchCriteria {
  cities?: string[];
  state?: string;
  maxMonthlyPayment?: number;
  maxDownPayment?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  minSquareFeet?: number;
}

// Buyer profile (linked to User via userId)
export interface BuyerProfile {
  id: string;
  userId: string; // Links to User.id
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredCity: string;
  preferredState: string;
  searchRadius: number; // Miles
  maxMonthlyPayment: number; // Dollars
  maxDownPayment: number; // Dollars
  minBedrooms?: number;
  minBathrooms?: number;
  minSquareFeet?: number;
  languages: string[]; // ['English', 'Spanish']
  emailNotifications: boolean;
  smsNotifications: boolean;
  profileComplete: boolean;
  isActive: boolean;
  searchCriteria?: BuyerSearchCriteria; // Enhanced search criteria
  matchedPropertyIds?: string[]; // Cached property matches
  likedPropertyIds?: string[]; // Liked properties
  passedPropertyIds?: string[]; // Passed properties
  
  // Additional fields found in codebase
  minPrice?: number; // Minimum property price
  maxPrice?: number; // Maximum property price  
  hasBeenSold?: boolean; // Whether buyer has purchased
  preferredStates?: string; // JSON string of preferred states array
  preferredCities?: string; // JSON string of preferred cities array
  lastMatchUpdate?: Timestamp;
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
  maxMonthlyPayment?: number;
  maxDownPayment?: number;
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
  SYSTEM_LOGS: 'systemLogs'
} as const;

// Type guards for runtime validation
export function isValidUser(data: unknown): data is User {
  return data !== null && typeof data === 'object' && 
    typeof (data as Record<string, unknown>).email === 'string' &&
    typeof (data as Record<string, unknown>).name === 'string' &&
    ['buyer', 'realtor', 'admin'].includes((data as Record<string, unknown>).role as string);
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
    typeof obj.maxMonthlyPayment === 'number' &&
    typeof obj.maxDownPayment === 'number' &&
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