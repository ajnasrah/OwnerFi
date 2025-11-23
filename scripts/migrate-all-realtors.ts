/**
 * EMERGENCY MIGRATION: Add realtorData to ALL realtor users
 *
 * This script finds all users with role='realtor' and ensures they have
 * realtorData embedded in their user document.
 *
 * Run this after forcing logout to prevent "Realtor profile not found" errors
 */

import { FirebaseDB } from '../src/lib/firebase-db';
import { RealtorDataHelper, formatPhone } from '../src/lib/realtor-models';
import { Timestamp } from 'firebase/firestore';

interface UserDoc {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  role: string;
  realtorData?: any;
  [key: string]: any;
}

async function migrateAllRealtors() {
  console.log('\n🚀 EMERGENCY MIGRATION: Adding realtorData to all realtor users\n');
  console.log('=' .repeat(60));

  try {
    // Get all users with role='realtor'
    console.log('\n📋 Step 1: Fetching all realtor users...\n');
    const realtorUsers = await FirebaseDB.queryDocuments('users', [
      { field: 'role', operator: '==', value: 'realtor' }
    ]) as UserDoc[];

    console.log(`✅ Found ${realtorUsers.length} realtor users\n`);
    console.log('=' .repeat(60));

    if (realtorUsers.length === 0) {
      console.log('ℹ️  No realtor users found. Nothing to migrate.\n');
      return;
    }

    let fixed = 0;
    let alreadyComplete = 0;
    let errors = 0;

    // Process each realtor
    for (let i = 0; i < realtorUsers.length; i++) {
      const user = realtorUsers[i];
      const num = i + 1;

      console.log(`\n[${num}/${realtorUsers.length}] Processing: ${user.email}`);
      console.log('-'.repeat(60));

      try {
        // Check if realtorData already exists
        if (user.realtorData) {
          console.log(`  ✅ Already has realtorData`);
          console.log(`     - Credits: ${user.realtorData.credits || 0}`);
          console.log(`     - Trial: ${user.realtorData.isOnTrial ? 'Yes' : 'No'}`);
          console.log(`     - City: ${user.realtorData.serviceArea?.primaryCity?.name || 'Not set'}`);
          alreadyComplete++;
          continue;
        }

        // realtorData is missing - create it
        console.log(`  ⚠️  MISSING realtorData - creating now...`);

        // Parse name
        const nameParts = (user.name || '').split(' ');
        const firstName = nameParts[0] || 'First';
        const lastName = nameParts.slice(1).join(' ') || 'Last';

        // Create placeholder service area
        const serviceArea = {
          primaryCity: {
            name: 'Setup Required',
            state: 'Setup Required',
            stateCode: 'XX',
            placeId: 'setup-required',
            coordinates: { lat: 0, lng: 0 },
            formattedAddress: 'Setup Required'
          },
          nearbyCities: [],
          radiusMiles: 30,
          totalCitiesServed: 0,
          lastUpdated: Timestamp.now()
        };

        // Create realtorData with trial credits
        const realtorData = RealtorDataHelper.createRealtorData(
          firstName,
          lastName,
          formatPhone(user.phone || ''),
          user.email,
          serviceArea,
          '', // company - they can add later
          ''  // licenseNumber - they can add later
        );

        console.log(`     Creating realtorData:`);
        console.log(`     - Name: ${firstName} ${lastName}`);
        console.log(`     - Credits: ${realtorData.credits}`);
        console.log(`     - Trial: ${realtorData.isOnTrial ? 'Yes' : 'No'}`);

        // Update user document
        await FirebaseDB.updateDocument('users', user.id, {
          realtorData,
          updatedAt: Timestamp.now()
        });

        console.log(`  ✅ Successfully added realtorData`);
        fixed++;

        // Small delay to avoid rate limiting
        if (i < realtorUsers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`  ❌ Error processing user:`, error);
        errors++;
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 MIGRATION COMPLETE!\n');
    console.log('Summary:');
    console.log(`  Total realtor users: ${realtorUsers.length}`);
    console.log(`  ✅ Fixed (added realtorData): ${fixed}`);
    console.log(`  ✓  Already complete: ${alreadyComplete}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log('\n' + '='.repeat(60));

    if (errors > 0) {
      console.log('\n⚠️  Some users had errors. Review the log above.\n');
    } else {
      console.log('\n✨ All realtor users now have realtorData!\n');
      console.log('📝 Note: Users should update their service area in settings\n');
    }

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error);
    throw error;
  }
}

// Run the migration
console.log('\n⚠️  WARNING: This will update all realtor user documents');
console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(() => {
  migrateAllRealtors()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}, 3000);
