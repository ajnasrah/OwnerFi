/**
 * Fix Realtor Profile Script
 *
 * This script checks if a realtor user has realtorData embedded in their user document
 * and adds it if missing.
 */

import { FirebaseDB } from '../src/lib/firebase-db';
import { RealtorDataHelper, formatPhone } from '../src/lib/realtor-models';
import { Timestamp } from 'firebase/firestore';

async function fixRealtorProfile(userEmail: string) {
  console.log(`\n🔍 Checking realtor profile for: ${userEmail}\n`);

  try {
    // Find user by email
    const users = await FirebaseDB.queryDocuments('users', [
      { field: 'email', operator: '==', value: userEmail }
    ]);

    if (!users || users.length === 0) {
      console.error('❌ User not found with email:', userEmail);
      return;
    }

    const user = users[0] as any;
    const userId = user.id;

    console.log('✅ Found user:', {
      id: userId,
      name: user.name,
      email: user.email,
      role: user.role,
      hasRealtorData: !!user.realtorData
    });

    // Check if user is a realtor
    if (user.role !== 'realtor') {
      console.error('❌ User is not a realtor. Current role:', user.role);
      return;
    }

    // Check if realtorData already exists
    if (user.realtorData) {
      console.log('✅ User already has realtorData:', {
        firstName: user.realtorData.firstName,
        lastName: user.realtorData.lastName,
        credits: user.realtorData.credits,
        isOnTrial: user.realtorData.isOnTrial,
        hasPrimaryCity: !!user.realtorData.serviceArea?.primaryCity
      });
      console.log('\n✨ No fix needed - profile is complete!\n');
      return;
    }

    // realtorData is missing - create it
    console.log('⚠️  realtorData is missing. Creating it now...\n');

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

    // Create realtorData
    const realtorData = RealtorDataHelper.createRealtorData(
      firstName,
      lastName,
      formatPhone(user.phone || ''),
      user.email,
      serviceArea,
      '', // company
      ''  // licenseNumber
    );

    console.log('📝 Created realtorData:', {
      firstName: realtorData.firstName,
      lastName: realtorData.lastName,
      credits: realtorData.credits,
      isOnTrial: realtorData.isOnTrial
    });

    // Update user document
    await FirebaseDB.updateDocument('users', userId, {
      realtorData,
      updatedAt: Timestamp.now()
    });

    console.log('\n✅ Successfully added realtorData to user document!');
    console.log('🎉 Realtor profile is now complete!\n');
    console.log('⚠️  Note: User should update their service area in settings\n');

  } catch (error) {
    console.error('❌ Error fixing realtor profile:', error);
    throw error;
  }
}

// Get email from command line arguments
const userEmail = process.argv[2];

if (!userEmail) {
  console.error('Usage: npx tsx scripts/fix-realtor-profile.ts <email>');
  process.exit(1);
}

// Run the fix
fixRealtorProfile(userEmail)
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
