import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  query, 
  where, 
  limit,
  getDocs 
} from 'firebase/firestore';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
  
  // Process in batches to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (prop) => {
      let found = false;
      let propertyDoc: any = null;
      
      // First try to find by firebase_id
      if (prop.firebase_id && prop.firebase_id.length > 0) {
        try {
          const docRef = doc(db, 'properties', prop.firebase_id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            propertyDoc = { id: docSnap.id, ...docSnap.data() };
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
          const addressQuery = query(
            collection(db, 'properties'),
            where('address', '==', prop.address),
            limit(1)
          );
          
          const addressSnapshot = await getDocs(addressQuery);
          
          if (!addressSnapshot.empty) {
            const doc = addressSnapshot.docs[0];
            propertyDoc = { id: doc.id, ...doc.data() };
            results.foundByAddress.push({
              csv: prop,
              db: propertyDoc
            });
            found = true;
          } else {
            // Try streetAddress field
            const streetQuery = query(
              collection(db, 'properties'),
              where('streetAddress', '==', prop.address),
              limit(1)
            );
            
            const streetSnapshot = await getDocs(streetQuery);
            
            if (!streetSnapshot.empty) {
              const doc = streetSnapshot.docs[0];
              propertyDoc = { id: doc.id, ...doc.data() };
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
    }));
    
    console.log(`Processed ${Math.min(i + batchSize, properties.length)} of ${properties.length} properties...`);
  }
  
  // Print results
  console.log('\n=== SUMMARY ===\n');
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
    
    // Save list of IDs to update
    const updateIds = results.missingOwnerFinanceFlag.map(item => item.db.id);
    fs.writeFileSync('/tmp/properties_to_update.json', JSON.stringify(updateIds, null, 2));
    console.log(`\nList of ${updateIds.length} property IDs to update saved to: /tmp/properties_to_update.json`);
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
    console.log(`\nFull list of ${results.notFound.length} properties not found saved to: /tmp/properties_not_found.csv`);
  }
  
  process.exit(0);
}

checkProperties().catch(console.error);