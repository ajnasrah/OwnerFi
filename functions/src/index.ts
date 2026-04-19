/**
 * Firebase Cloud Functions for Typesense Auto-Sync
 *
 * Automatically syncs the 'properties' collection to Typesense
 * whenever documents are created, updated, or deleted.
 */

import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import Typesense from 'typesense';

// Initialize Firebase Admin
initializeApp();

// All raw Zillow homeType values that represent land
const LAND_TYPES = new Set(['land', 'lot', 'lots', 'vacant_land', 'farm', 'ranch']);

// Get Typesense config from environment
const typesenseConfig = {
  host: process.env.TYPESENSE_HOST || '',
  apiKey: process.env.TYPESENSE_API_KEY || '',
};

// Initialize Typesense client
function getTypesenseClient() {
  if (!typesenseConfig.host || !typesenseConfig.apiKey) {
    console.error('Typesense config missing. Set TYPESENSE_HOST and TYPESENSE_API_KEY.');
    return null;
  }

  return new Typesense.Client({
    nodes: [{
      host: typesenseConfig.host,
      port: 443,
      protocol: 'https'
    }],
    apiKey: typesenseConfig.apiKey,
    connectionTimeoutSeconds: 10
  });
}

// Transform Firestore doc to Typesense doc
function transformToTypesense(docId: string, data: FirebaseFirestore.DocumentData) {
  // Distressed listings (auction, foreclosure, bank-owned) are never
  // owner_finance — the posted price is an opening bid or estimated value,
  // not a seller's asking price.
  const isDistressed = data.isAuction === true || data.isForeclosure === true || data.isBankOwned === true;

  // Derive deal classification from every source of truth the doc might
  // carry: the unified dealTypes array (preferred, set by scraper v2 +
  // manual-add flip), the legacy boolean flags, and the legacy singular
  // dealType string. Distressed listings are forced to cash_deal.
  const existingDealTypes: string[] = Array.isArray(data.dealTypes) ? data.dealTypes : [];
  const isOwnerfinance = isDistressed
    ? false
    : (data.isOwnerfinance === true || existingDealTypes.includes('owner_finance'));
  const isCashDeal = data.isCashDeal === true
    || existingDealTypes.includes('cash_deal')
    || isDistressed;

  let dealType = data.dealType || 'unknown';
  if (isOwnerfinance && isCashDeal) dealType = 'both';
  else if (isCashDeal) dealType = 'cash_deal';
  else if (isOwnerfinance) dealType = 'owner_finance';

  // dealTypes array — Typesense schema defines it as string[] facet; code
  // that queries Typesense (newer paths) filters on dealTypes, not the
  // scalar. Keep both in sync.
  const dealTypes: string[] = [];
  if (isOwnerfinance) dealTypes.push('owner_finance');
  if (isCashDeal) dealTypes.push('cash_deal');

  // Handle location
  const lat = data.latitude || data.lat;
  const lng = data.longitude || data.lng;

  // Handle rent estimate (ensure it's a number)
  let rentEstimate = data.rentEstimate || data.rentZestimate;
  if (typeof rentEstimate === 'string') {
    rentEstimate = parseInt(rentEstimate, 10) || undefined;
  }

  // Calculate percentOfArv if not stored
  const zestimate = data.zestimate || data.estimate || 0;
  const price = data.listPrice || data.price || 0;
  const percentOfArv = data.percentOfArv || (zestimate > 0 ? Math.round((price / zestimate) * 1000) / 10 : undefined);

  return {
    id: docId,
    address: data.streetAddress || data.address?.split(',')[0]?.trim() || '',
    city: data.city || '',
    state: data.state || '',
    zipCode: data.zipCode || data.zipcode || '',
    description: data.description || '',
    location: lat && lng ? [lat, lng] : undefined,
    dealType,
    dealTypes,
    listPrice: price,
    bedrooms: data.bedrooms || 0,
    bathrooms: data.bathrooms || 0,
    squareFeet: (data.squareFeet || data.squareFoot) ? Math.round(data.squareFeet || data.squareFoot) : undefined,
    yearBuilt: data.yearBuilt || undefined,
    isActive: data.isActive !== false,
    propertyType: data.homeType || data.propertyType || 'single-family',
    primaryImage: data.primaryImage || data.firstPropertyImage || data.hiResImageLink || data.mediumImageLink || data.imgSrc || data.imageUrl || (data.propertyImages || [])[0] || (data.imageUrls || [])[0] || undefined,
    galleryImages: data.propertyImages || data.imageUrls || undefined,
    createdAt: data.createdAt?.toMillis?.() || Date.now(),
    updatedAt: data.updatedAt?.toMillis?.() || undefined,
    nearbyCities: data.nearbyCities || [],
    ownerFinanceKeywords: data.matchedKeywords || [],
    // Owner finance fields
    monthlyPayment: data.monthlyPayment || undefined,
    downPaymentAmount: data.downPaymentAmount || undefined,
    downPaymentPercent: data.downPaymentPercent || undefined,
    interestRate: data.interestRate || undefined,
    termYears: data.termYears || data.loanTermYears || undefined,
    balloonYears: data.balloonYears || undefined,
    financingType: data.financingType || undefined,
    // ownerFinanceVerified: never true for distressed — auction/foreclosure/REO
    // aren't traditional owner-finance sales, so verification doesn't apply.
    ownerFinanceVerified: isDistressed ? false : (data.ownerFinanceVerified || data.isOwnerfinance || false),
    // Cash deal fields
    zestimate: zestimate || undefined,
    rentEstimate,
    percentOfArv,
    discountPercent: data.discountPercentage || data.discount || undefined,
    needsWork: data.needsWork || false,
    // Fixer: Zestimate spread > $150k — UI must hide estimate + discount
    isFixer: data.isFixer || false,
    cashDealReason: data.cashDealReason || undefined,
    isLand: data.isLand || LAND_TYPES.has((data.homeType || data.propertyType || '').toLowerCase()) || false,
    // Distressed-listing flags — `listPrice` is an opening bid or estimated
    // value, not a seller's asking price. UI renders "Est." + badge.
    isAuction: data.isAuction === true,
    isForeclosure: data.isForeclosure === true,
    isBankOwned: data.isBankOwned === true,
    listingSubType: data.listingSubType || '',
    // Status & metadata
    manuallyVerified: data.manuallyVerified || undefined,
    homeStatus: data.homeStatus || data.status || undefined,
    sourceType: data.source || undefined,
    // URLs & IDs
    zpid: data.zpid ? String(data.zpid) : undefined,
    url: data.url || (data.hdpUrl ? (data.hdpUrl.startsWith('http') ? data.hdpUrl : `https://www.zillow.com${data.hdpUrl}`) : undefined),
    // Agent/Contact info
    agentName: data.agentName || data.listingAgentName || undefined,
    agentPhone: data.agentPhoneNumber || data.agentPhone || data.brokerPhoneNumber || undefined,
    agentEmail: data.agentEmail || data.listingAgentEmail || undefined,
    // Cash flow
    annualTaxAmount: data.annualTaxAmount || data.taxAmount || undefined,
    propertyTaxRate: data.propertyTaxRate || undefined,
    monthlyHoa: data.hoa || data.hoaFees || undefined,
    daysOnZillow: data.daysOnZillow || undefined,
  };
}

