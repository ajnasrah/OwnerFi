/**
 * Typesense Module Exports
 *
 * Fast search engine integration for OwnerFi.
 */

// Client
export {
  getTypesenseAdminClient,
  getTypesenseSearchClient,
  checkTypesenseHealth,
  searchProperties,
  searchCities,
  TYPESENSE_COLLECTIONS
} from './client';

// Schemas
export {
  propertiesSchema,
  citiesSchema,
  buyerLeadsSchema,
  createAllSchemas,
  deleteCollection,
  recreateCollection
} from './schemas';

// Sync
export {
  transformPropertyForTypesense,
  indexProperty,
  indexPropertiesBatch,
  deletePropertyFromIndex,
  updatePropertyStatus,
  indexCitiesBatch,
  getIndexStats
} from './sync';

// Types
export type {
  TypesensePropertyDocument,
  TypesenseCityDocument,
} from './sync';

export type {
  SearchOptions
} from './client';
