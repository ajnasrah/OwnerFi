/**
 * Property Transformer v2
 *
 * Transforms raw Apify data into standardized format for both collections.
 * Adapted for the all-in-one scraper output format.
 */

import { ScrapedProperty } from './apify-client';
import { sanitizeDescription } from '../description-sanitizer';
import { calculateCashFlow, CashFlowData } from '../cash-flow';
import { getNearbyCityNamesForProperty } from '../comprehensive-cities';
import { FilterResult } from './unified-filter';

// Type for address object from Apify
interface ApifyAddressObj {
  city?: string;
  state?: string;
  zipcode?: string;
  zip?: string;
  streetAddress?: string;
}

export interface TransformedProperty {
  // URLs
  url: string;
  hdpUrl: string;
  virtualTourUrl: string;

  // Address
  fullAddress: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;

  // IDs
  zpid: number;
  parcelId: string;
  mlsId: string;

  // Property Details
  bedrooms: number;
  bathrooms: number;
  squareFoot: number;
  lotSquareFoot: number;
  yearBuilt: number;
  homeType: string;
  homeStatus: string;

  // Location
  latitude: number;
  longitude: number;
  nearbyCities: string[];

  // Pricing
  price: number;
  estimate: number;
  rentEstimate: number;
  hoa: number;
  cashFlow: CashFlowData | null;

  // Description
  description: string;

  // Contact Info
  agentName: string;
  agentPhoneNumber: string;
  agentEmail: string;
  brokerName: string;
  brokerPhoneNumber: string;

  // Images
  propertyImages: string[];
  firstPropertyImage: string;
  imgSrc: string; // Alias for compatibility with GHL and other systems
  photoCount: number;

  // Metadata
  source: string;
  searchId: string;
  importedAt: Date;
  scrapedAt: Date;
  daysOnZillow: number;
}

/**
 * Parse street address from full address
 */
function parseStreetAddress(fullAddr: string, city?: string): string {
  if (!fullAddr) return '';

  if (city && fullAddr.toLowerCase().includes(city.toLowerCase())) {
    const parts = fullAddr.split(',');
    return parts[0].trim();
  }

  const parts = fullAddr.split(',');
  return parts[0].trim();
}

/**
 * Generate Street View URL as fallback image
 */
function getStreetViewImage(address: string): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !address) return '';

  const encodedAddress = encodeURIComponent(address);
  return `https://maps.googleapis.com/maps/api/streetview?size=800x500&location=${encodedAddress}&heading=0&fov=90&pitch=10&key=${apiKey}`;
}

/**
 * Transform raw Apify property to standardized format
 */
