/**
 * Property SEO Library
 *
 * Handles fetching properties from unified properties collection for SEO purposes.
 * All property types (owner finance, cash deals) are in the unified 'properties' collection
 * with flags: isOwnerFinance, isCashDeal, dealTypes[]
 *
 * Generates SEO-friendly slugs and canonical URLs
 */

import { getAdminDb } from '@/lib/firebase-admin';
import { cache } from 'react';

export interface SEOProperty {
  id: string;
  zpid?: number | string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  listPrice?: number;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  propertyType?: string;
  homeType?: string;
  description?: string;
  imageUrls?: string[];
  firstPropertyImage?: string;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  monthlyPayment?: number;
  interestRate?: number;
  termYears?: number;
  balloonYears?: number;
  status?: string;
  isActive?: boolean;
  latitude?: number;
  longitude?: number;
  features?: string[];
  appliances?: string[];
  lotSize?: number;
  stories?: number;
  garage?: number;
  heating?: string;
  cooling?: string;
  hoa?: {
    hasHOA: boolean;
    monthlyFee?: number;
  };
  dateAdded?: string;
  createdAt?: string;
  lastUpdated?: string;
  updatedAt?: string;
  source: 'properties';
  slug: string;
}

/**
 * Generate SEO-friendly slug from property data
 * Format: address-city-state_ID (underscore before ID for reliable parsing)
 */
export function generateSlug(property: any): string {
  const address = property.address || property.streetAddress || property.fullAddress || '';
  const city = property.city || '';
  const state = property.state || '';
  const id = String(property.id || property.zpid || '');

  // Create slug from address
  const addressSlug = address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const citySlug = city
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const stateSlug = state.toLowerCase().replace(/[^a-z]+/g, '');

  // Format: address-city-state_ID (underscore before ID for reliable parsing)
  // Example: 123-main-st-memphis-tn_2086503316
  const base = `${addressSlug}-${citySlug}-${stateSlug}`.replace(/--+/g, '-').replace(/^-+|-+$/g, '');
  return `${base}_${id}`;
}

/**
 * Parse slug to extract property ID
 * ID is after the underscore separator
 */
export function parseSlug(slug: string): { id: string } {
  // ID is after the underscore
  const underscoreIndex = slug.lastIndexOf('_');
  if (underscoreIndex !== -1) {
    return { id: slug.substring(underscoreIndex + 1) };
  }

  // Fallback: try last hyphen segment (for old URLs)
  const parts = slug.split('-');
  return { id: parts[parts.length - 1] };
}

/**
 * Fetch property by slug from all collections
 * Uses React cache for deduplication during rendering
 */
export const getPropertyBySlug = cache(async (slug: string): Promise<SEOProperty | null> => {
  try {
    const db = await getAdminDb();
    if (!db) {
      console.error('[SEO] Firebase Admin not initialized');
      return null;
    }

    const { id } = parseSlug(slug);

    // Try to find property in all collections
    // Priority: properties > zillow_imports > cash_houses

    // 1. Check properties collection (GHL confirmed)
    // Check unified properties collection by doc ID
    const propertiesDoc = await db.collection('properties').doc(id).get();
    if (propertiesDoc.exists) {
      const data = propertiesDoc.data()!;
      return normalizeProperty(data, propertiesDoc.id, 'properties');
    }

    // Try with zpid_ prefix
    const zpidDoc = await db.collection('properties').doc(`zpid_${id}`).get();
    if (zpidDoc.exists) {
      const data = zpidDoc.data()!;
      return normalizeProperty(data, zpidDoc.id, 'properties');
    }

    // Try searching by ZPID field
    const zpidNum = parseInt(id, 10);
    if (!isNaN(zpidNum)) {
      const byZpid = await db.collection('properties')
        .where('zpid', '==', zpidNum)
        .limit(1)
        .get();

      if (!byZpid.empty) {
        const doc = byZpid.docs[0];
        return normalizeProperty(doc.data(), doc.id, 'properties');
      }
    }

    return null;
  } catch (error) {
    console.error('[SEO] Error fetching property:', error);
    return null;
  }
});

/**
 * Get all property slugs for static generation
 * Uses unified properties collection only
 */
