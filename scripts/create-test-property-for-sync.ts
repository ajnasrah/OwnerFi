#!/usr/bin/env tsx
/**
 * Create Test Property for Sync Test
 *
 * Creates a test property in the database to verify the sync cron
 * automatically adds it to the propertyShowcaseWorkflows queue
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function createTestProperty() {
  console.log('🏡 Creating Test Property for Sync Test\n');
  console.log('='.repeat(70));

  const db = await getAdminDb();
  if (!db) {
    console.error('❌ Failed to initialize Firebase Admin SDK');
    return;
  }

  const testPropertyId = `test_sync_${Date.now()}`;

  const testProperty = {
    // Required fields
    address: '123 Test Sync Street',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    listPrice: 150000,
    downPaymentAmount: 7500,
    downPaymentPercent: 5,
    monthlyPayment: 850,
    interestRate: 6.5,
    termYears: 30,

    // Property details
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1500,
    propertyType: 'single-family',

    // Status
    status: 'active',
    isActive: true,

    // Images (REQUIRED for queue)
    imageUrls: [
      'https://placehold.co/800x600/png?text=Test+Property+Front',
      'https://placehold.co/800x600/png?text=Test+Property+Back'
    ],

    // Metadata
    source: 'test_sync_script',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  console.log('\n📝 Test Property Details:');
  console.log(`   ID: ${testPropertyId}`);
  console.log(`   Address: ${testProperty.address}`);
  console.log(`   City: ${testProperty.city}, ${testProperty.state}`);
  console.log(`   List Price: $${testProperty.listPrice.toLocaleString()}`);
  console.log(`   Down Payment: $${testProperty.downPaymentAmount.toLocaleString()}`);
  console.log(`   Monthly Payment: $${testProperty.monthlyPayment}`);
  console.log(`   Images: ${testProperty.imageUrls.length}`);
  console.log(`   Status: ${testProperty.status}`);
  console.log(`   Active: ${testProperty.isActive}`);

  // Create property
  console.log('\n💾 Creating property in database...');
  await db.collection('properties').doc(testPropertyId).set(testProperty);
  console.log('   ✅ Property created successfully!');

  // Check if it's in the queue yet (should NOT be until sync runs)
  console.log('\n🔍 Checking if property is in queue...');
  const queueSnapshot = await db.collection('propertyShowcaseWorkflows')
    .where('propertyId', '==', testPropertyId)
    .get();

  if (queueSnapshot.empty) {
    console.log('   ⏳ Property NOT in queue yet (expected - sync hasn\'t run)');
  } else {
    console.log('   ⚠️  Property already in queue (unexpected!)');
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Test Property Created!');
  console.log('='.repeat(70));
  console.log('\n📋 Next Steps:');
  console.log('   1. Run sync cron:');
  console.log('      npx tsx scripts/trigger-sync-cron.ts');
  console.log('');
  console.log('   2. Verify property was added to queue:');
  console.log('      npx tsx scripts/verify-test-property-in-queue.ts');
  console.log('');
  console.log(`   Property ID: ${testPropertyId}`);
  console.log('');

  return testPropertyId;
}

createTestProperty().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
