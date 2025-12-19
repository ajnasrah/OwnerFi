#!/usr/bin/env tsx
/**
 * Test Typesense Connection
 *
 * Usage: npx tsx scripts/test-typesense.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Typesense from 'typesense';

async function main() {
  console.log('='.repeat(60));
  console.log('TYPESENSE CONNECTION TEST');
  console.log('='.repeat(60));

  // Check env vars
  console.log('\n1. Checking environment variables...');
  const host = process.env.TYPESENSE_HOST;
  const apiKey = process.env.TYPESENSE_API_KEY;
  const searchKey = process.env.TYPESENSE_SEARCH_API_KEY;

  console.log(`   TYPESENSE_HOST: ${host ? '✅ Set' : '❌ Missing'}`);
  console.log(`   TYPESENSE_API_KEY: ${apiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   TYPESENSE_SEARCH_API_KEY: ${searchKey ? '✅ Set' : '❌ Missing'}`);

  if (!host || !apiKey) {
    console.error('\n❌ Missing required environment variables!');
    process.exit(1);
  }

  // Create client
  console.log('\n2. Creating Typesense client...');
  const client = new Typesense.Client({
    nodes: [{
      host: host,
      port: 443,
      protocol: 'https'
    }],
    apiKey: apiKey,
    connectionTimeoutSeconds: 5
  });

  // Test health
  console.log('\n3. Testing health endpoint...');
  try {
    const health = await client.health.retrieve();
    console.log(`   ✅ Typesense is healthy:`, health);
  } catch (error) {
    console.error(`   ❌ Health check failed:`, error);
    process.exit(1);
  }

  // List collections
  console.log('\n4. Listing existing collections...');
  try {
    const collections = await client.collections().retrieve();
    if (collections.length === 0) {
      console.log('   No collections found (this is expected for new setup)');
    } else {
      collections.forEach(col => {
        console.log(`   - ${col.name}: ${col.num_documents} documents`);
      });
    }
  } catch (error) {
    console.error(`   ❌ Failed to list collections:`, error);
  }

  // Try to create the properties schema
  console.log('\n5. Creating properties collection schema...');
  const propertiesSchema = {
    name: 'properties',
    fields: [
      { name: 'address', type: 'string' as const },
      { name: 'city', type: 'string' as const, facet: true },
      { name: 'state', type: 'string' as const, facet: true },
      { name: 'zipCode', type: 'string' as const },
      { name: 'description', type: 'string' as const, optional: true },
      { name: 'location', type: 'geopoint' as const, optional: true },
      { name: 'dealType', type: 'string' as const, facet: true },
      { name: 'listPrice', type: 'int32' as const, facet: true },
      { name: 'bedrooms', type: 'int32' as const, facet: true },
      { name: 'bathrooms', type: 'float' as const, facet: true },
      { name: 'squareFeet', type: 'int32' as const, optional: true },
      { name: 'isActive', type: 'bool' as const, facet: true },
      { name: 'propertyType', type: 'string' as const, facet: true },
      { name: 'primaryImage', type: 'string' as const, optional: true },
      { name: 'createdAt', type: 'int64' as const },
    ],
    default_sorting_field: 'createdAt'
  };

  try {
    // Check if exists first
    const collections = await client.collections().retrieve();
    const exists = collections.some(c => c.name === 'properties');

    if (exists) {
      console.log('   Collection "properties" already exists');
    } else {
      await client.collections().create(propertiesSchema);
      console.log('   ✅ Created "properties" collection');
    }
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('   Collection "properties" already exists');
    } else {
      console.error(`   ❌ Failed to create collection:`, error.message);
    }
  }

  // Test inserting a sample document
  console.log('\n6. Testing document insert...');
  const testDoc = {
    id: 'test-property-' + Date.now(),
    address: '123 Test Street',
    city: 'Houston',
    state: 'TX',
    zipCode: '77001',
    description: 'Test property for Typesense connection',
    dealType: 'owner_finance',
    listPrice: 250000,
    bedrooms: 3,
    bathrooms: 2.0,
    squareFeet: 1800,
    isActive: true,
    propertyType: 'single-family',
    createdAt: Date.now()
  };

  try {
    const result = await client.collections('properties').documents().upsert(testDoc);
    console.log(`   ✅ Inserted test document: ${result.id}`);

    // Clean up - delete the test document
    await client.collections('properties').documents(testDoc.id).delete();
    console.log(`   ✅ Cleaned up test document`);
  } catch (error: any) {
    console.error(`   ❌ Failed to insert document:`, error.message);
  }

  // Test search
  console.log('\n7. Testing search...');
  try {
    const searchResult = await client.collections('properties').documents().search({
      q: '*',
      query_by: 'address,city',
      per_page: 5
    });
    console.log(`   ✅ Search works! Found ${searchResult.found} documents`);
  } catch (error: any) {
    console.error(`   ❌ Search failed:`, error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ TYPESENSE CONNECTION TEST COMPLETE');
  console.log('='.repeat(60));
  console.log('\nNext steps:');
  console.log('1. Run migration: npx tsx scripts/migrate-to-unified-properties.ts --dry-run');
  console.log('2. Sync to Typesense via API: curl -X POST http://localhost:3000/api/admin/typesense -d \'{"action":"sync-all"}\'');
}

main().catch(console.error);
