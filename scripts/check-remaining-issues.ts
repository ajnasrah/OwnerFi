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

async function checkRemainingIssues() {
  console.log('=== CHECKING REMAINING PROPERTIES WITHOUT DEALTYPE ===\n');
  
  // Find properties that still don't have dealType
  const missingDealTypeSnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(200)
    .get();
  
  let stillMissing: any[] = [];
  let stats = {
    total: 0,
    hasDealType: 0,
    noDealType: 0,
    noOwnerFinanceNoCashDeal: 0,
  };
  
  missingDealTypeSnapshot.docs.forEach(doc => {
    const data = doc.data();
    stats.total++;
    
    if (data.dealType) {
      stats.hasDealType++;
    } else {
      stats.noDealType++;
      
      // Check why it doesn't have dealType
      if (!data.isOwnerFinance && !data.isCashDeal) {
        stats.noOwnerFinanceNoCashDeal++;
        if (stillMissing.length < 5) {
          stillMissing.push({
            id: doc.id,
            address: `${data.streetAddress || 'No address'}, ${data.city}, ${data.state}`,
            isOwnerFinance: data.isOwnerFinance,
            isCashDeal: data.isCashDeal,
            dealType: data.dealType,
          });
        }
      }
    }
  });
  
  console.log(`Checked ${stats.total} active properties:`);
  console.log(`- Have dealType: ${stats.hasDealType} (${Math.round(stats.hasDealType/stats.total*100)}%)`);
  console.log(`- Missing dealType: ${stats.noDealType} (${Math.round(stats.noDealType/stats.total*100)}%)`);
  console.log(`- Missing because both isOwnerFinance and isCashDeal are false/undefined: ${stats.noOwnerFinanceNoCashDeal}`);
  
  if (stillMissing.length > 0) {
    console.log('\nSample properties without dealType (neither owner finance nor cash deal):');
    stillMissing.forEach(p => {
      console.log(`- ${p.address}`);
      console.log(`  isOwnerFinance: ${p.isOwnerFinance}, isCashDeal: ${p.isCashDeal}`);
    });
  }
  
  // Now check Juan's dashboard
  console.log('\n=== CHECKING JUAN MARTINEZ DASHBOARD VIEW (NOW AS INVESTOR) ===');
  
  // Get owner finance properties
  const ownerFinanceWithDealType = await db.collection('properties')
    .where('dealType', '==', 'owner_finance')
    .where('isActive', '==', true)
    .limit(50)
    .get();
  
  const cashDealWithDealType = await db.collection('properties')
    .where('dealType', '==', 'cash')
    .where('isActive', '==', true)
    .limit(50)
    .get();
  
  const bothDealType = await db.collection('properties')
    .where('dealType', '==', 'both')
    .where('isActive', '==', true)
    .limit(50)
    .get();
  
  console.log(`\nProperties Juan can now see as an investor:`);
  console.log(`- Owner Finance (dealType='owner_finance'): ${ownerFinanceWithDealType.size}`);
  console.log(`- Cash Deals (dealType='cash'): ${cashDealWithDealType.size}`);
  console.log(`- Both (dealType='both'): ${bothDealType.size}`);
  console.log(`- TOTAL: ${ownerFinanceWithDealType.size + cashDealWithDealType.size + bothDealType.size} properties`);
  
  // Show a few sample properties
  if (ownerFinanceWithDealType.size > 0) {
    console.log('\nSample owner finance properties:');
    ownerFinanceWithDealType.docs.slice(0, 3).forEach(doc => {
      const data = doc.data();
      console.log(`- ${data.streetAddress}, ${data.city}, ${data.state} - $${data.price || data.listPrice}`);
    });
  }
  
  if (cashDealWithDealType.size > 0) {
    console.log('\nSample cash deal properties:');
    cashDealWithDealType.docs.slice(0, 3).forEach(doc => {
      const data = doc.data();
      console.log(`- ${data.streetAddress}, ${data.city}, ${data.state} - $${data.price || data.listPrice}`);
    });
  }
}

checkRemainingIssues().then(() => {
  console.log('\n✅ Analysis complete!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});