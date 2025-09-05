// AUTHORITATIVE Firebase data models - SINGLE SOURCE OF TRUTH
// All interfaces must match Firestore document structure exactly

import { Timestamp } from 'firebase/firestore';

// Base user record (authentication)
export interface User {
  id: string;
  email: string;
  name: string; 
  role: 'buyer' | 'realtor' | 'admin';
  password: string; // Only for creation, removed after hashing
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  purchaseDate: string;
  reason: 'no_response' | 'invalid_contact' | 'not_qualified' | 'already_working' | 'false_information' | 'duplicate' | 'other';
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

// Property listing
export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  listPrice: number;
  downPaymentAmount: number;
  monthlyPayment: number;
  interestRate: number; // Percentage like 6.5
  termYears: number;
  description?: string;
  photos?: string[]; // URLs
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

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
  metadata?: Record<string, any>;
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
export function isValidUser(data: any): data is User {
  return data && 
    typeof data.email === 'string' &&
    typeof data.name === 'string' &&
    ['buyer', 'realtor', 'admin'].includes(data.role);
}

export function isValidBuyerProfile(data: any): data is BuyerProfile {
  return data && 
    typeof data.userId === 'string' &&
    typeof data.firstName === 'string' &&
    typeof data.lastName === 'string' &&
    typeof data.email === 'string' &&
    typeof data.preferredCity === 'string' &&
    typeof data.preferredState === 'string' &&
    typeof data.maxMonthlyPayment === 'number' &&
    typeof data.maxDownPayment === 'number' &&
    Array.isArray(data.languages) &&
    typeof data.profileComplete === 'boolean';
}

export function isValidRealtorProfile(data: any): data is RealtorProfile {
  return data &&
    typeof data.userId === 'string' &&
    typeof data.firstName === 'string' &&
    typeof data.lastName === 'string' &&
    typeof data.email === 'string' &&
    typeof data.company === 'string' &&
    typeof data.primaryCity === 'string' &&
    typeof data.primaryState === 'string' &&
    Array.isArray(data.serviceStates) &&
    Array.isArray(data.serviceCities) &&
    Array.isArray(data.languages) &&
    typeof data.credits === 'number' &&
    typeof data.profileComplete === 'boolean';
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
export function convertTimestampToDate(timestamp: any): string {
  if (!timestamp) return new Date().toISOString();
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
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