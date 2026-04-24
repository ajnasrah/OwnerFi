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

async function fixRemainingDealType() {
  console.log('=== FIXING REMAINING PROPERTIES WITHOUT DEALTYPE ===\n');
  
  // First, count how many need fixing
  const needsFixSnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(2000)
    .get();
  
  let needsFix = 0;
  needsFixSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (!data.dealType) needsFix++;
  });
  
  console.log(`Properties needing fix: ${needsFix} out of ${needsFixSnapshot.size} checked`);
  
  if (needsFix === 0) {
    console.log('✅ All properties already have dealType!');
    return;
  }
  
  // Fix ALL properties, not just active ones
  console.log('\nStarting comprehensive fix...');
  
  const BATCH_SIZE = 500;
  let totalProcessed = 0;
  let totalFixed = 0;
  let hasMore = true;
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  
  while (hasMore) {
    // Get all properties, not filtered by isActive
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
      
      // Only fix if dealType is missing
      if (!data.dealType) {
        let newDealType: string = 'regular'; // Default for properties that are neither
        
        // Set dealType based on boolean fields
        if (data.isOwnerFinance === true && data.isCashDeal === true) {
          newDealType = 'both';
        } else if (data.isOwnerFinance === true) {
          newDealType = 'owner_finance';
        } else if (data.isCashDeal === true) {
          newDealType = 'cash';
        }
        
        batch.update(doc.ref, { 
          dealType: newDealType,
          lastModified: admin.firestore.FieldValue.serverTimestamp()
        });
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
    
    if (totalProcessed % 1000 === 0) {
      console.log(`Progress: Processed ${totalProcessed} total properties...`);
    }
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log('\n=== VERIFICATION ===');
  
  // Verify the fix worked
  const verifySnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(500)
    .get();
  
  let stats = {
    total: 0,
    hasDealType: 0,
    owner_finance: 0,
    cash: 0,
    both: 0,
    regular: 0
  };
  
  verifySnapshot.docs.forEach(doc => {
    const data = doc.data();
    stats.total++;
    if (data.dealType) {
      stats.hasDealType++;
      if (data.dealType === 'owner_finance') stats.owner_finance++;
      else if (data.dealType === 'cash') stats.cash++;
      else if (data.dealType === 'both') stats.both++;
      else if (data.dealType === 'regular') stats.regular++;
    }
  });
  
  console.log(`\nOut of ${stats.total} active properties checked:`);
  console.log(`- Have dealType: ${stats.hasDealType} (${Math.round(stats.hasDealType/stats.total*100)}%)`);
  console.log(`- owner_finance: ${stats.owner_finance}`);
  console.log(`- cash: ${stats.cash}`);
  console.log(`- both: ${stats.both}`);
  console.log(`- regular: ${stats.regular}`);
  
  if (stats.hasDealType === stats.total) {
    console.log('\n✅ SUCCESS: All active properties now have dealType!');
  } else {
    console.log(`\n⚠️  WARNING: ${stats.total - stats.hasDealType} properties still missing dealType`);
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total properties processed: ${totalProcessed}`);
  console.log(`Properties fixed: ${totalFixed}`);
}

fixRemainingDealType().then(() => {
  console.log('\n✅ Migration complete!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});