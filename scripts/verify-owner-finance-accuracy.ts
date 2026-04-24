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

async function verifyOwnerFinanceAccuracy() {
  console.log('=== VERIFYING OWNER FINANCE PROPERTIES ACCURACY ===\n');
  
  // Get properties marked as owner finance
  const ownerFinanceSnapshot = await db.collection('properties')
    .where('dealType', '==', 'owner_finance')
    .limit(20)
    .get();
  
  console.log(`Checking ${ownerFinanceSnapshot.size} owner finance properties...\n`);
  
  let suspicious = [];
  let confirmed = [];
  
  // Owner finance keywords to look for
  const ownerFinanceKeywords = [
    'owner finance', 'owner financing', 'seller finance', 'seller financing',
    'owner will finance', 'seller will finance', 'owner financed',
    'lease to own', 'rent to own', 'contract for deed', 'land contract',
    'owner carry', 'seller carry', 'creative financing', 'subject to',
    'assumable', 'take over payments', 'no bank', 'no bank needed'
  ];
  
  ownerFinanceSnapshot.docs.forEach(doc => {
    const prop = doc.data();
    const description = (prop.description || '').toLowerCase();
    const keywords = (prop.ownerFinanceKeywords || '').toLowerCase();
    const financingType = (prop.financingType || '').toLowerCase();
    const sourceType = prop.sourceType;
    const manuallyVerified = prop.manuallyVerified;
    
    // Check if property has owner finance indicators
    const hasOwnerFinanceKeyword = ownerFinanceKeywords.some(keyword => 
      description.includes(keyword) || keywords.includes(keyword)
    );
    
    const propertyInfo = {
      id: doc.id,
      address: `${prop.streetAddress || 'No address'}, ${prop.city}, ${prop.state}`,
      price: prop.price || prop.listPrice,
      sourceType,
      manuallyVerified,
      hasKeywords: hasOwnerFinanceKeyword,
      isOwnerFinance: prop.isOwnerFinance,
      isCashDeal: prop.isCashDeal,
      dealType: prop.dealType,
      descriptionSnippet: description.substring(0, 150)
    };
    
    if (hasOwnerFinanceKeyword || manuallyVerified || sourceType === 'manual') {
      confirmed.push(propertyInfo);
    } else {
      suspicious.push(propertyInfo);
    }
  });
  
  // Show results
  console.log('=== CONFIRMED OWNER FINANCE PROPERTIES ===');
  if (confirmed.length > 0) {
    console.log(`Found ${confirmed.length} confirmed owner finance properties:\n`);
    confirmed.slice(0, 5).forEach(p => {
      console.log(`✅ ${p.address}`);
      console.log(`   Price: $${p.price}`);
      console.log(`   Source: ${p.sourceType} | Manually verified: ${p.manuallyVerified}`);
      console.log(`   Has OF keywords: ${p.hasKeywords}`);
      if (p.descriptionSnippet) {
        console.log(`   Description: "${p.descriptionSnippet}..."`);
      }
      console.log();
    });
  }
  
  console.log('\n=== SUSPICIOUS PROPERTIES (May not be owner finance) ===');
  if (suspicious.length > 0) {
    console.log(`Found ${suspicious.length} properties that might be incorrectly marked:\n`);
    suspicious.slice(0, 10).forEach(p => {
      console.log(`⚠️  ${p.address}`);
      console.log(`   Price: $${p.price}`);
      console.log(`   Source: ${p.sourceType}`);
      console.log(`   isOwnerFinance: ${p.isOwnerFinance}, isCashDeal: ${p.isCashDeal}`);
      console.log(`   Description: "${p.descriptionSnippet || 'No description'}..."`);
      console.log();
    });
  }
  
  // Check properties by source
  console.log('\n=== CHECKING PROPERTY SOURCES ===');
  
  const sourceStats = new Map();
  const allPropsSnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(1000)
    .get();
  
  allPropsSnapshot.docs.forEach(doc => {
    const prop = doc.data();
    const source = prop.sourceType || 'unknown';
    const dealType = prop.dealType || 'none';
    
    if (!sourceStats.has(source)) {
      sourceStats.set(source, { total: 0, owner_finance: 0, cash: 0, regular: 0 });
    }
    
    const stats = sourceStats.get(source);
    stats.total++;
    if (dealType === 'owner_finance') stats.owner_finance++;
    else if (dealType === 'cash') stats.cash++;
    else if (dealType === 'regular') stats.regular++;
  });
  
  console.log('Property distribution by source:\n');
  sourceStats.forEach((stats, source) => {
    console.log(`${source}:`);
    console.log(`  Total: ${stats.total}`);
    console.log(`  Owner Finance: ${stats.owner_finance} (${Math.round(stats.owner_finance/stats.total*100)}%)`);
    console.log(`  Cash: ${stats.cash} (${Math.round(stats.cash/stats.total*100)}%)`);
    console.log(`  Regular: ${stats.regular} (${Math.round(stats.regular/stats.total*100)}%)`);
  });
  
  // Summary
  console.log('\n=== ACCURACY SUMMARY ===');
  const accuracy = confirmed.length / (confirmed.length + suspicious.length) * 100;
  console.log(`Accuracy: ${accuracy.toFixed(1)}%`);
  console.log(`Confirmed owner finance: ${confirmed.length}`);
  console.log(`Suspicious (needs review): ${suspicious.length}`);
  
  if (suspicious.length > 0) {
    console.log('\n⚠️  WARNING: Some properties may be incorrectly marked as owner finance!');
    console.log('These should be reviewed and potentially reclassified.');
  }
}

verifyOwnerFinanceAccuracy().then(() => {
  console.log('\n✅ Verification complete!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});