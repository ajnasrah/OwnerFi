/**
 * MIGRATION SCRIPT: Normalize all phone numbers to E.164 format (+1XXXXXXXXXX)
 *
 * This script:
 * 1. Finds all phone numbers in users and buyerProfiles collections
 * 2. Normalizes them to E.164 format (+1XXXXXXXXXX)
 * 3. Updates both collections for consistency
 *
 * Run with: npx tsx scripts/normalize-phone-numbers.ts
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

// E.164 format normalization (same as formatPhoneNumber in firebase-phone-auth.ts)
function normalizeToE164(phone: string): string {
  if (!phone) return '';

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // If it starts with 1 and is 11 digits, add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // If it's 10 digits, add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If it already starts with +, return as is
  if (phone.startsWith('+')) {
    return phone;
  }

  // Default: add +1
  return `+1${cleaned}`;
}

async function normalizePhoneNumbers() {
  console.log('🔧 Starting phone number normalization...\n');

  let usersUpdated = 0;
  let buyersUpdated = 0;
  let errors = 0;

  // Step 1: Normalize users collection
  console.log('📱 Processing users collection...');
  const usersSnapshot = await db.collection('users').get();

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    if (userData.phone) {
      const oldPhone = userData.phone as string;
      const newPhone = normalizeToE164(oldPhone);

      if (oldPhone !== newPhone) {
        try {
          await userDoc.ref.update({ phone: newPhone });
          console.log(`  ✅ User ${userDoc.id}: "${oldPhone}" → "${newPhone}"`);
          usersUpdated++;

          // Also update realtorData.phone if it exists
          if (userData.realtorData?.phone) {
            await userDoc.ref.update({
              'realtorData.phone': newPhone
            });
            console.log(`    ✅ Also updated realtorData.phone`);
          }
        } catch (error) {
          console.error(`  ❌ Failed to update user ${userDoc.id}:`, error);
          errors++;
        }
      }
    }
  }

  console.log(`\n📋 Processing buyerProfiles collection...`);
  const buyersSnapshot = await db.collection('buyerProfiles').get();

  for (const buyerDoc of buyersSnapshot.docs) {
    const buyerData = buyerDoc.data();
    if (buyerData.phone) {
      const oldPhone = buyerData.phone as string;
      const newPhone = normalizeToE164(oldPhone);

      if (oldPhone !== newPhone) {
        try {
          await buyerDoc.ref.update({ phone: newPhone });
          console.log(`  ✅ Buyer ${buyerDoc.id}: "${oldPhone}" → "${newPhone}"`);
          buyersUpdated++;
        } catch (error) {
          console.error(`  ❌ Failed to update buyer ${buyerDoc.id}:`, error);
          errors++;
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ MIGRATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Users updated: ${usersUpdated}`);
  console.log(`Buyer profiles updated: ${buyersUpdated}`);
  console.log(`Errors: ${errors}`);
  console.log('\nAll phone numbers are now in E.164 format (+1XXXXXXXXXX)');

  process.exit(0);
}

// Run the migration
normalizePhoneNumbers().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