export function transformProperty(
  raw: ScrapedProperty,
  source: string,
  searchId: string
): TransformedProperty {
  const timestamp = new Date();

  // Handle different property formats from all-in-one vs detail scraper
  const addressObj: ApifyAddressObj = (raw.address as ApifyAddressObj) || {};

  // Extract address components
  const city = addressObj.city || raw.city || '';
  const state = addressObj.state || raw.state || '';
  const zipCode = addressObj.zipcode || raw.zipcode || addressObj.zip || (raw as any).zip || '';

  // Street address
  let rawStreetAddress = addressObj.streetAddress || raw.streetAddress || raw.address || '';
  if (typeof rawStreetAddress === 'object') {
    rawStreetAddress = (rawStreetAddress as any).streetAddress || '';
  }
  const streetAddress = parseStreetAddress(rawStreetAddress, city);

  // Full address
  const fullAddress = streetAddress && city && state
    ? `${streetAddress}, ${city}, ${state} ${zipCode}`.trim()
    : raw.address || '';

  // Construct URL
  let url = raw.url || raw.detailUrl || '';
  if (!url || !url.startsWith('http')) {
    if (raw.hdpUrl) {
      url = `https://www.zillow.com${raw.hdpUrl}`;
    } else if (raw.zpid) {
      url = `https://www.zillow.com/homedetails/${raw.zpid}_zpid/`;
    }
  }

  // Extract contact info
  const agentPhone = raw.attributionInfo?.agentPhoneNumber
    || raw.agentPhoneNumber
    || raw.agentPhone
    || '';

  const brokerPhone = raw.attributionInfo?.brokerPhoneNumber
    || raw.brokerPhoneNumber
    || raw.brokerPhone
    || '';

  const agentName = raw.attributionInfo?.agentName
    || raw.agentName
    || raw.listingAgent
    || '';

  const brokerName = raw.attributionInfo?.brokerName
    || raw.brokerName
    || raw.brokerageName
    || '';

  // Extract images
  let propertyImages: string[] = [];
  if (Array.isArray(raw.responsivePhotos)) {
    propertyImages = raw.responsivePhotos.map((p: any) => p.url).filter(Boolean);
  } else if (Array.isArray(raw.photos)) {
    propertyImages = raw.photos.map((p: any) =>
      typeof p === 'string' ? p : p.url || p.href
    ).filter(Boolean);
  } else if (Array.isArray(raw.images)) {
    propertyImages = raw.images;
  }

  // First image with fallback
  const firstPropertyImage = raw.desktopWebHdpImageLink
    || raw.hiResImageLink
    || raw.imgSrc
    || (propertyImages.length > 0 ? propertyImages[0] : '')
    || getStreetViewImage(fullAddress);

  // Ensure images array has at least one image
  if (propertyImages.length === 0 && firstPropertyImage) {
    propertyImages = [firstPropertyImage];
  }

  // Calculate nearby cities
  const propertyCity = city?.split(',')[0]?.trim();
  const nearbyCities = propertyCity && state
    ? getNearbyCityNamesForProperty(propertyCity, state, 35, 100)
    : [];

  // Parse numeric values
  const price = typeof raw.price === 'string'
    ? parseInt(raw.price.replace(/[^0-9]/g, ''), 10) || 0
    : raw.price || 0;

  const estimate = raw.zestimate || raw.homeValue || raw.estimate || 0;
  const rentEstimate = raw.rentZestimate || raw.rentEstimate || 0;
  const hoa = raw.monthlyHoaFee || raw.hoa || 0;

  // Calculate cash flow
  const annualTax = Array.isArray(raw.taxHistory)
    ? raw.taxHistory.find((t: any) => t.taxPaid)?.taxPaid || 0
    : 0;

  const cashFlow = calculateCashFlow(price, rentEstimate, annualTax, hoa);

  return {
    url,
    hdpUrl: raw.hdpUrl || '',
    virtualTourUrl: raw.virtualTourUrl || raw.thirdPartyVirtualTour?.externalUrl || '',

    fullAddress,
    streetAddress,
    city,
    state,
    zipCode,
    county: raw.county || '',

    zpid: typeof raw.zpid === 'string' ? parseInt(raw.zpid, 10) : (raw.zpid || 0),
    parcelId: raw.parcelId || raw.resoFacts?.parcelNumber || '',
    mlsId: raw.attributionInfo?.mlsId || raw.mlsid || '',

    bedrooms: raw.bedrooms || raw.beds || 0,
    bathrooms: raw.bathrooms || raw.baths || 0,
    squareFoot: raw.livingArea || raw.livingAreaValue || raw.squareFoot || 0,
    lotSquareFoot: raw.lotSize || raw.lotAreaValue || 0,
    yearBuilt: raw.yearBuilt || 0,
    homeType: raw.homeType || raw.propertyType || '',
    homeStatus: raw.homeStatus || '',

    latitude: raw.latitude || 0,
    longitude: raw.longitude || 0,
    nearbyCities,

    price,
    estimate,
    rentEstimate,
    hoa,
    cashFlow,

    description: sanitizeDescription(raw.description),

    agentName,
    agentPhoneNumber: agentPhone || brokerPhone,
    agentEmail: raw.attributionInfo?.agentEmail || raw.agentEmail || '',
    brokerName,
    brokerPhoneNumber: brokerPhone,

    propertyImages,
    firstPropertyImage,
    imgSrc: firstPropertyImage, // Alias for compatibility
    photoCount: raw.photoCount || propertyImages.length,

    source,
    searchId,
    importedAt: timestamp,
    scrapedAt: timestamp,
    daysOnZillow: raw.daysOnZillow || 0,
  };
}

/**
 * Validate that a property has minimum required data
 * Also filters out rentals, sold, and other non-FOR_SALE listings
 */
