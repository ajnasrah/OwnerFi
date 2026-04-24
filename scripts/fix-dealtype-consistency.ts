import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function fixDealTypeConsistency() {
  console.log('=== FIXING DEALTYPE CONSISTENCY ISSUES ===\n');
  
  // The dealTypes array is the source of truth (per recent commits)
  // We need to sync dealType field to match dealTypes array
  
  const BATCH_SIZE = 500;
  let totalProcessed = 0;
  let totalFixed = 0;
  let hasMore = true;
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  
  console.log('Strategy: Using dealTypes array as source of truth, updating dealType to match\n');
  
  while (hasMore) {
    let query = db.collection('properties')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(BATCH_SIZE);
    
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      hasMore = false;
      break;
    }
    
    const batch = db.batch();
    let batchCount = 0;
    let fixDetails = {
      owner_finance: 0,
      cash: 0,
      both: 0,
      regular: 0,
      fromBooleans: 0,
    };
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      let newDealType: string | null = null;
      let shouldUpdate = false;
      let updateData: any = {};
      
      // Strategy: dealTypes array is source of truth
      if (data.dealTypes && Array.isArray(data.dealTypes) && data.dealTypes.length > 0) {
        // Map from array values to scalar value
        const hasOwnerFinance = data.dealTypes.includes('owner_finance');
        const hasCashDeal = data.dealTypes.includes('cash_deal');
        
        if (hasOwnerFinance && hasCashDeal) {
          newDealType = 'both';
          fixDetails.both++;
        } else if (hasOwnerFinance) {
          newDealType = 'owner_finance';
          fixDetails.owner_finance++;
        } else if (hasCashDeal) {
          newDealType = 'cash'; // Note: scalar uses 'cash', array uses 'cash_deal'
          fixDetails.cash++;
        } else {
          // Has dealTypes but none of the expected values
          newDealType = 'regular';
          fixDetails.regular++;
        }
        
        // Only update if dealType doesn't match
        if (data.dealType !== newDealType) {
          updateData.dealType = newDealType;
          updateData.lastModified = admin.firestore.FieldValue.serverTimestamp();
          shouldUpdate = true;
        }
      } else {
        // No dealTypes array - fall back to boolean fields
        if (data.isOwnerFinance === true && data.isCashDeal === true) {
          newDealType = 'both';
          fixDetails.fromBooleans++;
        } else if (data.isOwnerFinance === true) {
          newDealType = 'owner_finance';
          fixDetails.fromBooleans++;
        } else if (data.isCashDeal === true) {
          newDealType = 'cash';
          fixDetails.fromBooleans++;
        } else {
          newDealType = 'regular';
          fixDetails.fromBooleans++;
        }
        
        // Also create the dealTypes array
        const dealTypesArray: string[] = [];
        if (data.isOwnerFinance === true) dealTypesArray.push('owner_finance');
        if (data.isCashDeal === true) dealTypesArray.push('cash_deal');
        
        updateData.dealType = newDealType;
        updateData.dealTypes = dealTypesArray;
        updateData.lastModified = admin.firestore.FieldValue.serverTimestamp();
        shouldUpdate = true;
      }
      
      if (shouldUpdate) {
        batch.update(doc.ref, updateData);
        batchCount++;
      }
    });
    
    if (batchCount > 0) {
      await batch.commit();
      totalFixed += batchCount;
      console.log(`Fixed ${batchCount} properties in batch`);
      console.log(`  owner_finance: ${fixDetails.owner_finance}, cash: ${fixDetails.cash}, both: ${fixDetails.both}, regular: ${fixDetails.regular}`);
      console.log(`  From booleans: ${fixDetails.fromBooleans}`);
    }
    
    totalProcessed += snapshot.size;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
    if (totalProcessed % 2000 === 0) {
      console.log(`\nProgress: ${totalProcessed} properties processed, ${totalFixed} fixed...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log('\n=== VERIFICATION ===');
  
  // Check a sample to verify consistency
  const sampleCheck = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(100)
    .get();
  
  let inconsistent = 0;
  sampleCheck.docs.forEach(doc => {
    const data = doc.data();
    if (!data.dealTypes || !Array.isArray(data.dealTypes)) {
      inconsistent++;
      return;
    }
    
    // Check if dealType matches dealTypes
    const hasOwnerFinance = data.dealTypes.includes('owner_finance');
    const hasCashDeal = data.dealTypes.includes('cash_deal');
    
    let expectedDealType: string;
    if (hasOwnerFinance && hasCashDeal) {
      expectedDealType = 'both';
    } else if (hasOwnerFinance) {
      expectedDealType = 'owner_finance';
    } else if (hasCashDeal) {
      expectedDealType = 'cash';
    } else {
      expectedDealType = 'regular';
    }
    
    if (data.dealType !== expectedDealType) {
      inconsistent++;
      console.log(`Still inconsistent: dealType=${data.dealType}, dealTypes=${JSON.stringify(data.dealTypes)}`);
    }
  });
  
  if (inconsistent === 0) {
    console.log('✅ SUCCESS: All checked properties have consistent dealType/dealTypes!');
  } else {
    console.log(`⚠️  WARNING: ${inconsistent}/100 properties still have inconsistencies`);
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total properties processed: ${totalProcessed}`);
  console.log(`Properties fixed: ${totalFixed}`);
}

fixDealTypeConsistency().then(() => {
  console.log('\n✅ Consistency fix complete!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});