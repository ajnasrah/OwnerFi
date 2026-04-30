import { getFirebaseAdmin } from './src/lib/scraper-v2/firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkPropertyStatus() {
  const { db } = getFirebaseAdmin();
  
  console.log('=== CHECKING PROPERTY STATUS AND MLS DATA ===\n');
  
  // Get owner finance properties and check their status
  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .limit(50)
    .get();
  
  console.log(`Checking ${snapshot.size} owner finance properties...\n`);
  
  const statusCounts: Record<string, number> = {};
  const activeMLS: any[] = [];
  const offMarket: any[] = [];
  
  snapshot.docs.forEach(doc => {
    const property = doc.data();
    
    // Check status fields
    const homeStatus = property.homeStatus;
    const keystoneHomeStatus = property.keystoneHomeStatus;
    const isActive = property.isActive;
    const mlsId = property.mlsId;
    const daysOnZillow = property.daysOnZillow;
    const offMarketReason = property.offMarketReason;
    const deactivatedReason = property.deactivatedReason;
    
    // Count statuses
    statusCounts[homeStatus] = (statusCounts[homeStatus] || 0) + 1;
    
    // Categorize
    const isActiveProperty = homeStatus === 'FOR_SALE' && isActive !== false && !offMarketReason;
    
    if (isActiveProperty && mlsId) {
      activeMLS.push({
        zpid: property.zpid,
        address: property.fullAddress || property.address,
        homeStatus,
        keystoneHomeStatus,
        isActive,
        mlsId,
        daysOnZillow,
        price: property.price,
        rentEstimate: property.rentEstimate
      });
    } else {
      offMarket.push({
        zpid: property.zpid,
        address: property.fullAddress || property.address,
        homeStatus,
        keystoneHomeStatus,
        isActive,
        mlsId,
        offMarketReason,
        deactivatedReason,
        daysOnZillow,
        price: property.price,
        rentEstimate: property.rentEstimate
      });
    }
  });
  
  console.log('=== STATUS BREAKDOWN ===');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  console.log(`\n=== ACTIVE MLS PROPERTIES (${activeMLS.length}) ===`);
  activeMLS.slice(0, 5).forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address} (ZPID: ${prop.zpid})`);
    console.log(`   Status: ${prop.homeStatus}, MLS: ${prop.mlsId}, Days: ${prop.daysOnZillow}`);
    console.log(`   Price: $${prop.price?.toLocaleString()}, Rent: $${prop.rentEstimate}`);
    console.log('');
  });
  
  console.log(`=== OFF-MARKET PROPERTIES (${offMarket.length}) ===`);
  offMarket.slice(0, 5).forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address} (ZPID: ${prop.zpid})`);
    console.log(`   Status: ${prop.homeStatus}, Active: ${prop.isActive}, MLS: ${prop.mlsId || 'None'}`);
    console.log(`   Off Market Reason: ${prop.offMarketReason || 'None'}`);
    console.log(`   Deactivated Reason: ${prop.deactivatedReason || 'None'}`);
    console.log('');
  });
  
  // Check all owner finance properties for active status
  console.log('=== FULL DATABASE STATUS CHECK ===');
  const fullSnapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .get();
  
  let totalActive = 0;
  let totalOffMarket = 0;
  let withMLS = 0;
  let withoutMLS = 0;
  
  fullSnapshot.docs.forEach(doc => {
    const property = doc.data();
    const isActiveProperty = property.homeStatus === 'FOR_SALE' && 
                            property.isActive !== false && 
                            !property.offMarketReason;
    
    if (isActiveProperty) {
      totalActive++;
    } else {
      totalOffMarket++;
    }
    
    if (property.mlsId) {
      withMLS++;
    } else {
      withoutMLS++;
    }
  });
  
  console.log(`Total owner finance properties: ${fullSnapshot.size}`);
  console.log(`Active (FOR_SALE + no off market reason): ${totalActive}`);
  console.log(`Off market: ${totalOffMarket}`);
  console.log(`With MLS ID: ${withMLS}`);
  console.log(`Without MLS ID: ${withoutMLS}`);
}

checkPropertyStatus();