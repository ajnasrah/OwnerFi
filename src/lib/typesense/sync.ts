/**
 * Typesense Sync Utilities
 *
 * Keeps Typesense in sync with Firestore.
 * Call these functions when properties are created/updated/deleted.
 */

import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from './client';
import { UnifiedProperty } from '../unified-property-schema';
import { Timestamp } from 'firebase/firestore';

// ============================================
// TRANSFORM PROPERTY FOR TYPESENSE
// ============================================
export interface TypesensePropertyDocument {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  description?: string;
  title?: string;
  location?: [number, number]; // [lat, lng]
  dealType: string;
  listPrice: number;
  monthlyPayment?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  yearBuilt?: number;
  zestimate?: number;
  discountPercent?: number;
  percentOfArv?: number;
  // Cash flow / rental fields
  rentEstimate?: number;
  annualTaxAmount?: number;
  propertyTaxRate?: number;
  monthlyHoa?: number;
  // Days on market
  daysOnZillow?: number;
  // Status
  isActive: boolean;
  isOwnerFinance?: boolean;
  isCashDeal?: boolean;
  ownerFinanceVerified?: boolean;
  needsWork?: boolean;
  manuallyVerified?: boolean;
  homeStatus?: string;
  // Metadata
  sourceType?: string;
  propertyType: string;
  financingType?: string;
  // IDs and URLs
  zpid?: string;
  url?: string;
  // Images
  primaryImage?: string;
  galleryImages?: string[];
  // Agent/Contact info
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  // Loan terms
  interestRate?: number;
  termYears?: number;
  balloonYears?: number;
  createdAt: number;
  updatedAt?: number;
  nearbyCities?: string[];
  ownerFinanceKeywords?: string[];
}

/**
 * Convert various timestamp formats to Unix milliseconds.
 * Handles:
 * - Firestore client SDK Timestamp (has toMillis())
 * - Firestore Admin SDK Timestamp (has _seconds, _nanoseconds or seconds, nanoseconds)
 * - Date objects
 * - ISO strings
 * - Unix timestamps (number)
 * Returns 0 for missing timestamps (not Date.now()) to ensure consistency.
 */
function timestampToUnix(ts: Timestamp | Date | string | number | { _seconds?: number; _nanoseconds?: number; seconds?: number; nanoseconds?: number } | undefined): number {
  if (!ts) return 0; // Return 0 instead of Date.now() for consistency
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  // Handle Firestore client SDK Timestamp
  if ('toMillis' in ts && typeof ts.toMillis === 'function') return ts.toMillis();
  // Handle Firestore Admin SDK Timestamp (has _seconds or seconds)
  if (typeof ts === 'object') {
    const seconds = (ts as any)._seconds ?? (ts as any).seconds;
    if (typeof seconds === 'number') {
      return seconds * 1000;
    }
    // Handle Date objects
    if (ts instanceof Date) {
      return ts.getTime();
    }
  }
  return 0;
}

export function transformPropertyForTypesense(
  property: UnifiedProperty
): TypesensePropertyDocument {
  return {
    id: property.id,
    address: property.address || '',
    city: property.city || '',
    state: property.state || '',
    zipCode: property.zipCode || '',
    description: property.description || undefined,
    title: property.title || undefined,

    // Geo point as [lat, lng] tuple
    location: property.latitude && property.longitude
      ? [property.latitude, property.longitude]
      : undefined,

    dealType: property.dealType,
    listPrice: property.listPrice || 0,
    monthlyPayment: property.ownerFinance?.monthlyPayment || undefined,
    downPaymentAmount: property.ownerFinance?.downPaymentAmount || undefined,
    bedrooms: property.bedrooms || 0,
    bathrooms: property.bathrooms || 0,
    squareFeet: property.squareFeet || undefined,
    yearBuilt: property.yearBuilt || undefined,
    zestimate: property.zestimate || undefined,
    discountPercent: property.cashDeal?.discountPercent || undefined,

    isActive: property.isActive,
    isOwnerFinance: property.dealType === 'owner_finance' || property.dealType === 'both' || !!property.ownerFinance?.verified,
    isCashDeal: property.dealType === 'cash_deal' || property.dealType === 'both' || !!property.cashDeal,
    ownerFinanceVerified: property.ownerFinance?.verified || undefined,
    needsWork: property.cashDeal?.needsWork || undefined,
    manuallyVerified: property.verification?.manuallyVerified || undefined,

    sourceType: property.source?.type || undefined,
    propertyType: property.propertyType || 'other',
    financingType: property.ownerFinance?.financingType || undefined,

    primaryImage: (property as any).primaryImage || property.images?.primary || property.imageUrl || undefined,

    createdAt: timestampToUnix(property.createdAt),
    updatedAt: timestampToUnix(property.updatedAt),

    nearbyCities: property.nearbyCities || undefined,
    ownerFinanceKeywords: property.ownerFinance?.matchedKeywords || undefined
  };
}