/**
 * Sync property to Typesense on CREATE
 */
export const onPropertyCreate = onDocumentCreated('properties/{propertyId}', async (event) => {
  const client = getTypesenseClient();
  if (!client || !event.data) return;

  const data = event.data.data();
  const docId = event.params.propertyId;

  // Skip if not active or doesn't have required data
  if (data.isActive === false) {
    console.log(`Skipping inactive property: ${docId}`);
    return;
  }

  // Skip garbage prices ($1 auctions, placeholder prices, data errors)
  const price = data.listPrice || data.price || 0;
  if (price < 10000) {
    console.log(`Skipping property with garbage price ($${price}): ${docId}`);
    return;
  }

  // Skip if neither owner finance nor cash deal. Check all three sources:
  // dealTypes array (preferred), dealType scalar (legacy GHL imports), and
  // boolean flags (legacy scraper). Docs written only with dealTypes array
  // (e.g. manual-add flip in /v2/scraper/add) used to be dropped here.
  const dealTypesArr: string[] = Array.isArray(data.dealTypes) ? data.dealTypes : [];
  const hasOwnerFinance = data.isOwnerfinance === true
    || data.dealType === 'owner_finance'
    || data.dealType === 'both'
    || dealTypesArr.includes('owner_finance');
  const hasCashDeal = data.isCashDeal === true
    || data.dealType === 'cash_deal'
    || data.dealType === 'both'
    || dealTypesArr.includes('cash_deal');
  if (!hasOwnerFinance && !hasCashDeal) {
    console.log(`Skipping property without deal type: ${docId}`);
    return;
  }

  try {
    const typesenseDoc = transformToTypesense(docId, data);
    await client.collections('properties').documents().upsert(typesenseDoc);
    console.log(`Synced new property to Typesense: ${docId}`);
  } catch (error) {
    console.error(`Failed to sync property ${docId}:`, error);
  }
});

