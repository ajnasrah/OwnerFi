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

async function checkDealTypeProblem() {
  console.log('=== CHECKING SCOPE OF DEALTYPE FIELD PROBLEM ===\n');
  
  // 1. Check how many total properties exist
  const totalPropsSnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(1000)
    .get();
  
  console.log(`Total active properties checked: ${totalPropsSnapshot.size}`);
  
  // 2. Analyze field consistency
  let stats = {
    total: 0,
    hasDealType: 0,
    hasIsOwnerFinance: 0,
    hasIsCashDeal: 0,
    dealTypeUndefined: 0,
    dealTypeOwnerFinance: 0,
    dealTypeCash: 0,
    dealTypeBoth: 0,
    mismatch: 0,
  };
  
  let sampleMismatches: any[] = [];
  
  totalPropsSnapshot.docs.forEach(doc => {
    const prop = doc.data();
    stats.total++;
    
    // Check field presence
    if (prop.dealType !== undefined) stats.hasDealType++;
    if (prop.isOwnerFinance !== undefined) stats.hasIsOwnerFinance++;
    if (prop.isCashDeal !== undefined) stats.hasIsCashDeal++;
    
    // Check dealType values
    if (prop.dealType === undefined) stats.dealTypeUndefined++;
    else if (prop.dealType === 'owner_finance') stats.dealTypeOwnerFinance++;
    else if (prop.dealType === 'cash') stats.dealTypeCash++;
    else if (prop.dealType === 'both') stats.dealTypeBoth++;
    
    // Check for mismatches
    if (prop.isOwnerFinance === true && prop.dealType !== 'owner_finance' && prop.dealType !== 'both') {
      stats.mismatch++;
      if (sampleMismatches.length < 3) {
        sampleMismatches.push({
          id: doc.id,
          address: `${prop.streetAddress}, ${prop.city}, ${prop.state}`,
          isOwnerFinance: prop.isOwnerFinance,
          isCashDeal: prop.isCashDeal,
          dealType: prop.dealType
        });
      }
    }
  });
  
  console.log('\n=== FIELD ANALYSIS ===');
  console.log(`Properties with dealType field: ${stats.hasDealType}/${stats.total} (${Math.round(stats.hasDealType/stats.total*100)}%)`);
  console.log(`Properties with isOwnerFinance field: ${stats.hasIsOwnerFinance}/${stats.total} (${Math.round(stats.hasIsOwnerFinance/stats.total*100)}%)`);
  console.log(`Properties with isCashDeal field: ${stats.hasIsCashDeal}/${stats.total} (${Math.round(stats.hasIsCashDeal/stats.total*100)}%)`);
  
  console.log('\n=== DEALTYPE VALUES ===');
  console.log(`dealType undefined: ${stats.dealTypeUndefined} (${Math.round(stats.dealTypeUndefined/stats.total*100)}%)`);
  console.log(`dealType = 'owner_finance': ${stats.dealTypeOwnerFinance}`);
  console.log(`dealType = 'cash': ${stats.dealTypeCash}`);
  console.log(`dealType = 'both': ${stats.dealTypeBoth}`);
  
  console.log('\n=== MISMATCHES ===');
  console.log(`Properties where isOwnerFinance=true but dealType is wrong/missing: ${stats.mismatch}`);
  if (sampleMismatches.length > 0) {
    console.log('\nSample mismatches:');
    sampleMismatches.forEach(m => {
      console.log(`- ${m.address}`);
      console.log(`  ID: ${m.id}`);
      console.log(`  isOwnerFinance: ${m.isOwnerFinance}, dealType: ${m.dealType}`);
    });
  }
  
  // 3. Check how many BUYER users exist
  console.log('\n=== AFFECTED USERS ===');
  const buyerUsersSnapshot = await db.collection('users')
    .where('role', '==', 'buyer')
    .limit(100)
    .get();
  
  console.log(`Total buyer users checked: ${buyerUsersSnapshot.size}`);
  
  let activeInLast30Days = 0;
  let activeInLast7Days = 0;
  const now = Date.now();
  
  buyerUsersSnapshot.docs.forEach(doc => {
    const user = doc.data();
    if (user.lastSignIn) {
      let lastSignInMs: number;
      if (user.lastSignIn._seconds) {
        lastSignInMs = user.lastSignIn._seconds * 1000;
      } else if (typeof user.lastSignIn === 'number') {
        lastSignInMs = user.lastSignIn;
      } else {
        return;
      }
      
      const daysSinceSignIn = (now - lastSignInMs) / (1000 * 60 * 60 * 24);
      if (daysSinceSignIn <= 30) activeInLast30Days++;
      if (daysSinceSignIn <= 7) activeInLast7Days++;
    }
  });
  
  console.log(`Active in last 30 days: ${activeInLast30Days}`);
  console.log(`Active in last 7 days: ${activeInLast7Days}`);
  
  console.log('\n=== IMPACT ASSESSMENT ===');
  if (stats.dealTypeUndefined > stats.total * 0.5) {
    console.log('❌ CRITICAL: Over 50% of properties missing dealType field!');
    console.log(`   This affects ALL ${buyerUsersSnapshot.size}+ buyer users!`);
    console.log('   They will see NO properties in their dashboards!');
  } else if (stats.dealTypeUndefined > stats.total * 0.1) {
    console.log('⚠️  WARNING: Over 10% of properties missing dealType field');
    console.log(`   Partially affects ${buyerUsersSnapshot.size} buyer users`);
  } else {
    console.log('✅ dealType field is mostly populated');
  }
  
  // 4. Quick fix suggestion
  console.log('\n=== RECOMMENDED FIX ===');
  if (stats.dealTypeUndefined > 0) {
    console.log('Need to run a migration to set dealType based on isOwnerFinance/isCashDeal:');
    console.log('- If isOwnerFinance=true && isCashDeal=true: dealType="both"');
    console.log('- If isOwnerFinance=true: dealType="owner_finance"');  
    console.log('- If isCashDeal=true: dealType="cash"');
    console.log(`\nThis would fix ${stats.dealTypeUndefined} properties immediately.`);
  }
}

checkDealTypeProblem().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});