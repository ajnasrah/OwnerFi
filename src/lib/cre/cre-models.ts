/**
 * Commercial Real Estate Analysis Data Models
 */

import { Timestamp } from 'firebase/firestore';

// Property types for commercial analysis
export type CommercialPropertyType = 'retail' | 'office' | 'industrial' | 'multifamily' | 'mixed-use' | 'land';

// Confidence levels for AI recommendations
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Analysis status
export type AnalysisStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'partial';

/**
 * Parsed address from geocoding
 */
export interface ParsedAddress {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId?: string;
}

/**
 * Demographics data from Census Bureau
 */
export interface DemographicsData {
  population: number;
  populationGrowth5yr: number | null; // percentage
  medianHouseholdIncome: number;
  medianAge: number;
  laborForceParticipation: number | null; // percentage
  unemploymentRate: number | null; // percentage
  educationBachelorOrHigher: number | null; // percentage
  householdCount: number | null;
  ownerOccupiedRate: number | null; // percentage
  dataYear: number;
  geographyLevel: 'tract' | 'county' | 'zip' | 'place';
}

/**
 * Industry data from Census Bureau CBP
 */
export interface IndustryData {
  naicsCode: string;
  name: string;
  establishmentCount: number;
  employeeCount: number | null;
  annualPayroll: number | null;
}

/**
 * Business patterns data from Census Bureau
 */
export interface BusinessData {
  totalEstablishments: number;
  totalEmployees: number | null;
  retailEstablishments: number;
  foodServiceEstablishments: number;
  healthcareEstablishments: number;
  professionalServicesEstablishments: number;
  manufacturingEstablishments: number;
  topIndustries: IndustryData[];
  dataYear: number;
}

/**
 * Rent range data
 */
export interface RentRange {
  min: number;
  max: number;
  median: number;
  average: number | null;
  sampleSize: number;
}

/**
 * Market rent data by property type (Phase 2 - RentCast)
 */
export interface MarketRentData {
  rentPerSF: {
    retail: RentRange | null;
    office: RentRange | null;
    industrial: RentRange | null;
    multifamily: RentRange | null;
  };
  daysOnMarket: {
    retail: number | null;
    office: number | null;
    industrial: number | null;
    multifamily: number | null;
    average: number | null;
  };
  nnnRent: {
    retail: number | null;
    office: number | null;
    industrial: number | null;
  };
  vacancyRate: {
    retail: number | null;
    office: number | null;
    industrial: number | null;
    multifamily: number | null;
  };
  propertyRentEstimate: {
    lowEstimate: number;
    highEstimate: number;
    confidence: ConfidenceLevel;
  } | null;
  dataSource: string;
  dataFreshness: Date;
}

/**
 * Highest and Best Use AI recommendation
 */
export interface HighestBestUse {
  recommendation: CommercialPropertyType;
  confidence: ConfidenceLevel;
  reasoning: string;
  keyFactors: string[];
  alternativeUses: Array<{
    type: CommercialPropertyType;
    viability: ConfidenceLevel;
    notes: string;
  }>;
  considerations: string[];
  risks: string[];
  generatedAt: Date;
  modelUsed: string;
}

/**
 * API cost tracking for this analysis
 */
export interface AnalysisCosts {
  googleMaps: number;
  census: number;
  rentcast: number;
  openai: number;
  total: number;
}

/**
 * Main CRE Analysis document
 */
export interface CREAnalysis {
  id: string;

  // Input
  inputAddress: string;

  // Parsed Address
  parsedAddress: ParsedAddress;

  // Data
  demographics: DemographicsData | null;
  businessData: BusinessData | null;
  marketData: MarketRentData | null; // Phase 2
  highestBestUse: HighestBestUse | null;

  // Metadata
  status: AnalysisStatus;
  errorMessage?: string;
  requestedBy: string;

  // Cost tracking
  apiCosts: AnalysisCosts;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;

  // Cache key for lookups
  cacheKey: string;
}

/**
 * Firestore document version (with Timestamps)
 */
export interface CREAnalysisDoc extends Omit<CREAnalysis, 'createdAt' | 'updatedAt' | 'expiresAt' | 'highestBestUse' | 'marketData'> {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp;
  highestBestUse: Omit<HighestBestUse, 'generatedAt'> & { generatedAt: Timestamp } | null;
  marketData: Omit<MarketRentData, 'dataFreshness'> & { dataFreshness: Timestamp } | null;
}

/**
 * API cache entry for raw responses
 */
export interface CREApiCache {
  id: string;
  apiName: 'census' | 'rentcast' | 'geocoding';
  endpoint: string;
  requestParams: Record<string, string>;
  response: unknown;
  cachedAt: Timestamp;
  expiresAt: Timestamp;
}

/**
 * Analysis request payload
 */
export interface AnalyzeRequest {
  address: string;
  forceRefresh?: boolean;
  includeMarketData?: boolean; // Phase 2
}

/**
 * Analysis response
 */
export interface AnalyzeResponse {
  success: boolean;
  data?: CREAnalysis;
  source: 'cache' | 'fresh';
  error?: string;
}

/**
 * Collection names
 */
export const CRE_COLLECTIONS = {
  ANALYSES: 'cre_analyses',
  API_CACHE: 'cre_api_cache',
} as const;

/**
 * Cache TTLs in days
 */
export const CRE_CACHE_TTL = {
  ANALYSIS: 30,        // Full analysis cache
  CENSUS: 365,         // Census data (annual)
  RENTCAST: 7,         // Market data (weekly)
  GEOCODING: 365 * 10, // Addresses don't change
} as const;

/**
 * Helper to create cache key from address
 */
export function createAddressCacheKey(address: string): string {
  const normalized = address
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
  return `cre_${normalized}`;
}

/**
 * Helper to convert Firestore doc to CREAnalysis
 */
export function docToCREAnalysis(doc: CREAnalysisDoc): CREAnalysis {
  return {
    ...doc,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
    expiresAt: doc.expiresAt.toDate(),
    highestBestUse: doc.highestBestUse ? {
      ...doc.highestBestUse,
      generatedAt: doc.highestBestUse.generatedAt.toDate(),
    } : null,
    marketData: doc.marketData ? {
      ...doc.marketData,
      dataFreshness: doc.marketData.dataFreshness.toDate(),
    } : null,
  };
}
