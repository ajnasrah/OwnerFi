import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function checkBiscayneProperty() {
  const { db } = getFirebaseAdmin();
  
  console.log('🔍 CHECKING 1303 BISCAYNE DR PROPERTY');
  console.log('=' .repeat(60) + '\n');
  
  // Search for the property
  const results = await db.collection('properties')
    .where('address', '==', '1303 Biscayne Dr')
    .get();
    
  if (results.empty) {
    // Try with full address search
    const fullAddressResults = await db.collection('properties')
      .where('fullAddress', '>=', '1303 Biscayne')
      .where('fullAddress', '<=', '1303 Biscayne\uf8ff')
      .get();
      
    if (fullAddressResults.empty) {
      // Try searching by street address
      const streetResults = await db.collection('properties')
        .where('streetAddress', '==', '1303 Biscayne Dr')
        .get();
        
      if (streetResults.empty) {
        console.log('❌ Property not found. Searching more broadly...\n');
        
        // Broader search
        const allProps = await db.collection('properties')
          .limit(5000)
          .get();
          
        const biscayneProps = allProps.docs.filter(doc => {
          const data = doc.data();
          const addr = (data.fullAddress || data.address || data.streetAddress || '').toLowerCase();
          return addr.includes('1303') && addr.includes('biscayne');
        });
        
        if (biscayneProps.length > 0) {
          console.log(`Found ${biscayneProps.length} matching properties:\n`);
          analyzeProperties(biscayneProps);
        } else {
          console.log('No properties found matching "1303 Biscayne"');
        }
      } else {
        analyzeProperties(streetResults.docs);
      }
    } else {
      analyzeProperties(fullAddressResults.docs);
    }
  } else {
    analyzeProperties(results.docs);
  }
  
  function analyzeProperties(docs: any[]) {
    docs.forEach((doc, index) => {
      const data = doc.data();
      
      console.log(`Property ${index + 1}:`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  Full Address: ${data.fullAddress || 'N/A'}`);
      console.log(`  Street Address: ${data.streetAddress || data.address || 'N/A'}`);
      console.log(`  City: ${data.city}`);
      console.log(`  State: ${data.state}`);
      console.log(`  Status: ${data.homeStatus}`);
      console.log(`  Active: ${data.isActive}`);
      console.log();
      
      console.log('  💰 PRICING & ESTIMATES:');
      console.log(`    List Price: $${data.price?.toLocaleString() || 'N/A'}`);
      console.log(`    Zestimate: $${data.zestimate?.toLocaleString() || 'N/A'}`);
      console.log(`    Estimate: $${data.estimate?.toLocaleString() || 'N/A'}`);
      console.log(`    Rent Estimate: $${data.rentEstimate?.toLocaleString() || 'N/A'}/mo`);
      console.log(`    Rent Zestimate: $${data.rentZestimate?.toLocaleString() || 'N/A'}/mo`);
      console.log();
      
      console.log('  📅 LAST UPDATES:');
      console.log(`    Last Status Check: ${data.lastStatusCheck?.toDate?.() || 'Never'}`);
      console.log(`    Last Scraped: ${data.lastScrapedAt?.toDate?.() || 'Never'}`);
      console.log(`    Updated At: ${data.updatedAt?.toDate?.() || 'N/A'}`);
      console.log(`    Created At: ${data.createdAt?.toDate?.() || 'N/A'}`);
      
      if (data.lastStatusCheck) {
        const daysSince = Math.floor((Date.now() - data.lastStatusCheck.toDate().getTime()) / (1000 * 60 * 60 * 24));
        const hoursSince = Math.floor((Date.now() - data.lastStatusCheck.toDate().getTime()) / (1000 * 60 * 60));
        
        if (hoursSince < 24) {
          console.log(`    ✅ Checked ${hoursSince} hours ago`);
        } else {
          console.log(`    ⚠️ Checked ${daysSince} days ago`);
        }
      } else {
        console.log(`    ❌ Never been checked by status cron`);
      }
      
      console.log();
      console.log('  🔗 URLS:');
      console.log(`    URL: ${data.url || 'N/A'}`);
      console.log(`    HDP URL: ${data.hdpUrl || 'N/A'}`);
      console.log(`    ZPID: ${data.zpid || 'N/A'}`);
      
      console.log('\n' + '-'.repeat(60) + '\n');
    });
    
    // Check if this property was processed in recent cron runs
    checkCronProcessing(docs[0].id);
  }
  
  async function checkCronProcessing(propertyId: string) {
    console.log('📊 CHECKING RECENT CRON PROCESSING:\n');
    
    // Get recent status change reports
    const reports = await db.collection('status_change_reports')
      .orderBy('date', 'desc')
      .limit(20)
      .get();
      
    let found = false;
    reports.docs.forEach(doc => {
      const data = doc.data();
      if (data.changes) {
        const match = data.changes.find((c: any) => 
          c.address?.includes('1303') && c.address?.includes('Biscayne')
        );
        
        if (match) {
          found = true;
          const date = data.date?.toDate?.();
          const hoursAgo = date ? 
            Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60)) : 0;
          
          console.log(`  ✅ Found in status change report from ${hoursAgo} hours ago:`);
          console.log(`     Old status: ${match.old}`);
          console.log(`     New status: ${match.new}`);
        }
      }
    });
    
    if (!found) {
      console.log('  ⚠️ Not found in recent status change reports');
      console.log('  This property may not have been processed recently');
    }
    
    console.log('\n📝 DIAGNOSIS:\n');
    console.log('If estimates are not updating, possible reasons:');
    console.log('  1. Zillow may not provide estimates for this specific property');
    console.log('  2. Property might be excluded from recent cron runs');
    console.log('  3. Apify scraper might not be returning estimate data');
    console.log('  4. Property status might prevent estimate updates');
    console.log('\nRECOMMENDATION: Manually trigger a status refresh for this property');
  }
  
  process.exit(0);
}

checkBiscayneProperty().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});