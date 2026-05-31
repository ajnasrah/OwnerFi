import { ApifyClient } from 'apify-client';
import * as admin from 'firebase-admin';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function forceUpdateProperty() {
  const { db } = getFirebaseAdmin();
  const propertyId = 'zpid_340943'; // 1303 Biscayne Dr
  
  console.log('🔄 FORCING UPDATE FOR 1303 BISCAYNE DR');
  console.log('=' .repeat(60) + '\n');
  
  // Get the property
  const docRef = db.collection('properties').doc(propertyId);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    console.log('❌ Property not found');
    process.exit(1);
  }
  
  const data = doc.data()!;
  
  console.log('📍 Current Property Data:');
  console.log(`  Address: ${data.fullAddress}`);
  console.log(`  Current Zestimate: $${data.zestimate?.toLocaleString() || 'N/A'}`);
  console.log(`  Current Rent Estimate: $${data.rentEstimate?.toLocaleString() || 'N/A'}/mo`);
  console.log(`  Last Check: ${data.lastStatusCheck?.toDate?.() || 'Never'}`);
  console.log();
  
  // Run Apify scraper for this specific property
  console.log('🚀 Running Apify scraper to get fresh data...\n');
  
  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
  const actorId = 'maxcopell/zillow-detail-scraper';
  
  try {
    const run = await client.actor(actorId).call({
      startUrls: [{ url: data.url || data.hdpUrl }],
      maxRequestsPerCrawl: 1,
    });
    
    const { items } = await client.dataset(run.defaultDatasetId).listItems({
      clean: false,
      limit: 1,
    });
    
    if (items.length === 0) {
      console.log('❌ No results from Apify');
      process.exit(1);
    }
    
    const result = items[0] as any;
    
    console.log('✅ Fresh data from Zillow:');
    console.log(`  Status: ${result.homeStatus}`);
    console.log(`  Price: $${result.price?.toLocaleString() || result.listPrice?.toLocaleString() || 'N/A'}`);
    console.log(`  Zestimate: $${result.zestimate?.toLocaleString() || result.estimate?.toLocaleString() || 'N/A'}`);
    console.log(`  Rent Estimate: $${result.rentZestimate?.toLocaleString() || result.rentEstimate?.toLocaleString() || 'N/A'}/mo`);
    console.log();
    
    // Compare with current values
    const oldZestimate = data.zestimate;
    const newZestimate = result.zestimate || result.estimate;
    const oldRentEstimate = data.rentEstimate;
    const newRentEstimate = result.rentZestimate || result.rentEstimate;
    
    console.log('📊 COMPARISON:');
    
    if (oldZestimate !== newZestimate) {
      const change = newZestimate && oldZestimate ? newZestimate - oldZestimate : 0;
      const changePercent = oldZestimate ? (change / oldZestimate * 100).toFixed(1) : 0;
      
      console.log(`  Zestimate Change:`);
      console.log(`    Old: $${oldZestimate?.toLocaleString() || 'N/A'}`);
      console.log(`    New: $${newZestimate?.toLocaleString() || 'N/A'}`);
      if (change !== 0) {
        console.log(`    Change: ${change > 0 ? '+' : ''}$${change.toLocaleString()} (${changePercent}%)`);
      }
    } else {
      console.log(`  Zestimate: No change ($${oldZestimate?.toLocaleString() || 'N/A'})`);
    }
    
    if (oldRentEstimate !== newRentEstimate) {
      const change = newRentEstimate && oldRentEstimate ? newRentEstimate - oldRentEstimate : 0;
      const changePercent = oldRentEstimate ? (change / oldRentEstimate * 100).toFixed(1) : 0;
      
      console.log(`  Rent Estimate Change:`);
      console.log(`    Old: $${oldRentEstimate?.toLocaleString() || 'N/A'}/mo`);
      console.log(`    New: $${newRentEstimate?.toLocaleString() || 'N/A'}/mo`);
      if (change !== 0) {
        console.log(`    Change: ${change > 0 ? '+' : ''}$${change.toLocaleString()}/mo (${changePercent}%)`);
      }
    } else {
      console.log(`  Rent Estimate: No change ($${oldRentEstimate?.toLocaleString() || 'N/A'}/mo)`);
    }
    
    // Update the property with fresh data
    console.log('\n💾 Updating database with fresh values...');
    
    const del = admin.firestore.FieldValue.delete;
    await docRef.update({
      homeStatus: result.homeStatus || data.homeStatus,
      price: result.price || result.listPrice || data.price,
      zestimate: newZestimate || del(),
      estimate: newZestimate || del(),
      rentEstimate: newRentEstimate || del(),
      rentZestimate: newRentEstimate || del(),
      lastStatusCheck: new Date(),
      lastScrapedAt: new Date(),
      updatedAt: new Date(),
    });
    
    console.log('✅ Property updated successfully!');
    
    // Verify the update
    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data()!;
    
    console.log('\n📍 Updated Property Data:');
    console.log(`  Zestimate: $${updatedData.zestimate?.toLocaleString() || 'N/A'}`);
    console.log(`  Rent Estimate: $${updatedData.rentEstimate?.toLocaleString() || 'N/A'}/mo`);
    console.log(`  Last Check: ${updatedData.lastStatusCheck?.toDate?.()}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ PROPERTY SUCCESSFULLY UPDATED WITH FRESH ESTIMATES');
  console.log('='.repeat(60));
  
  process.exit(0);
}

forceUpdateProperty().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});