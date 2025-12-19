/**
 * UNIFIED PROPERTY SCHEMA
 *
 * Consolidates all property collections into a single schema:
 * - properties (legacy)
 * - zillow_imports (owner finance)
 * - cash_houses (cash deals)
 *
 * Single collection with `dealType` field to differentiate.
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// DEAL TYPE - Replaces multiple collections
// ============================================
export type DealType = 'owner_finance' | 'cash_deal' | 'both' | 'standard';

// ============================================
// SOURCE TRACKING
// ============================================
export interface PropertySource {
  type: 'scraper' | 'manual' | 'ghl_webhook' | 'agent_response' | 'import' | 'legacy';
  provider?: 'apify' | 'puppeteer';
  jobId?: string;
  importedAt: Timestamp | string;
  scrapedAt?: Timestamp | string;
}

// ============================================
// OWNER FINANCE DETAILS
// ============================================
export interface OwnerFinanceDetails {
  verified: boolean;
  financingType: 'owner_finance' | 'seller_finance' | 'rent_to_own' | 'contract_for_deed' | 'assumable' | 'creative';
  primaryKeyword: string;
  matchedKeywords: string[];
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  monthlyPayment?: number;
  interestRate?: number;
  termYears?: number;
  balloonYears?: number;
}

// ============================================
// CASH DEAL DETAILS
// ============================================
export interface CashDealDetails {
  reason: 'discount' | 'needs_work' | 'both';
  discountPercent?: number;
  eightyPercentValue?: number;
  needsWork: boolean;
  needsWorkKeywords?: string[];
}

// ============================================
// VERIFICATION FLAGS
// ============================================
export interface PropertyVerification {
  autoVerified: boolean;
  manuallyVerified: boolean;
  manuallyVerifiedBy?: string;
  manuallyVerifiedAt?: Timestamp | string;
  needsReview: boolean;
  reviewReasons?: string[];
}

// ============================================
// PROPERTY IMAGES
// ============================================
export interface PropertyImages {
  primary: string;
  gallery: string[];
  quality?: {
    score: number;
    isStreetView: boolean;
  };
}

// ============================================
// CONTACT INFO
// ============================================
export interface PropertyContact {
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  brokerName?: string;
  brokerPhone?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
}

// ============================================
// GHL SYNC STATUS
// ============================================
export interface GHLSync {
  contactId?: string;
  opportunityId?: string;
  syncedAt?: Timestamp | string;
  lastWebhookAt?: Timestamp | string;
}

// ============================================
// PROPERTY ANALYTICS
// ============================================
export interface PropertyAnalytics {
  viewCount: number;
  favoriteCount: number;
  leadCount: number;
}

// ============================================
// UNIFIED PROPERTY - MAIN INTERFACE
// ============================================
export interface UnifiedProperty {
  // Core Identity
  id: string;
  zpid?: string;                        // Zillow Property ID (for deduplication)

  // Location
  address: string;
  streetAddress?: string;               // Just street portion
  fullAddress?: string;                 // Complete address string
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  neighborhood?: string;

  // Geo coordinates
  latitude?: number;
  longitude?: number;

  // Pre-computed for Firestore queries
  nearbyCities: string[];
  nearbyCitiesUpdatedAt?: Timestamp | string;

  // Property Details
  propertyType: 'single-family' | 'condo' | 'townhouse' | 'mobile-home' | 'multi-family' | 'land' | 'other';
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  lotSize?: number;
  yearBuilt?: number;
  stories?: number;
  garage?: number;

  // Features
  features?: string[];
  appliances?: string[];
  heating?: string;
  cooling?: string;
  parking?: string;

  // Pricing
  listPrice: number;
  zestimate?: number;
  rentZestimate?: number;
  pricePerSqFt?: number;

  // DEAL TYPE - Key discriminator
  dealType: DealType;

  // Owner Finance Details (populated when dealType includes 'owner_finance')
  ownerFinance?: OwnerFinanceDetails;

  // Cash Deal Details (populated when dealType includes 'cash_deal')
  cashDeal?: CashDealDetails;

  // Status
  status: 'active' | 'pending' | 'sold' | 'off_market' | 'expired';
  isActive: boolean;

  // Source Tracking
  source: PropertySource;

  // Verification
  verification: PropertyVerification;

  // Media
  images: PropertyImages;
  description: string;
  title?: string;
  highlights?: string[];
  virtualTourUrl?: string;

  // Contact
  contact: PropertyContact;

  // Timestamps
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
  lastRefreshedAt?: Timestamp | string;
  daysOnMarket?: number;

  // Analytics
  analytics?: PropertyAnalytics;

  // GHL Integration
  ghl?: GHLSync;

  // HOA & Taxes
  hoa?: {
    hasHOA: boolean;
    monthlyFee?: number;
    restrictions?: string[];
  };
  taxes?: {
    annualAmount: number;
    assessedValue?: number;
  };

  // Legacy compatibility fields
  url?: string;                         // Zillow URL
  detailUrl?: string;
  imageUrl?: string;                    // Legacy single image
  imgSrc?: string;                      // Zillow image field
  firstPropertyImage?: string;          // Another legacy field
  propertyImages?: string[];            // Legacy array
}

// ============================================
// COLLECTION NAME
// ============================================
export const UNIFIED_PROPERTIES_COLLECTION = 'properties_unified';

// ============================================
// TYPE GUARDS
// ============================================
export function isOwnerFinanceProperty(property: UnifiedProperty): boolean {
  return property.dealType === 'owner_finance' || property.dealType === 'both';
}

export function isCashDealProperty(property: UnifiedProperty): boolean {
  return property.dealType === 'cash_deal' || property.dealType === 'both';
}

export function hasVerifiedOwnerFinancing(property: UnifiedProperty): boolean {
  return isOwnerFinanceProperty(property) &&
         property.ownerFinance?.verified === true;
}

// ============================================
// DEAL TYPE HELPERS
// ============================================
export function determineDealType(
  passesOwnerFinance: boolean,
  passesCashDeal: boolean
): DealType {
  if (passesOwnerFinance && passesCashDeal) return 'both';
  if (passesOwnerFinance) return 'owner_finance';
  if (passesCashDeal) return 'cash_deal';
  return 'standard';
}
