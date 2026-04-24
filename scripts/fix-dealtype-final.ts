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

async function fixDealTypeFinal() {
  console.log('=== FINAL DEALTYPE FIX - STANDARDIZING ALL VALUES ===\n');
  console.log('Standard values:');
  console.log('  dealTypes array: ["owner_finance"], ["cash_deal"], or both');
  console.log('  dealType scalar: "owner_finance", "cash_deal", "both", or "regular"\n');
  
  const BATCH_SIZE = 500;
  let totalProcessed = 0;
  let totalFixed = 0;
  let hasMore = true;
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  
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
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      let updates: any = {};
      let needsUpdate = false;
      
      // Step 1: Ensure dealTypes array exists and has correct values
      let correctDealTypes: string[] = [];
      
      // First check existing dealTypes array
      if (data.dealTypes && Array.isArray(data.dealTypes)) {
        // Clean up array values (some might have "cash" instead of "cash_deal")
        data.dealTypes.forEach((type: string) => {
          if (type === 'owner_finance') correctDealTypes.push('owner_finance');
          else if (type === 'cash_deal' || type === 'cash') correctDealTypes.push('cash_deal');
        });
      }
      
      // If no dealTypes or empty, derive from boolean fields
      if (correctDealTypes.length === 0) {
        if (data.isOwnerFinance === true || data.isOwnerfinance === true) {
          correctDealTypes.push('owner_finance');
        }
        if (data.isCashDeal === true) {
          correctDealTypes.push('cash_deal');
        }
      }
      
      // Remove duplicates
      correctDealTypes = [...new Set(correctDealTypes)];
      
      // Check if dealTypes needs updating
      const currentDealTypesStr = JSON.stringify(data.dealTypes || []);
      const correctDealTypesStr = JSON.stringify(correctDealTypes);
      if (currentDealTypesStr !== correctDealTypesStr) {
        updates.dealTypes = correctDealTypes;
        needsUpdate = true;
      }
      
      // Step 2: Set correct dealType scalar based on array
      let correctDealType: string;
      const hasOwnerFinance = correctDealTypes.includes('owner_finance');
      const hasCashDeal = correctDealTypes.includes('cash_deal');
      
      if (hasOwnerFinance && hasCashDeal) {
        correctDealType = 'both';
      } else if (hasOwnerFinance) {
        correctDealType = 'owner_finance';
      } else if (hasCashDeal) {
        correctDealType = 'cash_deal';
      } else {
        correctDealType = 'regular';
      }
      
      // Fix common mistakes in dealType
      let currentDealType = data.dealType;
      if (currentDealType === 'cash') currentDealType = 'cash_deal'; // Fix "cash" -> "cash_deal"
      if (currentDealType === 'below_80_percent' || 
          currentDealType === 'distressed' || 
          currentDealType === 'motivated') {
        currentDealType = 'cash_deal'; // These are cash deal reasons, not deal types
      }
      
      if (currentDealType !== correctDealType) {
        updates.dealType = correctDealType;
        needsUpdate = true;
      }
      
      // Step 3: Ensure boolean fields are consistent
      const shouldBeOwnerFinance = hasOwnerFinance;
      const shouldBeCashDeal = hasCashDeal;
      
      if (data.isOwnerFinance !== shouldBeOwnerFinance || data.isOwnerfinance !== shouldBeOwnerFinance) {
        updates.isOwnerFinance = shouldBeOwnerFinance;
        updates.isOwnerfinance = shouldBeOwnerFinance; // Both spellings for compatibility
        needsUpdate = true;
      }
      
      if (data.isCashDeal !== shouldBeCashDeal) {
        updates.isCashDeal = shouldBeCashDeal;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        updates.lastModified = admin.firestore.FieldValue.serverTimestamp();
        batch.update(doc.ref, updates);
        batchCount++;
      }
    });
    
    if (batchCount > 0) {
      await batch.commit();
      totalFixed += batchCount;
      console.log(`Fixed ${batchCount} properties in batch (Total: ${totalFixed})`);
    }
    
    totalProcessed += snapshot.size;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
    if (totalProcessed % 2000 === 0) {
      console.log(`Progress: ${totalProcessed} properties processed...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log('\n=== VERIFICATION ===');
  
  const verifySnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(200)
    .get();
  
  let stats = {
    total: 0,
    correct: 0,
    dealTypeCash: 0, // Should be 0 (should be cash_deal)
    dealTypeMismatches: 0,
    missingDealTypes: 0,
  };
  
  verifySnapshot.docs.forEach(doc => {
    const data = doc.data();
    stats.total++;
    
    // Check for wrong "cash" value
    if (data.dealType === 'cash') {
      stats.dealTypeCash++;
      console.log(`Still has dealType='cash': ${doc.id}`);
    }
    
    // Check if dealTypes array exists
    if (!data.dealTypes || !Array.isArray(data.dealTypes)) {
      stats.missingDealTypes++;
    }
    
    // Check consistency
    const hasOwnerFinance = data.dealTypes?.includes('owner_finance');
    const hasCashDeal = data.dealTypes?.includes('cash_deal');
    let expectedDealType: string;
    
    if (hasOwnerFinance && hasCashDeal) expectedDealType = 'both';
    else if (hasOwnerFinance) expectedDealType = 'owner_finance';
    else if (hasCashDeal) expectedDealType = 'cash_deal';
    else expectedDealType = 'regular';
    
    if (data.dealType !== expectedDealType) {
      stats.dealTypeMismatches++;
    } else if (data.dealType !== 'cash' && data.dealTypes) {
      stats.correct++;
    }
  });
  
  console.log(`\nOut of ${stats.total} active properties checked:`);
  console.log(`✅ Correct: ${stats.correct} (${Math.round(stats.correct/stats.total*100)}%)`);
  console.log(`❌ dealType='cash' (wrong): ${stats.dealTypeCash}`);
  console.log(`❌ dealType mismatches: ${stats.dealTypeMismatches}`);
  console.log(`❌ Missing dealTypes array: ${stats.missingDealTypes}`);
  
  if (stats.dealTypeCash === 0 && stats.dealTypeMismatches === 0 && stats.missingDealTypes === 0) {
    console.log('\n✅ SUCCESS: All properties have correct and consistent deal type values!');
  } else {
    console.log('\n⚠️  Some issues remain - may need another pass');
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total properties processed: ${totalProcessed}`);
  console.log(`Properties fixed: ${totalFixed}`);
}

fixDealTypeFinal().then(() => {
  console.log('\n✅ Final fix complete!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});