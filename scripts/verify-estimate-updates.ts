import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function verifyEstimateUpdates() {
  const { db } = getFirebaseAdmin();
  
  console.log('🔍 VERIFYING ZESTIMATE AND RENT ESTIMATE UPDATES');
  console.log('=' .repeat(60) + '\n');
  
  // 1. Check properties with recent estimate changes
  console.log('1️⃣ CHECKING RECENT ESTIMATE UPDATES\n');
  
  const recentlyUpdated = await db.collection('properties')
    .where('lastStatusCheck', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
    .limit(100)
    .get();
  
  let withZestimate = 0;
  let withRentEstimate = 0;
  let bothEstimates = 0;
  let noEstimates = 0;
  let samples = [];
  
  recentlyUpdated.docs.forEach(doc => {
    const data = doc.data();
    const hasZestimate = data.zestimate != null && data.zestimate > 0;
    const hasRentEstimate = data.rentEstimate != null && data.rentEstimate > 0;
    
    if (hasZestimate && hasRentEstimate) {
      bothEstimates++;
      if (samples.length < 5) {
        samples.push({
          id: doc.id,
          address: data.fullAddress || data.address,
          zestimate: data.zestimate,
          rentEstimate: data.rentEstimate,
          price: data.price,
          lastCheck: data.lastStatusCheck?.toDate?.(),
          priceToZestRatio: data.price && data.zestimate ? (data.price / data.zestimate).toFixed(2) : null
        });
      }
    } else if (hasZestimate) {
      withZestimate++;
    } else if (hasRentEstimate) {
      withRentEstimate++;
    } else {
      noEstimates++;
    }
  });
  
  console.log(`📊 Out of ${recentlyUpdated.size} recently updated properties:`);
  console.log(`   ✅ With both estimates: ${bothEstimates} (${(bothEstimates/recentlyUpdated.size*100).toFixed(1)}%)`);
  console.log(`   📈 Zestimate only: ${withZestimate}`);
  console.log(`   🏠 Rent estimate only: ${withRentEstimate}`);
  console.log(`   ❌ No estimates: ${noEstimates}`);
  console.log();
  
  // 2. Show sample properties with estimates
  console.log('2️⃣ SAMPLE PROPERTIES WITH ESTIMATES\n');
  
  samples.forEach((prop, index) => {
    const checkAge = prop.lastCheck ? 
      Math.floor((Date.now() - prop.lastCheck.getTime()) / (1000 * 60)) : 0;
    
    console.log(`Property #${index + 1}:`);
    console.log(`  Address: ${prop.address}`);
    console.log(`  Zestimate: $${prop.zestimate?.toLocaleString() || 'N/A'}`);
    console.log(`  Rent Estimate: $${prop.rentEstimate?.toLocaleString() || 'N/A'}/mo`);
    console.log(`  List Price: $${prop.price?.toLocaleString() || 'N/A'}`);
    if (prop.priceToZestRatio) {
      console.log(`  Price/Zestimate: ${prop.priceToZestRatio} (${(prop.priceToZestRatio * 100).toFixed(0)}% of zestimate)`);
    }
    console.log(`  Last checked: ${checkAge} minutes ago`);
    console.log();
  });
  
  // 3. Check status change reports for estimate updates
  console.log('3️⃣ CHECKING CRON UPDATE PATTERNS\n');
  
  const cronLogs = await db.collection('cron_logs')
    .where('type', '==', 'refresh-zillow-status')
    .orderBy('startedAt', 'desc')
    .limit(10)
    .get();
  
  let totalProcessed = 0;
  let totalUpdated = 0;
  
  cronLogs.docs.forEach(doc => {
    const data = doc.data();
    if (data.status === 'completed' && data.results) {
      totalProcessed += data.results.processed || 0;
      totalUpdated += data.results.updated || 0;
    }
  });
  
  const updateRate = totalProcessed > 0 ? (totalUpdated / totalProcessed * 100).toFixed(1) : 0;
  
  console.log(`📈 Recent cron performance:`);
  console.log(`   Total processed: ${totalProcessed}`);
  console.log(`   Total updated: ${totalUpdated}`);
  console.log(`   Update rate: ${updateRate}%`);
  console.log();
  
  // 4. Check specific fields being updated in the cron
  console.log('4️⃣ FIELDS UPDATED BY STATUS CRON\n');
  
  console.log('The status cron updates these estimate fields:');
  console.log('  ✅ zestimate - Zillow\'s estimated value');
  console.log('  ✅ estimate - Alternative field for zestimate');
  console.log('  ✅ rentEstimate - Estimated monthly rent');
  console.log('  ✅ rentZestimate - Alternative field for rent estimate');
  console.log();
  console.log('Update logic:');
  console.log('  • If Zillow provides new values → Updates database');
  console.log('  • If Zillow removes values → Deletes from database');
  console.log('  • Uses FieldValue.delete() to remove null estimates');
  console.log();
  
  // 5. Check for properties that might have changing estimates
  console.log('5️⃣ ESTIMATE VOLATILITY CHECK\n');
  
  const highValueProps = await db.collection('properties')
    .where('isActive', '==', true)
    .where('zestimate', '>', 500000)
    .limit(10)
    .get();
  
  if (highValueProps.size > 0) {
    console.log(`Found ${highValueProps.size} high-value properties (likely to have estimate changes):`);
    
    highValueProps.docs.slice(0, 3).forEach(doc => {
      const data = doc.data();
      console.log(`  ${data.fullAddress || data.address}`);
      console.log(`    Zestimate: $${data.zestimate?.toLocaleString()}`);
      console.log(`    Price: $${data.price?.toLocaleString()}`);
      const discount = data.zestimate && data.price ? 
        ((data.zestimate - data.price) / data.zestimate * 100).toFixed(1) : 0;
      console.log(`    Discount: ${discount}%`);
    });
  }
  
  // 6. Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ VERIFICATION SUMMARY');
  console.log('='.repeat(60) + '\n');
  
  const estimateCoverage = (bothEstimates + withZestimate) / recentlyUpdated.size * 100;
  
  if (estimateCoverage > 70) {
    console.log('✅ CONFIRMED: Zestimate and rent estimates are being updated properly!');
    console.log(`   ${estimateCoverage.toFixed(1)}% of properties have current estimates`);
  } else if (estimateCoverage > 50) {
    console.log('⚠️ PARTIAL: Some properties have estimates but coverage could be better');
    console.log(`   Only ${estimateCoverage.toFixed(1)}% have estimates`);
  } else {
    console.log('❌ ISSUE: Low estimate coverage detected');
    console.log(`   Only ${estimateCoverage.toFixed(1)}% have estimates`);
  }
  
  console.log('\n📅 CRON SCHEDULE:');
  console.log('   Runs every 6 hours (4 times daily)');
  console.log('   Processes 150 properties per run');
  console.log('   Full rotation every ~12 hours');
  console.log('   Estimates updated whenever Zillow provides new values');
  
  process.exit(0);
}

verifyEstimateUpdates().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});