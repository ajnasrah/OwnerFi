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
  // Determine dealType from flags
  let dealType = 'owner_finance';
  if (data.isOwnerfinance && data.isCashDeal) {
    dealType = 'both';
  } else if (data.isCashDeal) {
    dealType = 'cash_deal';
  } else if (data.isOwnerfinance) {
    dealType = 'owner_finance';
  }

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
    listPrice: price,
    bedrooms: data.bedrooms || 0,
    bathrooms: data.bathrooms || 0,
    squareFeet: (data.squareFeet || data.squareFoot) ? Math.round(data.squareFeet || data.squareFoot) : undefined,
    yearBuilt: data.yearBuilt || undefined,
    isActive: data.isActive !== false,
    propertyType: data.homeType || data.propertyType || 'single-family',
    primaryImage: data.primaryImage || data.firstPropertyImage || data.hiResImageLink || data.mediumImageLink || data.imgSrc || '',
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
    ownerFinanceVerified: data.ownerFinanceVerified || data.isOwnerfinance || false,
    // Cash deal fields
    zestimate: zestimate || undefined,
    rentEstimate,
    percentOfArv,
    discountPercent: data.discountPercentage || data.discount || undefined,
    needsWork: data.needsWork || false,
    isLand: data.isLand || LAND_TYPES.has((data.homeType || data.propertyType || '').toLowerCase()) || false,
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

  // Skip if neither owner finance nor cash deal
  if (!data.isOwnerfinance && !data.isCashDeal) {
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

  // Skip if neither owner finance nor cash deal
  if (!data.isOwnerfinance && !data.isCashDeal) {
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
