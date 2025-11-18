import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { hasOwnerFinancing } from '../src/lib/owner-financing-filter';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function cleanupNoOwnerFinancingProperties() {
  console.log('\n🧹 Cleaning Up Properties Without Owner Financing\n');
  console.log('='.repeat(80));

  try {
    // Step 1: Get all properties from the zillow_imports collection
    console.log('\n📥 Fetching all properties from zillow_imports collection...');
    const snapshot = await db.collection('zillow_imports').get();

    console.log(`📊 Found ${snapshot.size} total properties\n`);

    // Step 2: Get all properties (they're all considered "for sale" if in the database)
    const allProperties: Array<{
      id: string;
      address: string;
      description: string;
    }> = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      allProperties.push({
        id: doc.id,
        address: data.fullAddress || data.streetAddress || data.address || 'Unknown',
        description: data.description || '',
      });
    });

    console.log(`📊 Analyzing all ${allProperties.length} properties for owner financing\n`);

    // Step 3: Check each property for owner financing
    console.log('🔍 Analyzing properties for owner financing...\n');

    const noOwnerFinancing: Array<{
      id: string;
      address: string;
      reason: string;
      confidence: string;
    }> = [];

    const hasOwnerFinancingList: Array<{
      id: string;
      address: string;
    }> = [];

    for (const prop of allProperties) {
      const result = hasOwnerFinancing(prop.description);

      if (!result.shouldSend) {
        noOwnerFinancing.push({
          id: prop.id,
          address: prop.address,
          reason: result.reason,
          confidence: result.confidence,
        });
      } else {
        hasOwnerFinancingList.push({
          id: prop.id,
          address: prop.address,
        });
      }
    }

    // Step 4: Display results
    console.log('='.repeat(80));
    console.log('\n📊 ANALYSIS RESULTS:\n');
    console.log(`Total Properties:                 ${allProperties.length}`);
    console.log(`With Owner Financing:             ${hasOwnerFinancingList.length}`);
    console.log(`WITHOUT Owner Financing:          ${noOwnerFinancing.length}`);
    console.log(`Percentage without OF:            ${((noOwnerFinancing.length / allProperties.length) * 100).toFixed(1)}%`);

    if (noOwnerFinancing.length === 0) {
      console.log('\n✅ All properties have owner financing! Database is clean.\n');
      return;
    }

    // Step 5: Show sample of properties to be removed
    console.log('\n='.repeat(80));
    console.log('\n⚠️  PROPERTIES WITHOUT OWNER FINANCING (First 20):\n');

    noOwnerFinancing.slice(0, 20).forEach((prop, i) => {
      console.log(`${i + 1}. ${prop.address}`);
      console.log(`   ID: ${prop.id}`);
      console.log(`   Reason: ${prop.reason}`);
      console.log(`   Confidence: ${prop.confidence}\n`);
    });

    if (noOwnerFinancing.length > 20) {
      console.log(`... and ${noOwnerFinancing.length - 20} more\n`);
    }

    // Step 6: Breakdown by reason
    console.log('='.repeat(80));
    console.log('\n📋 BREAKDOWN BY REASON:\n');

    const reasonCounts = new Map<string, number>();
    noOwnerFinancing.forEach(prop => {
      const count = reasonCounts.get(prop.reason) || 0;
      reasonCounts.set(prop.reason, count + 1);
    });

    Array.from(reasonCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        const percentage = ((count / noOwnerFinancing.length) * 100).toFixed(1);
        console.log(`  ${reason}: ${count} (${percentage}%)`);
      });

    // Step 7: Delete properties
    console.log('\n='.repeat(80));
    console.log('\n⚠️  WARNING: This will PERMANENTLY DELETE these properties!\n');
    console.log(`Proceeding to remove ${noOwnerFinancing.length} properties without owner financing...\n`);

    let deletedCount = 0;
    const BATCH_SIZE = 500;

    for (let i = 0; i < noOwnerFinancing.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = noOwnerFinancing.slice(i, i + BATCH_SIZE);

      chunk.forEach(prop => {
        batch.delete(db.collection('zillow_imports').doc(prop.id));
      });

      await batch.commit();
      deletedCount += chunk.length;
      console.log(`  ✅ Deleted ${chunk.length} properties (${deletedCount}/${noOwnerFinancing.length} total)`);
    }

    // Step 8: Verify results
    console.log('\n='.repeat(80));
    console.log('\n📈 DELETION SUMMARY:\n');
    console.log(`Original Total Properties:    ${allProperties.length}`);
    console.log(`Properties Deleted:           ${deletedCount}`);
    console.log(`Remaining Properties:         ${allProperties.length - deletedCount}`);
    console.log(`Expected Remaining:           ${hasOwnerFinancingList.length}`);

    // Verify by re-querying
    console.log('\n🔍 Verifying database...\n');

    const verifySnapshot = await db.collection('zillow_imports').get();

    console.log(`Current total properties: ${verifySnapshot.size}`);
    console.log(`Expected: ${hasOwnerFinancingList.length}`);

    if (verifySnapshot.size === hasOwnerFinancingList.length) {
      console.log('\n✅ Verification successful! All properties without owner financing removed.\n');
    } else {
      console.log('\n⚠️  Warning: Property count mismatch. Please review.\n');
    }

    console.log('='.repeat(80));
    console.log('\n🎉 CLEANUP COMPLETE!\n');
    console.log('All active properties now have owner financing mentioned in their descriptions.\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

// Run the cleanup
cleanupNoOwnerFinancingProperties()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
