/**
 * Typesense Client Configuration
 *
 * Fast search engine for properties, cities, and buyer leads.
 * Replaces slow Firestore queries with <10ms search responses.
 */

import Typesense, { Client } from 'typesense';

// ============================================
// ENVIRONMENT VALIDATION
// ============================================
function validateEnv() {
  const required = [
    'TYPESENSE_HOST',
    'TYPESENSE_API_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`[Typesense] Missing env vars: ${missing.join(', ')}. Search will fall back to Firestore.`);
    return false;
  }

  return true;
}

// ============================================
// ADMIN CLIENT (Full access - server only)
// ============================================
let adminClient: Client | null = null;

export function getTypesenseAdminClient(): Client | null {
  if (!validateEnv()) return null;

  if (!adminClient) {
    adminClient = new Typesense.Client({
      nodes: [{
        host: process.env.TYPESENSE_HOST!,
        port: parseInt(process.env.TYPESENSE_PORT || '443'),
        protocol: process.env.TYPESENSE_PROTOCOL || 'https'
      }],
      apiKey: process.env.TYPESENSE_API_KEY!,
      connectionTimeoutSeconds: 5,
      retryIntervalSeconds: 0.1,
      numRetries: 3
    });
  }

  return adminClient;
}

// ============================================
// SEARCH CLIENT (Read-only - can be used on frontend)
// ============================================
let searchClient: Client | null = null;

export function getTypesenseSearchClient(): Client | null {
  // Prefer search-only key for security
  const searchKey = process.env.TYPESENSE_SEARCH_API_KEY;
  const adminKey = process.env.TYPESENSE_API_KEY;

  if (!process.env.TYPESENSE_HOST) {
    return null;
  }

  // Warn if using admin key as fallback (security concern)
  if (!searchKey && adminKey) {
    console.warn('[Typesense] Using admin API key for search. Set TYPESENSE_SEARCH_API_KEY for better security.');
  }

  const apiKey = searchKey || adminKey;
  if (!apiKey) {
    return null;
  }

  if (!searchClient) {
    searchClient = new Typesense.Client({
      nodes: [{
        host: process.env.TYPESENSE_HOST!,
        port: parseInt(process.env.TYPESENSE_PORT || '443'),
        protocol: process.env.TYPESENSE_PROTOCOL || 'https'
      }],
      apiKey,
      connectionTimeoutSeconds: 2,
      retryIntervalSeconds: 0.1,
      numRetries: 2
    });
  }

  return searchClient;
}

// ============================================
// HEALTH CHECK
// ============================================
export async function checkTypesenseHealth(): Promise<{
  available: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const client = getTypesenseAdminClient();

  if (!client) {
    return { available: false, error: 'Typesense not configured' };
  }

  const start = Date.now();

  try {
    await client.health.retrieve();
    return {
      available: true,
      latencyMs: Date.now() - start
    };
  } catch (error) {
    return {
      available: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================
// COLLECTION NAMES
// ============================================
export const TYPESENSE_COLLECTIONS = {
  PROPERTIES: 'properties',
  CITIES: 'cities',
  BUYER_LEADS: 'buyer_leads'
} as const;

// ============================================
// SEARCH HELPERS
// ============================================
export interface SearchOptions {
  query?: string;
  filterBy?: string;
  sortBy?: string;
  page?: number;
  perPage?: number;
  facetBy?: string;
  groupBy?: string;
}

export async function searchProperties(options: SearchOptions) {
  const client = getTypesenseSearchClient();

  if (!client) {
    throw new Error('Typesense not available');
  }

  const searchParams = {
    q: options.query || '*',
    query_by: 'address,city,description',
    filter_by: options.filterBy || '',
    sort_by: options.sortBy || 'createdAt:desc',
    page: options.page || 1,
    per_page: options.perPage || 20,
    facet_by: options.facetBy || '',
    group_by: options.groupBy || ''
  };

  // Remove empty params
  Object.keys(searchParams).forEach(key => {
    if (searchParams[key as keyof typeof searchParams] === '') {
      delete searchParams[key as keyof typeof searchParams];
    }
  });

  return client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
    .documents()
    .search(searchParams);
}

export async function searchCities(query: string, state?: string) {
  const client = getTypesenseSearchClient();

  if (!client) {
    throw new Error('Typesense not available');
  }

  const filterBy = state ? `state:=${state}` : '';

  return client.collections(TYPESENSE_COLLECTIONS.CITIES)
    .documents()
    .search({
      q: query,
      query_by: 'name',
      filter_by: filterBy,
      sort_by: 'population:desc',
      per_page: 10
    });
}