// ============================================
// SYNC OPERATIONS
// ============================================

/**
 * Index a single property in Typesense
 */
export async function indexProperty(property: UnifiedProperty): Promise<boolean> {
  const client = getTypesenseAdminClient();

  if (!client) {
    console.warn('[Typesense] Client not available, skipping index');
    return false;
  }

  try {
    const document = transformPropertyForTypesense(property);

    await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
      .documents()
      .upsert(document);

    return true;
  } catch (error) {
    console.error('[Typesense] Failed to index property:', property.id, error);
    return false;
  }
}

/**
 * Index multiple properties in batch
 */
export async function indexPropertiesBatch(
  properties: UnifiedProperty[],
  options: { batchSize?: number } = {}
): Promise<{ success: number; failed: number }> {
  const client = getTypesenseAdminClient();

  if (!client) {
    console.warn('[Typesense] Client not available, skipping batch index');
    return { success: 0, failed: properties.length };
  }

  const batchSize = options.batchSize || 100;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, i + batchSize);
    const documents = batch.map(transformPropertyForTypesense);

    try {
      const results = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
        .documents()
        .import(documents, { action: 'upsert' });

      // Count successes and failures
      for (const result of results) {
        if (result.success) {
          success++;
        } else {
          failed++;
          console.error('[Typesense] Failed to import:', result.error);
        }
      }

      console.log(`[Typesense] Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} documents processed`);

    } catch (error) {
      console.error('[Typesense] Batch import failed:', error);
      failed += batch.length;
    }
  }

  return { success, failed };
}

/**
 * Delete a property from Typesense
 */
export async function deletePropertyFromIndex(propertyId: string): Promise<boolean> {
  const client = getTypesenseAdminClient();

  if (!client) {
    return false;
  }

  try {
    await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
      .documents(propertyId)
      .delete();

    return true;
  } catch (error) {
    // Document might not exist, that's ok
    console.warn('[Typesense] Failed to delete property:', propertyId, error);
    return false;
  }
}

/**
 * Update property status (quick update for common changes)
 */
export async function updatePropertyStatus(
  propertyId: string,
  updates: Partial<Pick<TypesensePropertyDocument, 'isActive' | 'updatedAt'>>
): Promise<boolean> {
  const client = getTypesenseAdminClient();

  if (!client) {
    return false;
  }

  try {
    await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
      .documents(propertyId)
      .update({
        ...updates,
        updatedAt: Date.now()
      });

    return true;
  } catch (error) {
    console.error('[Typesense] Failed to update property:', propertyId, error);
    return false;
  }
}

// ============================================
// CITY INDEXING
// ============================================

export interface TypesenseCityDocument {
  id: string;
  name: string;
  state: string;
  location: [number, number];
  population: number;
}

