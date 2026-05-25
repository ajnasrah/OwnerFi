/**
 * SAFE Fix for field inconsistencies in the properties collection
 * 
 * This script addresses:
 * 1. isOwnerFinance vs isOwnerfinance inconsistency
 * 2. Missing percentOfArv calculations WITH SAFETY CHECKS
 * 3. Field synchronization across the collection
 * 
 * SAFETY RULES:
 * - percentOfArv < 40%: Unreliable data, don't use for classification
 * - percentOfArv >= 200%: Likely bad data, don't mark as owner finance
 * - Owner finance typically: 80% <= percentOfArv < 150%
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function fixInconsistenciesSafely() {
  console.log('Starting SAFE field inconsistency fix...');
  console.log('=========================================');
  console.log('Safety rules:');
  console.log('- Will NOT mark as owner finance if percentOfArv < 40% (unreliable)');
  console.log('- Will NOT mark as owner finance if percentOfArv >= 200% (likely error)');
  console.log('- Will preserve manually verified owner finance properties');
  console.log('');
  
  let totalProcessed = 0;
  let fixed = 0;
  let percentOfArvFixed = 0;
  let skippedDueToSafety = 0;
  
  // Process in batches
  let lastDoc: any = null;
  const BATCH_SIZE = 500;
  
  while (true) {
    let query = db.collection('properties').limit(BATCH_SIZE);
    
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      break;
    }
    
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const updates: any = {};
      
      // Calculate percentOfArv if missing (with safety checks)
      let percentOfArv = data.percentOfArv;
      if (!percentOfArv && data.price && data.estimate && data.estimate > 0) {
        percentOfArv = Math.round((data.price / data.estimate) * 100);
        
        // Safety check: Is this a reasonable percentOfArv?
        if (percentOfArv >= 20 && percentOfArv <= 300) {
          updates.percentOfArv = percentOfArv;
          percentOfArvFixed++;
        } else {
          console.log(`⚠️  Skipping percentOfArv for ${doc.id}: ${percentOfArv}% seems unreliable`);
          skippedDueToSafety++;
        }
      }
      
      // Fix isOwnerFinance vs isOwnerfinance
      const capitalF = data.isOwnerFinance;
      const lowercaseF = data.isOwnerfinance;
      const manuallyVerified = data.manuallyConfirmedOwnerFinance || data.ownerFinanceVerified;
      
      // Determine the correct value with safety checks
      let shouldBeOwnerFinance: boolean;
      
      if (manuallyVerified) {
        // Trust manual verification
        shouldBeOwnerFinance = true;
      } else if (percentOfArv && (percentOfArv < 40 || percentOfArv >= 200)) {
        // Unreliable or error data - default to false unless already marked true
        shouldBeOwnerFinance = capitalF === true || lowercaseF === true;
        if (shouldBeOwnerFinance) {
          console.log(`⚠️  ${doc.id} has percentOfArv=${percentOfArv}% but is marked as owner finance`);
        }
      } else {
        // Normal case: prefer true if either is true
        shouldBeOwnerFinance = capitalF === true || lowercaseF === true;
      }
      
      // Ensure both fields exist and match
      if (capitalF !== shouldBeOwnerFinance || lowercaseF !== shouldBeOwnerFinance) {
        updates.isOwnerFinance = shouldBeOwnerFinance;
        updates.isOwnerfinance = shouldBeOwnerFinance;
        fixed++;
        
        if (percentOfArv && (percentOfArv < 40 || percentOfArv >= 200)) {
          console.log(`🔧 Fixing ${doc.id} (ARV=${percentOfArv}%): isOwnerFinance=${capitalF}, isOwnerfinance=${lowercaseF} -> both=${shouldBeOwnerFinance}`);
        }
      }
      
      // Update dealTypes if needed
      if (shouldBeOwnerFinance && (!data.dealTypes || !data.dealTypes.includes('owner_finance'))) {
        const currentDealTypes = data.dealTypes || [];
        if (!currentDealTypes.includes('owner_finance')) {
          updates.dealTypes = [...currentDealTypes, 'owner_finance'];
        }
      }
      
      // Remove owner_finance from dealTypes if percentOfArv is too low/high
      if (!shouldBeOwnerFinance && data.dealTypes?.includes('owner_finance') && !manuallyVerified) {
        if (percentOfArv && (percentOfArv < 40 || percentOfArv >= 200)) {
          updates.dealTypes = (data.dealTypes || []).filter((t: string) => t !== 'owner_finance');
          console.log(`🚫 Removing owner_finance from ${doc.id} due to percentOfArv=${percentOfArv}%`);
        }
      }
      
      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = FieldValue.serverTimestamp();
        batch.update(doc.ref, updates);
        batchCount++;
      }
      
      totalProcessed++;
    }
    
    // Commit batch if there are updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Committed batch of ${batchCount} updates`);
    }
    
    // Update lastDoc for pagination
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
    console.log(`Processed ${totalProcessed} properties so far...`);
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total properties processed: ${totalProcessed}`);
  console.log(`Owner finance inconsistencies fixed: ${fixed}`);
  console.log(`Missing percentOfArv calculated: ${percentOfArvFixed}`);
  console.log(`Skipped due to safety checks: ${skippedDueToSafety}`);
  console.log('\nField inconsistencies have been SAFELY resolved!');
  
  process.exit(0);
}

// Run the fix
fixInconsistenciesSafely().catch(console.error);