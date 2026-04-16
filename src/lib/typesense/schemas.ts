/**
 * Typesense Collection Schemas
 *
 * Defines the search index structure for fast property search.
 */

import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from './client';

// Schema type for collection creation
// Using 'as const' + explicit type to satisfy Typesense API
interface CollectionSchema {
  name: string;
  fields: Array<{
    name: string;
    type: string;
    facet?: boolean;
    optional?: boolean;
  }>;
  default_sorting_field?: string;
  enable_nested_fields?: boolean;
}

// ============================================
// PROPERTIES SCHEMA
// ============================================
export const propertiesSchema: CollectionSchema = {
  name: TYPESENSE_COLLECTIONS.PROPERTIES,
  fields: [
    // Searchable text fields
    { name: 'address', type: 'string' },
    { name: 'city', type: 'string', facet: true },
    { name: 'state', type: 'string', facet: true },
    { name: 'zipCode', type: 'string' },
    { name: 'description', type: 'string', optional: true },
    { name: 'title', type: 'string', optional: true },

    // Geo field for radius search
    { name: 'location', type: 'geopoint', optional: true },

    // Deal type - key discriminator (legacy scalar kept for backwards compat)
    { name: 'dealType', type: 'string', facet: true },
    // Deal types - array matching Firestore source of truth. Enables a single doc to be
    // both owner_finance and cash_deal without the scalar 'both' collapse.
    { name: 'dealTypes', type: 'string[]', facet: true, optional: true },

    // Numeric filters
    { name: 'listPrice', type: 'int32', facet: true },
    { name: 'monthlyPayment', type: 'int32', optional: true },
    { name: 'downPaymentAmount', type: 'int32', optional: true },
    { name: 'downPaymentPercent', type: 'float', optional: true },
    { name: 'bedrooms', type: 'int32', facet: true },
    { name: 'bathrooms', type: 'float', facet: true },
    { name: 'squareFeet', type: 'int32', optional: true },
    { name: 'yearBuilt', type: 'int32', optional: true },
    { name: 'zestimate', type: 'int32', optional: true },
    { name: 'discountPercent', type: 'float', optional: true },
    { name: 'percentOfArv', type: 'float', optional: true },

    // Cash flow / rental fields
    { name: 'rentEstimate', type: 'int32', optional: true },
    { name: 'annualTaxAmount', type: 'float', optional: true },
    { name: 'propertyTaxRate', type: 'float', optional: true },
    { name: 'monthlyHoa', type: 'int32', optional: true },

    // Days on market
    { name: 'daysOnZillow', type: 'int32', optional: true },

    // Boolean filters
    { name: 'isActive', type: 'bool', facet: true },
    { name: 'ownerFinanceVerified', type: 'bool', optional: true },
    { name: 'needsWork', type: 'bool', optional: true },
    { name: 'isFixer', type: 'bool', facet: true, optional: true },
    { name: 'cashDealReason', type: 'string', facet: true, optional: true },
    { name: 'isLand', type: 'bool', optional: true },
    { name: 'manuallyVerified', type: 'bool', optional: true },

    // Listing sub-type flags: price is NOT a standard asking price
    // (auction opening bid, foreclosure filing price, REO estimate).
    // UI prefixes "Est." and shows a badge when any of these is true.
    { name: 'isAuction', type: 'bool', facet: true, optional: true },
    { name: 'isForeclosure', type: 'bool', facet: true, optional: true },
    { name: 'isBankOwned', type: 'bool', facet: true, optional: true },
    { name: 'listingSubType', type: 'string', facet: true, optional: true },

    // Metadata
    { name: 'sourceType', type: 'string', facet: true, optional: true },
    { name: 'propertyType', type: 'string', facet: true },
    { name: 'financingType', type: 'string', facet: true, optional: true },
    { name: 'homeStatus', type: 'string', facet: true, optional: true },

    // IDs and URLs
    { name: 'zpid', type: 'string', optional: true },
    { name: 'url', type: 'string', optional: true },

    // Images
    { name: 'primaryImage', type: 'string', optional: true },
    { name: 'galleryImages', type: 'string[]', optional: true },

    // Agent/Contact info
    { name: 'agentName', type: 'string', optional: true },
    { name: 'agentPhone', type: 'string', optional: true },
    { name: 'agentEmail', type: 'string', optional: true },

    // Loan terms
    { name: 'interestRate', type: 'float', optional: true },
    { name: 'termYears', type: 'int32', optional: true },
    { name: 'balloonYears', type: 'int32', optional: true },

    // Timestamps (as int64 for sorting)
    { name: 'createdAt', type: 'int64' },
    { name: 'updatedAt', type: 'int64', optional: true },

    // Nearby cities for text search
    { name: 'nearbyCities', type: 'string[]', optional: true },

    // Keywords for full-text search
    { name: 'ownerFinanceKeywords', type: 'string[]', optional: true },
  ],
  default_sorting_field: 'createdAt',
  enable_nested_fields: false
};

// ============================================
// CITIES SCHEMA (for autocomplete)
// ============================================
export const citiesSchema: CollectionSchema = {
  name: TYPESENSE_COLLECTIONS.CITIES,
  fields: [
    { name: 'name', type: 'string' },
    { name: 'state', type: 'string', facet: true },
    { name: 'location', type: 'geopoint' },
    { name: 'population', type: 'int32' }
  ],
  default_sorting_field: 'population'
};

