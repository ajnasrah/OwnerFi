/**
 * Normalize all phone numbers in the database to E.164 format (+1XXXXXXXXXX)
 *
 * This script:
 * 1. Finds all users with phone numbers
 * 2. Converts them to E.164 format
 * 3. Updates the database
 */

import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

// Convert phone to E.164 format (+1XXXXXXXXXX)
function normalizePhone(phone: string): string | null {
  if (!phone || phone === 'no-phone') return null;

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // If empty after cleaning, return null
  if (!cleaned) return null;

  // Get last 10 digits (removes country code if present)
  const last10 = cleaned.slice(-10);

  // Validate it's 10 digits
  if (last10.length !== 10) {
    console.warn(`⚠️  Invalid phone length: ${phone} → ${last10}`);
    return null;
  }

  // Return E.164 format
  return `+1${last10}`;
}

async function normalizeAllPhones() {
  if (!db) {
    console.error('❌ Firebase not initialized');
    process.exit(1);
  }

  console.log('\n🔄 Starting phone number normalization...\n');

  try {
    // Get all users
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    console.log(`📊 Found ${snapshot.size} total users\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let noPhone = 0;

    for (const userDoc of snapshot.docs) {
      const userData = userDoc.data();
      const currentPhone = userData.phone;

      // Skip if no phone
      if (!currentPhone || currentPhone === 'no-phone' || currentPhone.trim() === '') {
        noPhone++;
        continue;
      }

      // Normalize phone
      const normalizedPhone = normalizePhone(currentPhone);

      if (!normalizedPhone) {
        console.log(`❌ Failed to normalize: ${userDoc.id} - Phone: "${currentPhone}"`);
        errors++;
        continue;
      }

      // Check if already normalized
      if (currentPhone === normalizedPhone) {
        skipped++;
        continue;
      }

      // Update database
      try {
        await updateDoc(doc(db, 'users', userDoc.id), {
          phone: normalizedPhone
        });

        console.log(`✅ ${userDoc.id}`);
        console.log(`   Email: ${userData.email || 'no-email'}`);
        console.log(`   Old: ${currentPhone}`);
        console.log(`   New: ${normalizedPhone}`);
        console.log('');

        updated++;
      } catch (updateError) {
        console.error(`❌ Failed to update ${userDoc.id}:`, updateError);
        errors++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`  Total Users: ${snapshot.size}`);
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⏭️  Skipped (already E.164): ${skipped}`);
    console.log(`  📭 No Phone: ${noPhone}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log('');

    if (updated > 0) {
      console.log('🎉 Phone numbers normalized successfully!');
      console.log('');
      console.log('All phone numbers are now in E.164 format: +1XXXXXXXXXX');
      console.log('Users can now sign in with any format:');
      console.log('  • (555) 123-4567');
      console.log('  • 555-123-4567');
      console.log('  • 5551234567');
      console.log('  • +15551234567');
      console.log('');
    } else {
      console.log('ℹ️  All phone numbers were already in E.164 format');
    }

  } catch (error) {
    console.error('❌ Error normalizing phone numbers:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the script
normalizeAllPhones();
