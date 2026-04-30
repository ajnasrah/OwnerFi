#!/usr/bin/env npx tsx

/**
 * Activate properties that have valid data for buyers to see
 * This fixes the critical issue where no properties are showing up
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function activateGoodProperties() {
  const { db } = getFirebaseAdmin();
  if (!db) {
    throw new Error('Firebase admin not available');
  }

  console.log('🔍 Scanning properties for activation...');
  
  const propertiesSnap = await db.collection('properties').get();
  let totalProperties = 0;
  let activatedProperties = 0;
  let skipredProperties = 0;

  for (const doc of propertiesSnap.docs) {
    totalProperties++;
    const property = doc.data();
    
    // Check if property has minimum required data
    const hasAddress = property.address && property.address.trim() !== '';
    const hasCity = property.city && property.city.trim() !== '';
    const hasState = property.state && property.state.trim() !== '';
    const hasPrice = property.listPrice && property.listPrice > 0;
    const hasBeds = property.bedrooms >= 0;
    const hasBaths = property.bathrooms >= 0;
    
    const isValidProperty = hasAddress && hasCity && hasState && hasPrice && hasBeds && hasBaths;
    
    if (isValidProperty && !property.isActive) {
      // Activate this property
      await db.collection('properties').doc(doc.id).update({
        isActive: true,
        updatedAt: new Date(),
        activatedReason: 'bulk-activation-valid-data'
      });
      
      activatedProperties++;
      
      if (activatedProperties <= 5) {
        console.log(`✅ Activated: ${property.address} | ${property.city}, ${property.state} | $${property.listPrice}`);
      }
    } else if (!isValidProperty) {
      skipredProperties++;
      if (skipredProperties <= 3) {
        console.log(`⏭️  Skipped: ${property.address || 'No address'} | Missing: ${!hasAddress ? 'address ' : ''}${!hasCity ? 'city ' : ''}${!hasState ? 'state ' : ''}${!hasPrice ? 'price ' : ''}`);
      }
    }
  }

  console.log('\n✅ Property activation completed!');
  console.log(`📊 Summary:`);
  console.log(`   Total properties: ${totalProperties}`);
  console.log(`   Activated properties: ${activatedProperties}`);
  console.log(`   Skipped (invalid data): ${skipredProperties}`);
  console.log(`   Already active: ${totalProperties - activatedProperties - skipredProperties}`);
}

async function main() {
  try {
    await activateGoodProperties();
  } catch (error) {
    console.error('❌ Failed to activate properties:', error);
    process.exit(1);
  }
}

main();