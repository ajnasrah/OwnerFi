/**
 * Test Stale Property Cleanup
 *
 * Dry-run test to see which properties would be deleted by the cleanup cron
 * Does NOT actually delete anything - just reports what would be deleted
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function testStalePropertyCleanup() {
  console.log('🧪 DRY RUN: Testing stale property cleanup logic...\n');
  console.log('⚠️  This will NOT delete anything - just showing what would be deleted\n');

  // Calculate cutoff date (60 days ago)
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  console.log(`📅 Cutoff date: ${sixtyDaysAgo.toISOString()}`);
  console.log(`🔍 Finding properties with no updates since ${sixtyDaysAgo.toLocaleDateString()}...\n`);

  // Get all properties
  const propertiesSnapshot = await db.collection('properties').get();

  const staleProperties: Array<{
    id: string;
    address: string;
    updatedAt: Date;
    source: string;
    opportunityId?: string;
  }> = [];

  const activeProperties: Array<{
    id: string;
    address: string;
    updatedAt: Date;
  }> = [];

  // Filter properties older than 60 days
  propertiesSnapshot.docs.forEach(doc => {
    const data = doc.data();

    // Get the most recent update timestamp
    const updatedAt = data.updatedAt || data.createdAt;

    if (!updatedAt) {
      // No timestamp - consider it stale
      staleProperties.push({
        id: doc.id,
        address: `${data.address}, ${data.city}, ${data.state}`,
        updatedAt: new Date(0), // Unix epoch for missing timestamps
        source: data.source || 'unknown',
        opportunityId: data.opportunityId
      });
      return;
    }

    // Convert Firestore timestamp to Date
    const lastUpdate = updatedAt.toDate ? updatedAt.toDate() : new Date(updatedAt);

    // Check if older than 60 days
    if (lastUpdate < sixtyDaysAgo) {
      staleProperties.push({
        id: doc.id,
        address: `${data.address}, ${data.city}, ${data.state}`,
        updatedAt: lastUpdate,
        source: data.source || 'unknown',
        opportunityId: data.opportunityId
      });
    } else {
      activeProperties.push({
        id: doc.id,
        address: `${data.address}, ${data.city}, ${data.state}`,
        updatedAt: lastUpdate
      });
    }
  });

  console.log('═'.repeat(80));
  console.log('\n📊 SUMMARY\n');
  console.log(`Total Properties: ${propertiesSnapshot.size}`);
  console.log(`Active (updated within 60 days): ${activeProperties.length} (${Math.round(activeProperties.length / propertiesSnapshot.size * 100)}%)`);
  console.log(`Stale (60+ days old): ${staleProperties.length} (${Math.round(staleProperties.length / propertiesSnapshot.size * 100)}%)`);
  console.log('\n' + '═'.repeat(80) + '\n');

  if (staleProperties.length === 0) {
    console.log('✅ NO STALE PROPERTIES FOUND!\n');
    console.log('All properties have been updated within the last 60 days.\n');
    return;
  }

  // Log breakdown by source
  const sourceBreakdown = staleProperties.reduce((acc, prop) => {
    acc[prop.source] = (acc[prop.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📊 Stale Properties by Source:\n');
  Object.entries(sourceBreakdown).forEach(([source, count]) => {
    console.log(`   ${source}: ${count} properties`);
  });

  console.log('\n' + '═'.repeat(80) + '\n');
  console.log(`🗑️  PROPERTIES THAT WOULD BE DELETED (${staleProperties.length} total):\n`);

  // Sort by last update (oldest first)
  staleProperties.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

  // Show first 50
  staleProperties.slice(0, 50).forEach((prop, idx) => {
    const daysSinceUpdate = Math.floor((Date.now() - prop.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`${idx + 1}. ${prop.address}`);
    console.log(`   Last updated: ${prop.updatedAt.toLocaleDateString()} (${daysSinceUpdate} days ago)`);
    console.log(`   Source: ${prop.source}`);
    if (prop.opportunityId) {
      console.log(`   Opportunity ID: ${prop.opportunityId}`);
    }
    console.log('');
  });

  if (staleProperties.length > 50) {
    console.log(`   ... and ${staleProperties.length - 50} more\n`);
  }

  console.log('═'.repeat(80) + '\n');
  console.log('⚠️  REMINDER: This was a DRY RUN - no properties were deleted.\n');
  console.log('When the actual cron runs, it will delete these properties automatically.\n');

  // Show some active properties for comparison
  console.log('✅ SAMPLE OF ACTIVE PROPERTIES (for comparison):\n');
  activeProperties
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10)
    .forEach((prop, idx) => {
      const daysSinceUpdate = Math.floor((Date.now() - prop.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`${idx + 1}. ${prop.address}`);
      console.log(`   Last updated: ${prop.updatedAt.toLocaleDateString()} (${daysSinceUpdate} days ago)`);
      console.log('');
    });
}

// Run the test
testStalePropertyCleanup()
  .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
