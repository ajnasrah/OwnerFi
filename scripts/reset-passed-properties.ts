#!/usr/bin/env npx tsx

/**
 * Reset all passed (disliked) properties for buyers except for phone 9018319661
 * This fixes the issue where accidental swipes marked properties as disliked
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

const EXCLUDE_PHONE = '+19018319661'; // Don't reset this user's preferences

async function resetPassedProperties() {
  const { db } = getFirebaseAdmin();
  if (!db) {
    throw new Error('Firebase admin not available');
  }

  console.log('🔍 Finding buyers with passed properties...');
  
  const buyersSnap = await db.collection('buyerProfiles').get();
  let totalBuyers = 0;
  let buyersWithPassed = 0;
  let buyersReset = 0;
  let totalPropertiesReset = 0;

  for (const doc of buyersSnap.docs) {
    totalBuyers++;
    const buyer = doc.data();
    const phone = buyer.phone;
    const passedIds = buyer.passedPropertyIds || [];
    
    if (passedIds.length === 0) continue; // No passed properties
    
    buyersWithPassed++;
    
    // Skip the excluded phone number
    if (phone === EXCLUDE_PHONE) {
      console.log(`⏭️  Skipping ${phone} (excluded) - has ${passedIds.length} passed properties`);
      continue;
    }
    
    console.log(`🧹 Resetting ${passedIds.length} passed properties for buyer ${doc.id} (${phone || 'no phone'})`);
    
    // Reset the passedPropertyIds array
    await db.collection('buyerProfiles').doc(doc.id).update({
      passedPropertyIds: [],
      updatedAt: new Date()
    });
    
    buyersReset++;
    totalPropertiesReset += passedIds.length;
  }

  console.log('\n✅ Reset completed!');
  console.log(`📊 Summary:`);
  console.log(`   Total buyers: ${totalBuyers}`);
  console.log(`   Buyers with passed properties: ${buyersWithPassed}`);
  console.log(`   Buyers reset: ${buyersReset}`);
  console.log(`   Total passed properties cleared: ${totalPropertiesReset}`);
  console.log(`   Excluded phone (kept as-is): ${EXCLUDE_PHONE}`);
}

async function main() {
  try {
    await resetPassedProperties();
  } catch (error) {
    console.error('❌ Failed to reset passed properties:', error);
    process.exit(1);
  }
}

main();