/**
 * Sync property to Typesense on UPDATE
 */
export const onPropertyUpdate = onDocumentUpdated('properties/{propertyId}', async (event) => {
  const client = getTypesenseClient();
  if (!client || !event.data) return;

  const data = event.data.after.data();
  const docId = event.params.propertyId;

  // If property became inactive or sold, delete from Typesense
  if (data.isActive === false || data.status === 'sold' || data.status === 'inactive') {
    try {
      await client.collections('properties').documents(docId).delete();
      console.log(`Deleted inactive/sold property from Typesense: ${docId}`);
    } catch (error: any) {
      if (error.httpStatus !== 404) {
        console.error(`Failed to delete property ${docId}:`, error);
      }
    }
    return;
  }

  // Same triple-source check as onPropertyCreate — dealTypes array first,
  // then scalar, then boolean flags.
  const dealTypesArrUpd: string[] = Array.isArray(data.dealTypes) ? data.dealTypes : [];
  const hasOwnerFinanceUpdate = data.isOwnerfinance === true
    || data.dealType === 'owner_finance'
    || data.dealType === 'both'
    || dealTypesArrUpd.includes('owner_finance');
  const hasCashDealUpdate = data.isCashDeal === true
    || data.dealType === 'cash_deal'
    || data.dealType === 'both'
    || dealTypesArrUpd.includes('cash_deal');
  if (!hasOwnerFinanceUpdate && !hasCashDealUpdate) {
    // Remove from Typesense if it was there
    try {
      await client.collections('properties').documents(docId).delete();
      console.log(`Removed non-deal property from Typesense: ${docId}`);
    } catch (error: any) {
      if (error.httpStatus !== 404) {
        console.error(`Failed to delete property ${docId}:`, error);
      }
    }
    return;
  }

  try {
    const typesenseDoc = transformToTypesense(docId, data);
    await client.collections('properties').documents().upsert(typesenseDoc);
    console.log(`Updated property in Typesense: ${docId}`);
  } catch (error) {
    console.error(`Failed to update property ${docId}:`, error);
  }
});

/**
 * Remove property from Typesense on DELETE
 */
export const onPropertyDelete = onDocumentDeleted('properties/{propertyId}', async (event) => {
  const client = getTypesenseClient();
  if (!client) return;

  const docId = event.params.propertyId;

  try {
    await client.collections('properties').documents(docId).delete();
    console.log(`Deleted property from Typesense: ${docId}`);
  } catch (error: any) {
    if (error.httpStatus !== 404) {
      console.error(`Failed to delete property ${docId}:`, error);
    }
  }
});