export async function indexCitiesBatch(
  cities: Array<{
    name: string;
    state: string;
    lat: number;
    lng: number;
    population?: number;
  }>
): Promise<{ success: number; failed: number }> {
  const client = getTypesenseAdminClient();

  if (!client) {
    return { success: 0, failed: cities.length };
  }

  // Create stable IDs using city name + state (not array index)
  const documents: TypesenseCityDocument[] = cities.map((city) => ({
    // Stable ID: state-normalized_city_name (e.g., "TX-houston")
    id: `${city.state}-${city.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    name: city.name,
    state: city.state,
    location: [city.lat, city.lng],
    population: city.population || 0
  }));

  try {
    const results = await client.collections(TYPESENSE_COLLECTIONS.CITIES)
      .documents()
      .import(documents, { action: 'upsert' });

    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return { success, failed };

  } catch (error) {
    console.error('[Typesense] Cities batch import failed:', error);
    return { success: 0, failed: cities.length };
  }
}

// ============================================
// RAW FIRESTORE PROPERTY INDEXING
// ============================================

/**
 * Index a raw Firestore property document (from zillow_imports or cash_houses)
 * This is a simpler interface that doesn't require UnifiedProperty format
 */
export async function indexRawFirestoreProperty(
  propertyId: string,
  data: Record<string, any>,
  source: 'zillow_imports' | 'cash_houses' | 'properties'
): Promise<boolean> {
  const client = getTypesenseAdminClient();

  if (!client) {
    console.warn('[Typesense] Client not available, skipping index');
    return false;
  }

  try {
    // Determine deal type from unified collection flags (isOwnerFinance, isCashDeal)
    // For backward compatibility, also check source collection name
    let dealType = 'owner_finance'; // default
    const isOwnerFinance = data.isOwnerFinance === true || source === 'zillow_imports';
    const isCashDeal = data.isCashDeal === true || source === 'cash_houses' || data.discountPercentage > 15;

    if (isOwnerFinance && isCashDeal) {
      dealType = 'both';
    } else if (isCashDeal) {
      dealType = 'cash_deal';
    } else if (isOwnerFinance) {
      dealType = 'owner_finance';
    }

    // Build location tuple if coordinates exist
    const lat = data.latitude || data.lat;
    const lng = data.longitude || data.lng;
    const location: [number, number] | undefined = lat && lng ? [lat, lng] : undefined;

    // Calculate percentOfArv if we have the data
    const zestimate = data.estimate || data.zestimate || data.arv || 0;
    const price = data.price || data.listPrice || 0;
    const percentOfArv = data.percentOfArv || (zestimate > 0 ? Math.round((price / zestimate) * 1000) / 10 : undefined);

    const document: TypesensePropertyDocument = {
      id: propertyId,
      address: data.streetAddress || data.fullAddress || data.address || '',
      city: data.city || '',
      state: data.state || '',
      zipCode: data.zipCode || data.zipcode || '',
      description: data.description || undefined,
      title: data.title || undefined,
      location,
      dealType,
      listPrice: price,
      monthlyPayment: data.monthlyPayment || undefined,
      downPaymentAmount: data.downPaymentAmount || undefined,
      downPaymentPercent: data.downPaymentPercent || undefined,
      bedrooms: data.bedrooms || data.beds || 0,
      bathrooms: data.bathrooms || data.baths || 0,
      squareFeet: data.squareFoot || data.squareFeet || data.sqft || undefined,
      yearBuilt: data.yearBuilt || undefined,
      zestimate: zestimate || undefined,
      discountPercent: data.discountPercentage || data.discount || undefined,
      percentOfArv,
      // Cash flow / rental fields
      rentEstimate: typeof data.rentEstimate === 'number' ? data.rentEstimate : (typeof data.rentZestimate === 'number' ? data.rentZestimate : undefined),
      annualTaxAmount: data.annualTaxAmount || data.taxAmount || undefined,
      propertyTaxRate: data.propertyTaxRate || undefined,
      monthlyHoa: data.hoa || data.hoaFees || undefined,
      // Days on market
      daysOnZillow: data.daysOnZillow || undefined,
      // Status
      isActive: data.isActive !== false && data.status !== 'inactive',
      isOwnerFinance,
      isCashDeal,
      ownerFinanceVerified: data.ownerFinanceVerified || false,
      needsWork: data.needsWork || false,
      manuallyVerified: data.manuallyVerified || false,
      homeStatus: data.homeStatus || data.status || undefined,
      // Metadata
      sourceType: data.source || source,
      propertyType: data.homeType || data.propertyType || 'other',
      financingType: data.financingType || undefined,
      // IDs and URLs
      zpid: data.zpid ? String(data.zpid) : undefined,
      url: data.url || data.hdpUrl || undefined,
      // Images
      primaryImage: data.firstPropertyImage || data.imgSrc || data.imageUrl || undefined,
      galleryImages: data.propertyImages || data.imageUrls || undefined,
      // Agent/Contact info
      agentName: data.agentName || data.listingAgentName || undefined,
      agentPhone: data.agentPhoneNumber || data.agentPhone || data.brokerPhoneNumber || undefined,
      agentEmail: data.agentEmail || data.listingAgentEmail || undefined,
      // Loan terms
      interestRate: data.interestRate || undefined,
      termYears: data.termYears || data.loanTermYears || undefined,
      balloonYears: data.balloonYears || undefined,
      createdAt: timestampToUnix(data.createdAt || data.foundAt || data.importedAt),
      updatedAt: timestampToUnix(data.updatedAt),
      nearbyCities: data.nearbyCities || undefined,
      ownerFinanceKeywords: data.matchedKeywords || undefined
    };

    await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
      .documents()
      .upsert(document);

    console.log(`[Typesense] Indexed property: ${propertyId}`);
    return true;
  } catch (error) {
    console.error('[Typesense] Failed to index raw property:', propertyId, error);
    return false;
  }
}

// ============================================
// STATS & MONITORING
// ============================================

export async function getIndexStats(): Promise<{
  properties: { count: number } | null;
  cities: { count: number } | null;
  buyerLeads: { count: number } | null;
}> {
  const client = getTypesenseAdminClient();

  if (!client) {
    return { properties: null, cities: null, buyerLeads: null };
  }

  const stats: {
    properties: { count: number } | null;
    cities: { count: number } | null;
    buyerLeads: { count: number } | null;
  } = {
    properties: null,
    cities: null,
    buyerLeads: null
  };

  try {
    const propertiesCollection = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES).retrieve();
    stats.properties = { count: propertiesCollection.num_documents || 0 };
  } catch { /* Collection might not exist */ }

  try {
    const citiesCollection = await client.collections(TYPESENSE_COLLECTIONS.CITIES).retrieve();
    stats.cities = { count: citiesCollection.num_documents || 0 };
  } catch { /* Collection might not exist */ }

  try {
    const leadsCollection = await client.collections(TYPESENSE_COLLECTIONS.BUYER_LEADS).retrieve();
    stats.buyerLeads = { count: leadsCollection.num_documents || 0 };
  } catch { /* Collection might not exist */ }

  return stats;
}