export function validateProperty(property: TransformedProperty): {
  valid: boolean;
  reason?: string;
} {
  if (!property.zpid) {
    return { valid: false, reason: 'Missing zpid' };
  }
  if (!property.fullAddress || property.fullAddress.trim() === ', ,') {
    return { valid: false, reason: 'Missing address' };
  }
  if (!property.city || !property.state) {
    return { valid: false, reason: 'Missing city or state' };
  }

  // Reject non-FOR_SALE listings (rentals, sold, pending, etc.)
  const status = property.homeStatus?.toUpperCase();
  if (status && status !== 'FOR_SALE') {
    return { valid: false, reason: `Not for sale (status: ${status})` };
  }

  return { valid: true };
}

/**
 * Create document data for zillow_imports collection
 */
export function createZillowImportsDoc(
  property: TransformedProperty,
  filterResult: FilterResult
): Record<string, any> {
  return {
    ...property,

    // Owner Finance Fields
    ownerFinanceVerified: true,
    matchedKeywords: filterResult.ownerFinanceKeywords,
    primaryKeyword: filterResult.primaryOwnerFinanceKeyword,

    // Financing Type
    financingType: filterResult.financingType.financingType,
    allFinancingTypes: filterResult.financingType.allTypes,
    financingTypeLabel: filterResult.financingType.displayLabel,

    // Status tracking
    status: null,
    foundAt: new Date(),
    verifiedAt: null,
    soldAt: null,

    // Financing terms (initially null)
    downPaymentAmount: null,
    downPaymentPercent: null,
    monthlyPayment: null,
    interestRate: null,
    loanTermYears: null,
    balloonPaymentYears: null,

    // Metadata
    nearbyCitiesSource: 'scraper-v2',
    nearbyCitiesUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Create document data for cash_houses collection
 * @deprecated Use createUnifiedPropertyDoc instead
 */
export function createCashHousesDoc(
  property: TransformedProperty,
  filterResult: FilterResult
): Record<string, any> {
  return {
    ...property,

    // Cash Deal Fields
    needsWork: filterResult.needsWork,
    needsWorkKeywords: filterResult.needsWorkKeywords,
    dealType: filterResult.cashDealReason || 'unknown',
    discountPercentage: filterResult.discountPercentage || 0,
    eightyPercentOfZestimate: filterResult.eightyPercentOfZestimate || 0,

    // Metadata
    source: 'scraper-v2-cash-deals',
    foundAt: new Date(),
  };
}

/**
 * Create document data for unified 'properties' collection
 *
 * This is the NEW standard - all properties go to single collection
 * with dealTypes array indicating which filters passed.
 */
export function createUnifiedPropertyDoc(
  property: TransformedProperty,
  filterResult: FilterResult
): Record<string, any> {
  const now = new Date();

  return {
    ...property,

    // ===== UNIFIED DEAL TYPE TAGS =====
    dealTypes: filterResult.dealTypes,
    isOwnerFinance: filterResult.isOwnerFinance,
    isCashDeal: filterResult.isCashDeal,

    // ===== OWNER FINANCE FIELDS (if applicable) =====
    ownerFinanceVerified: filterResult.isOwnerFinance,
    matchedKeywords: filterResult.ownerFinanceKeywords || [],
    primaryKeyword: filterResult.primaryOwnerFinanceKeyword || null,
    financingType: filterResult.financingType?.financingType || null,
    allFinancingTypes: filterResult.financingType?.allTypes || [],
    financingTypeLabel: filterResult.financingType?.displayLabel || null,

    // ===== CASH DEAL FIELDS (if applicable) =====
    needsWork: filterResult.needsWork || false,
    needsWorkKeywords: filterResult.needsWorkKeywords || [],
    cashDealReason: filterResult.cashDealReason || null,
    discountPercentage: filterResult.discountPercentage || 0,
    eightyPercentOfZestimate: filterResult.eightyPercentOfZestimate || 0,

    // ===== FINANCING TERMS (initially null - can be updated later) =====
    downPaymentAmount: null,
    downPaymentPercent: null,
    monthlyPayment: null,
    interestRate: null,
    loanTermYears: null,
    balloonPaymentYears: null,

    // ===== STATUS TRACKING =====
    status: null,
    isActive: true,
    foundAt: now,
    verifiedAt: null,
    soldAt: null,

    // ===== METADATA =====
    nearbyCitiesSource: 'scraper-v2',
    nearbyCitiesUpdatedAt: now.toISOString(),
    createdAt: now,
    updatedAt: now,
  };
}