// ============================================
// BUYER LEADS SCHEMA (for realtor search)
// ============================================
export const buyerLeadsSchema: CollectionSchema = {
  name: TYPESENSE_COLLECTIONS.BUYER_LEADS,
  fields: [
    { name: 'preferredCity', type: 'string', facet: true },
    { name: 'preferredState', type: 'string', facet: true },
    { name: 'location', type: 'geopoint', optional: true },
    { name: 'searchRadius', type: 'int32' },
    { name: 'minPrice', type: 'int32', optional: true },
    { name: 'maxPrice', type: 'int32', optional: true },
    { name: 'minBedrooms', type: 'int32', optional: true },
    { name: 'maxBedrooms', type: 'int32', optional: true },
    { name: 'isAvailableForPurchase', type: 'bool', facet: true },
    { name: 'createdAt', type: 'int64' }
  ],
  default_sorting_field: 'createdAt'
};

// ============================================
// SCHEMA MANAGEMENT
// ============================================

/**
 * Sync a collection's schema by diffing defined fields vs live fields.
 * Adds any missing fields via PATCH (no downtime, no data loss).
 * Returns the list of fields that were added.
 */
export async function syncCollectionSchema(
  schema: CollectionSchema
): Promise<{ added: string[]; errors: string[] }> {
  const client = getTypesenseAdminClient();
  if (!client) throw new Error('Typesense admin client not available');

  const added: string[] = [];
  const errors: string[] = [];

  try {
    // Retrieve current live schema
    const liveCollection = await client.collections(schema.name).retrieve();
    const liveFieldNames = new Set(
      (liveCollection.fields || []).map((f: any) => f.name)
    );

    // Find fields defined in code but missing from live collection
    const missingFields = schema.fields.filter(f => !liveFieldNames.has(f.name));

    if (missingFields.length === 0) {
      console.log(`[Typesense] Schema '${schema.name}' is up to date`);
      return { added, errors };
    }

    console.log(`[Typesense] Schema '${schema.name}' has ${missingFields.length} missing field(s): ${missingFields.map(f => f.name).join(', ')}`);

    // PATCH: add missing fields to the live collection
    await client.collections(schema.name).update({
      fields: missingFields
    } as any);

    added.push(...missingFields.map(f => f.name));
    console.log(`[Typesense] Added ${added.length} field(s) to '${schema.name}': ${added.join(', ')}`);

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(msg);
    console.error(`[Typesense] Failed to sync schema '${schema.name}':`, msg);
  }

  return { added, errors };
}

/**
 * Sync all collection schemas — creates missing collections,
 * patches missing fields on existing ones.
 * This is the primary entry point for schema management.
 */
export async function syncAllSchemas(): Promise<{
  created: string[];
  synced: { collection: string; fieldsAdded: string[] }[];
  errors: { collection: string; error: string }[];
}> {
  const client = getTypesenseAdminClient();
  if (!client) throw new Error('Typesense admin client not available');

  const schemas = [propertiesSchema, citiesSchema, buyerLeadsSchema];
  const results = {
    created: [] as string[],
    synced: [] as { collection: string; fieldsAdded: string[] }[],
    errors: [] as { collection: string; error: string }[]
  };

  // Fetch existing collections ONCE
  let existingCollections: string[] = [];
  try {
    const collections = await client.collections().retrieve();
    existingCollections = collections.map(c => c.name);
  } catch (error) {
    console.error('[Typesense] Failed to retrieve collections:', error);
  }

  for (const schema of schemas) {
    try {
      if (existingCollections.includes(schema.name)) {
        // Collection exists — diff and patch missing fields
        const syncResult = await syncCollectionSchema(schema);
        if (syncResult.added.length > 0) {
          results.synced.push({ collection: schema.name, fieldsAdded: syncResult.added });
        }
        if (syncResult.errors.length > 0) {
          results.errors.push({ collection: schema.name, error: syncResult.errors.join('; ') });
        }
      } else {
        // Collection doesn't exist — create it
        await client.collections().create(schema as any);
        results.created.push(schema.name);
        console.log(`[Typesense] Created collection '${schema.name}'`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push({ collection: schema.name, error: errorMessage });
      console.error(`[Typesense] Failed to process '${schema.name}':`, errorMessage);
    }
  }

  return results;
}

/** @deprecated Use syncAllSchemas() instead — it creates AND patches */
export async function createAllSchemas(): Promise<{
  created: string[];
  skipped: string[];
  errors: { collection: string; error: string }[];
}> {
  const result = await syncAllSchemas();
  return {
    created: result.created,
    skipped: [], // syncAllSchemas patches instead of skipping
    errors: result.errors,
  };
}

export async function deleteCollection(name: string): Promise<boolean> {
  const client = getTypesenseAdminClient();

  if (!client) {
    throw new Error('Typesense admin client not available');
  }

  try {
    await client.collections(name).delete();
    console.log(`[Typesense] Deleted collection '${name}'`);
    return true;
  } catch (error) {
    console.error(`[Typesense] Failed to delete '${name}':`, error);
    return false;
  }
}

export async function recreateCollection(name: string): Promise<boolean> {
  const schemas: Record<string, CollectionSchema> = {
    [TYPESENSE_COLLECTIONS.PROPERTIES]: propertiesSchema,
    [TYPESENSE_COLLECTIONS.CITIES]: citiesSchema,
    [TYPESENSE_COLLECTIONS.BUYER_LEADS]: buyerLeadsSchema
  };

  const schema = schemas[name];
  if (!schema) {
    throw new Error(`Unknown collection: ${name}`);
  }

  const client = getTypesenseAdminClient();
  if (!client) {
    throw new Error('Typesense admin client not available');
  }

  // Delete if exists
  try {
    await client.collections(name).delete();
    console.log(`[Typesense] Deleted existing collection '${name}'`);
  } catch {
    // Collection might not exist, that's ok
  }

  // Create fresh
  await client.collections().create(schema as any);
  console.log(`[Typesense] Created fresh collection '${name}'`);

  return true;
}
