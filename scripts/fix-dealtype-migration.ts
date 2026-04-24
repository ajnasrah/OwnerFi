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

async function fixDealTypeField() {
  console.log('=== STARTING DEALTYPE FIELD MIGRATION ===\n');
  
  // Process in batches to avoid overwhelming Firestore
  const BATCH_SIZE = 500;
  let totalProcessed = 0;
  let totalFixed = 0;
  let hasMore = true;
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  
  while (hasMore) {
    // Build query
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
    
    // Process batch
    const batch = db.batch();
    let batchCount = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      let newDealType: string | null = null;
      
      // Only update if dealType is missing or undefined
      if (data.dealType === undefined || data.dealType === null) {
        // Determine correct dealType based on boolean fields
        if (data.isOwnerFinance === true && data.isCashDeal === true) {
          newDealType = 'both';
        } else if (data.isOwnerFinance === true) {
          newDealType = 'owner_finance';
        } else if (data.isCashDeal === true) {
          newDealType = 'cash';
        }
        
        if (newDealType) {
          batch.update(doc.ref, { dealType: newDealType });
          batchCount++;
        }
      }
    });
    
    // Commit batch if there are updates
    if (batchCount > 0) {
      await batch.commit();
      totalFixed += batchCount;
      console.log(`Batch processed: Fixed ${batchCount} properties (Total fixed: ${totalFixed})`);
    }
    
    totalProcessed += snapshot.size;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
    console.log(`Progress: Processed ${totalProcessed} properties...`);
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n=== MIGRATION COMPLETE ===');
  console.log(`Total properties processed: ${totalProcessed}`);
  console.log(`Properties fixed: ${totalFixed}`);
  
  // Verify the fix
  console.log('\n=== VERIFYING FIX ===');
  const verifySnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(100)
    .get();
  
  let stillMissing = 0;
  verifySnapshot.docs.forEach(doc => {
    if (!doc.data().dealType) stillMissing++;
  });
  
  if (stillMissing === 0) {
    console.log('✅ SUCCESS: All checked properties now have dealType field!');
  } else {
    console.log(`⚠️  WARNING: ${stillMissing}/100 properties still missing dealType`);
  }
  
  // Now update Juan Martinez to investor role
  console.log('\n=== UPDATING JUAN MARTINEZ TO INVESTOR ===');
  const usersSnapshot = await db.collection('users')
    .where('phone', '==', '+19016796871')
    .limit(1)
    .get();
  
  if (!usersSnapshot.empty) {
    const userRef = usersSnapshot.docs[0].ref;
    await userRef.update({ role: 'investor' });
    console.log('✅ Juan Martinez (9016796871) updated to investor role');
  } else {
    console.log('❌ Could not find Juan Martinez');
  }
}

fixDealTypeField().then(() => {
  console.log('\n✅ Migration and user update completed successfully!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error during migration:', err);
  process.exit(1);
});