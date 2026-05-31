import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
initializeApp({
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ownerfi-95aa0',
});

const db = getFirestore();

interface InterestedProperty {
  firebase_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: string;
}

async function checkProperties() {
  // Read the CSV file
  const csvContent = fs.readFileSync('/tmp/interested_properties_with_header.csv', 'utf8');
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');
  
  const properties: InterestedProperty[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    properties.push({
      firebase_id: values[0] || '',
      address: values[1] || '',
      city: values[2] || '',
      state: values[3] || '',
      zip: values[4] || '',
      price: values[5] || ''
    });
  }
  
  console.log(`\nChecking ${properties.length} interested properties from CSV...\n`);
  
  const results = {
    foundByFirebaseId: [] as any[],
    foundByAddress: [] as any[],
    notFound: [] as InterestedProperty[],
    missingOwnerFinanceFlag: [] as any[],
    correctOwnerFinanceFlag: [] as any[]
  };
  
  for (const prop of properties) {
    let found = false;
    let propertyDoc: any = null;
    
    // First try to find by firebase_id
    if (prop.firebase_id && prop.firebase_id.length > 0) {
      try {
        const docRef = await db.collection('properties').doc(prop.firebase_id).get();
        if (docRef.exists) {
          propertyDoc = { id: docRef.id, ...docRef.data() };
          results.foundByFirebaseId.push({
            csv: prop,
            db: propertyDoc
          });
          found = true;
        }
      } catch (error) {
        // Document not found by ID
      }
    }
    
    // If not found by ID, try by address
    if (!found && prop.address && prop.address.length > 0) {
      try {
        // Try exact address match
        const addressQuery = await db.collection('properties')
          .where('address', '==', prop.address)
          .limit(1)
          .get();
        
        if (!addressQuery.empty) {
          propertyDoc = { id: addressQuery.docs[0].id, ...addressQuery.docs[0].data() };
          results.foundByAddress.push({
            csv: prop,
            db: propertyDoc
          });
          found = true;
        } else {
          // Try streetAddress field
          const streetQuery = await db.collection('properties')
            .where('streetAddress', '==', prop.address)
            .limit(1)
            .get();
          
          if (!streetQuery.empty) {
            propertyDoc = { id: streetQuery.docs[0].id, ...streetQuery.docs[0].data() };
            results.foundByAddress.push({
              csv: prop,
              db: propertyDoc
            });
            found = true;
          }
        }
      } catch (error) {
        console.error(`Error searching for address ${prop.address}:`, error);
      }
    }
    
    // Check owner finance flag for found properties
    if (found && propertyDoc) {
      const isOwnerFinance = propertyDoc.isOwnerFinance || propertyDoc.dealType === 'owner-finance';
      if (isOwnerFinance) {
        results.correctOwnerFinanceFlag.push({
          csv: prop,
          db: propertyDoc
        });
      } else {
        results.missingOwnerFinanceFlag.push({
          csv: prop,
          db: propertyDoc
        });
      }
    } else {
      results.notFound.push(prop);
    }
  }
  
  // Print results
  console.log('=== SUMMARY ===\n');
  console.log(`Total properties checked: ${properties.length}`);
  console.log(`Found by Firebase ID: ${results.foundByFirebaseId.length}`);
  console.log(`Found by Address: ${results.foundByAddress.length}`);
  console.log(`Not found in database: ${results.notFound.length}`);
  console.log(`\nOf found properties:`);
  console.log(`  - Correctly marked as owner finance: ${results.correctOwnerFinanceFlag.length}`);
  console.log(`  - MISSING owner finance flag: ${results.missingOwnerFinanceFlag.length}`);
  
  if (results.missingOwnerFinanceFlag.length > 0) {
    console.log('\n=== PROPERTIES MISSING OWNER FINANCE FLAG ===\n');
    for (const item of results.missingOwnerFinanceFlag) {
      console.log(`ID: ${item.db.id}`);
      console.log(`Address: ${item.csv.address}, ${item.csv.city}, ${item.csv.state} ${item.csv.zip}`);
      console.log(`Current flags: isOwnerFinance=${item.db.isOwnerFinance}, dealType=${item.db.dealType}`);
      console.log('---');
    }
  }
  
  if (results.notFound.length > 0) {
    console.log('\n=== PROPERTIES NOT FOUND IN DATABASE ===\n');
    console.log('First 20 not found:');
    for (const prop of results.notFound.slice(0, 20)) {
      console.log(`${prop.address}, ${prop.city}, ${prop.state} ${prop.zip} (CSV Firebase ID: ${prop.firebase_id || 'none'})`);
    }
    
    // Save full list to file
    const notFoundCsv = 'address,city,state,zip,firebase_id,price\n' + 
      results.notFound.map(p => `"${p.address}","${p.city}","${p.state}","${p.zip}","${p.firebase_id}","${p.price}"`).join('\n');
    fs.writeFileSync('/tmp/properties_not_found.csv', notFoundCsv);
    console.log(`\nFull list saved to: /tmp/properties_not_found.csv`);
  }
  
  process.exit(0);
}

checkProperties().catch(console.error);