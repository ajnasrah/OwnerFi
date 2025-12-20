/**
 * Firebase Cloud Functions for Typesense Auto-Sync
 *
 * Automatically syncs the 'properties' collection to Typesense
 * whenever documents are created, updated, or deleted.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Typesense from 'typesense';

// Initialize Firebase Admin
admin.initializeApp();

// Get Typesense config from environment
const typesenseConfig = {
  host: process.env.TYPESENSE_HOST || functions.config().typesense?.host,
  apiKey: process.env.TYPESENSE_API_KEY || functions.config().typesense?.api_key,
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
  if (data.isOwnerFinance && data.isCashDeal) {
    dealType = 'both';
  } else if (data.isCashDeal) {
    dealType = 'cash_deal';
  } else if (data.isOwnerFinance) {
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

  return {
    id: docId,
    address: data.streetAddress || data.address?.split(',')[0]?.trim() || '',
    city: data.city || '',
    state: data.state || '',
    zipCode: data.zipCode || data.zipcode || '',
    description: data.description || '',
    location: lat && lng ? [lat, lng] : undefined,
    dealType,
    listPrice: data.price || data.listPrice || 0,
    bedrooms: data.bedrooms || 0,
    bathrooms: data.bathrooms || 0,
    squareFeet: data.squareFeet || data.squareFoot || undefined,
    yearBuilt: data.yearBuilt || undefined,
    isActive: data.isActive !== false,
    propertyType: data.homeType || data.propertyType || 'single-family',
    primaryImage: data.primaryImage || data.hiResImageLink || data.mediumImageLink || data.imgSrc || '',
    createdAt: data.createdAt?.toMillis?.() || Date.now(),
    nearbyCities: data.nearbyCities || [],
    ownerFinanceKeywords: data.matchedKeywords || [],
    monthlyPayment: data.monthlyPayment || undefined,
    downPaymentAmount: data.downPaymentAmount || undefined,
    zpid: data.zpid ? String(data.zpid) : undefined,
    zestimate: data.zestimate || undefined,
    rentEstimate,
    percentOfArv: data.percentOfArv || undefined,
    needsWork: data.needsWork || undefined,
    manuallyVerified: data.manuallyVerified || undefined,
    sourceType: data.source || undefined,
  };
}

/**
 * Sync property to Typesense on CREATE
 */
export const onPropertyCreate = functions.firestore
  .document('properties/{propertyId}')
  .onCreate(async (snapshot, context) => {
    const client = getTypesenseClient();
    if (!client) return;

    const data = snapshot.data();
    const docId = context.params.propertyId;

    // Skip if not active or doesn't have required data
    if (data.isActive === false) {
      console.log(`Skipping inactive property: ${docId}`);
      return;
    }

    // Skip if neither owner finance nor cash deal
    if (!data.isOwnerFinance && !data.isCashDeal) {
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
export const onPropertyUpdate = functions.firestore
  .document('properties/{propertyId}')
  .onUpdate(async (change, context) => {
    const client = getTypesenseClient();
    if (!client) return;

    const data = change.after.data();
    const docId = context.params.propertyId;

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
    if (!data.isOwnerFinance && !data.isCashDeal) {
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
export const onPropertyDelete = functions.firestore
  .document('properties/{propertyId}')
  .onDelete(async (snapshot, context) => {
    const client = getTypesenseClient();
    if (!client) return;

    const docId = context.params.propertyId;

    try {
      await client.collections('properties').documents(docId).delete();
      console.log(`Deleted property from Typesense: ${docId}`);
    } catch (error: any) {
      if (error.httpStatus !== 404) {
        console.error(`Failed to delete property ${docId}:`, error);
      }
    }
  });
