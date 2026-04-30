#!/usr/bin/env npx tsx

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function checkResults() {
  const { db } = getFirebaseAdmin();
  
  console.log('Checking manual search results...\n');
  
  // Check total properties from manual search
  const manualSnapshot = await db.collection('properties')
    .where('fromManualSearch', '==', true)
    .limit(50)
    .get();
    
  console.log(`Properties from manual search: ${manualSnapshot.size}`);
  
  if (manualSnapshot.size > 0) {
    console.log('\nSample properties:');
    manualSnapshot.docs.slice(0, 10).forEach(doc => {
      const data = doc.data();
      console.log(`- ${data.address || data.zpid} (${data.zipcode || 'no zip'}) - ${data.sentToGHL ? 'Sent to GHL' : 'Not sent'}`);
    });
    
    // Check by zip code
    const zipCounts: Record<string, number> = {};
    manualSnapshot.docs.forEach(doc => {
      const zip = doc.data().zipcode;
      if (zip) {
        zipCounts[zip] = (zipCounts[zip] || 0) + 1;
      }
    });
    
    console.log('\nProperties by zip code:');
    Object.entries(zipCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([zip, count]) => {
        console.log(`  ${zip}: ${count} properties`);
      });
  }
  
  // Check recent properties (last 2 hours)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const recentSnapshot = await db.collection('properties')
    .where('createdAt', '>=', twoHoursAgo)
    .limit(10)
    .get();
    
  console.log(`\nRecent properties (last 2 hours): ${recentSnapshot.size}`);
  
  // Check agent data in saved property
  if (manualSnapshot.size > 0) {
    console.log('\n=== AGENT DATA CHECK ===');
    const sampleProperty = manualSnapshot.docs[0].data();
    console.log('Property data keys:', Object.keys(sampleProperty));
    console.log('\nAgent fields:');
    console.log('- agentName:', sampleProperty.agentName || 'MISSING');
    console.log('- agentPhone:', sampleProperty.agentPhone || 'MISSING'); 
    console.log('- agentPhoneNumber:', sampleProperty.agentPhoneNumber || 'MISSING');
    console.log('- brokerPhoneNumber:', sampleProperty.brokerPhoneNumber || 'MISSING');
    console.log('- agentEmail:', sampleProperty.agentEmail || 'MISSING');
    console.log('- contactName:', sampleProperty.contactName || 'MISSING');
    console.log('- contactPhone:', sampleProperty.contactPhone || 'MISSING');
    console.log('- brokerName:', sampleProperty.brokerName || 'MISSING');
    console.log('- listingAgent:', sampleProperty.listingAgent ? 'Present' : 'MISSING');
    console.log('- listingOffice:', sampleProperty.listingOffice ? 'Present' : 'MISSING');
    
    if (!sampleProperty.agentName && !sampleProperty.agentPhone && !sampleProperty.contactName) {
      console.log('\n🚨 CRITICAL: NO AGENT DATA FOUND IN SAVED PROPERTY');
    }
  }
}

checkResults().catch(console.error);