export async function getAllPropertySlugs(): Promise<string[]> {
  try {
    const db = await getAdminDb();
    if (!db) {
      console.error('[SEO] Firebase Admin not initialized');
      return [];
    }

    const slugs: string[] = [];

    // Fetch from unified properties collection
    const propertiesSnap = await db.collection('properties')
      .where('isActive', '==', true)
      .select('address', 'streetAddress', 'fullAddress', 'city', 'state', 'zpid')
      .get();

    propertiesSnap.docs.forEach(doc => {
      const data = doc.data();
      const slug = generateSlug({
        address: data.address || data.streetAddress || data.fullAddress,
        city: data.city,
        state: data.state,
        id: data.zpid || doc.id
      });
      slugs.push(slug);
    });

    console.log(`[SEO] Generated ${slugs.length} property slugs`);
    return slugs;
  } catch (error) {
    console.error('[SEO] Error fetching slugs:', error);
    return [];
  }
}

/**
 * Get all properties for sitemap generation
 * Uses unified properties collection only
 */
export async function getAllPropertiesForSitemap(): Promise<Array<{
  slug: string;
  lastModified: Date;
  city: string;
  state: string;
}>> {
  try {
    const db = await getAdminDb();
    if (!db) {
      return [];
    }

    const properties: Array<{ slug: string; lastModified: Date; city: string; state: string }> = [];

    // Fetch from unified properties collection
    const propertiesSnap = await db.collection('properties')
      .where('isActive', '==', true)
      .select('address', 'streetAddress', 'fullAddress', 'city', 'state', 'zpid', 'lastUpdated', 'updatedAt', 'scrapedAt')
      .get();

    propertiesSnap.docs.forEach(doc => {
      const data = doc.data();
      properties.push({
        slug: generateSlug({
          address: data.address || data.streetAddress || data.fullAddress,
          city: data.city,
          state: data.state,
          id: data.zpid || doc.id,
        }),
        lastModified: parseDate(data.lastUpdated || data.updatedAt || data.scrapedAt),
        city: data.city || '',
        state: data.state || '',
      });
    });

    return properties;
  } catch (error) {
    console.error('[SEO] Error fetching properties for sitemap:', error);
    return [];
  }
}

/**
 * Normalize property data from unified properties collection
 */
function normalizeProperty(data: any, id: string, source: 'properties' = 'properties'): SEOProperty {
  return {
    id,
    zpid: data.zpid,
    address: data.address || data.streetAddress || data.fullAddress || '',
    city: data.city || '',
    state: data.state || '',
    zipCode: data.zipCode || data.zipcode || '',
    listPrice: data.listPrice || data.price,
    price: data.price || data.listPrice,
    bedrooms: data.bedrooms || data.beds,
    bathrooms: data.bathrooms || data.baths,
    squareFeet: data.squareFeet || data.squareFoot || data.livingArea,
    yearBuilt: data.yearBuilt,
    propertyType: data.propertyType || data.homeType,
    homeType: data.homeType || data.propertyType,
    description: data.description,
    imageUrls: data.imageUrls || data.propertyImages || [],
    firstPropertyImage: data.firstPropertyImage || data.imgSrc || data.imageUrls?.[0],
    downPaymentAmount: data.downPaymentAmount,
    downPaymentPercent: data.downPaymentPercent,
    monthlyPayment: data.monthlyPayment,
    interestRate: data.interestRate,
    termYears: data.termYears,
    balloonYears: data.balloonYears,
    status: data.status || 'active',
    isActive: data.isActive !== false,
    latitude: data.latitude,
    longitude: data.longitude,
    features: data.features,
    appliances: data.appliances,
    lotSize: data.lotSize,
    stories: data.stories,
    garage: data.garage,
    heating: data.heating,
    cooling: data.cooling,
    hoa: data.hoa,
    dateAdded: data.dateAdded,
    createdAt: data.createdAt,
    lastUpdated: data.lastUpdated,
    updatedAt: data.updatedAt,
    source,
    slug: generateSlug({ ...data, id: data.zpid || id }),
  };
}

/**
 * Parse various date formats to Date object
 */
function parseDate(value: any): Date {
  if (!value) return new Date();

  if (value instanceof Date) return value;

  // Firestore Timestamp
  if (value.toDate && typeof value.toDate === 'function') {
    return value.toDate();
  }

  // Firestore Timestamp object
  if (value._seconds) {
    return new Date(value._seconds * 1000);
  }

  // ISO string or other string format
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  // Unix timestamp
  if (typeof value === 'number') {
    return new Date(value);
  }

  return new Date();
}
