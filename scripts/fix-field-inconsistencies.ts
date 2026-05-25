/**
 * Fix field inconsistencies in the properties collection
 * 
 * This script addresses:
 * 1. isOwnerFinance vs isOwnerfinance inconsistency
 * 2. Missing percentOfArv calculations
 * 3. Field synchronization across the collection
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

async function fixInconsistencies() {
  console.log('Starting field inconsistency fix...');
  console.log('=====================================');
  
  let totalProcessed = 0;
  let fixed = 0;
  let percentOfArvFixed = 0;
  
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
      
      // Fix isOwnerFinance vs isOwnerfinance
      const capitalF = data.isOwnerFinance;
      const lowercaseF = data.isOwnerfinance;
      
      // Determine the correct value (prefer true if either is true)
      const shouldBeOwnerFinance = capitalF === true || lowercaseF === true;
      
      // Ensure both fields exist and match
      if (capitalF !== shouldBeOwnerFinance || lowercaseF !== shouldBeOwnerFinance) {
        updates.isOwnerFinance = shouldBeOwnerFinance;
        updates.isOwnerfinance = shouldBeOwnerFinance;
        fixed++;
        
        console.log(`Fixing ${doc.id}: isOwnerFinance=${capitalF}, isOwnerfinance=${lowercaseF} -> both=${shouldBeOwnerFinance}`);
      }
      
      // Fix missing percentOfArv
      if (data.price && data.estimate && !data.percentOfArv) {
        const percentOfArv = Math.round((data.price / data.estimate) * 100);
        updates.percentOfArv = percentOfArv;
        percentOfArvFixed++;
      }
      
      // Update dealTypes if needed
      if (shouldBeOwnerFinance && (!data.dealTypes || !data.dealTypes.includes('owner_finance'))) {
        const currentDealTypes = data.dealTypes || [];
        if (!currentDealTypes.includes('owner_finance')) {
          updates.dealTypes = [...currentDealTypes, 'owner_finance'];
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
  console.log('\nField inconsistencies have been resolved!');
  
  process.exit(0);
}

// Run the fix
fixInconsistencies().catch(console.error);