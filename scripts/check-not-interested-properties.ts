import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
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

interface NotInterestedProperty {
  firebase_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: string;
}

async function checkNotInterestedProperties() {
  // Read the original CSV file to get "not interested" properties
  const csvContent = fs.readFileSync('/Users/abdullahabunasrah/Downloads/opportunities.csv', 'utf8');
  const lines = csvContent.trim().split('\n');
  
  const notInterestedProperties: NotInterestedProperty[] = [];
  
  // Parse CSV - stage is column 6 (index 5)
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values[5] && values[5].includes('not interested')) {
      notInterestedProperties.push({
        firebase_id: values[47] || '',
        address: values[22] || '',
        city: values[23] || '',
        state: values[24] || '',
        zip: values[25] || '',
        price: values[32] || ''
      });
    }
  }
  
  console.log(`\nChecking ${notInterestedProperties.length} "not interested" properties from CSV...\n`);
  
  const results = {
    foundWithCorrectFlag: [] as any[],
    foundWithIncorrectFlag: [] as any[],
    notFound: [] as NotInterestedProperty[],
    totalFound: 0
  };
  
  // Process in batches to avoid rate limits
  const batchSize = 10;
  let processedCount = 0;
  
  for (let i = 0; i < Math.min(notInterestedProperties.length, 100); i += batchSize) {
    const batch = notInterestedProperties.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (prop) => {
      // Skip if no address
      if (!prop.address || prop.address.length === 0) {
        return;
      }
      
      try {
        // Try to find by address
        const addressQuery = query(
          collection(db, 'properties'),
          where('address', '==', prop.address),
          limit(1)
        );
        
        let snapshot = await getDocs(addressQuery);
        
        if (snapshot.empty) {
          // Try streetAddress field
          const streetQuery = query(
            collection(db, 'properties'),
            where('streetAddress', '==', prop.address),
            limit(1)
          );
          snapshot = await getDocs(streetQuery);
        }
        
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const propertyData = { id: doc.id, ...doc.data() };
          results.totalFound++;
          
          const hasOwnerFinanceFlag = propertyData.isOwnerFinance === true || 
                                      propertyData.dealType === 'owner-finance';
          
          if (hasOwnerFinanceFlag) {
            // This is WRONG - "not interested" should NOT have owner finance flag
            results.foundWithIncorrectFlag.push({
              csv: prop,
              db: propertyData
            });
          } else {
            // This is CORRECT - "not interested" should not have owner finance flag
            results.foundWithCorrectFlag.push({
              csv: prop,
              db: propertyData
            });
          }
        } else {
          results.notFound.push(prop);
        }
      } catch (error) {
        console.error(`Error searching for address ${prop.address}:`, error);
      }
    }));
    
    processedCount += batch.length;
    console.log(`Processed ${processedCount} of 100 sample properties...`);
  }
  
  // Print results
  console.log('\n=== SUMMARY (Sample of 100 "not interested" properties) ===\n');
  console.log(`Total "not interested" in CSV: ${notInterestedProperties.length}`);
  console.log(`Sample checked: 100`);
  console.log(`Found in database: ${results.totalFound}`);
  console.log(`Not found: ${results.notFound.length}`);
  console.log(`\nOf found properties:`);
  console.log(`  ✅ CORRECTLY marked (no owner finance flag): ${results.foundWithCorrectFlag.length}`);
  console.log(`  ❌ INCORRECTLY marked (HAS owner finance flag): ${results.foundWithIncorrectFlag.length}`);
  
  if (results.foundWithIncorrectFlag.length > 0) {
    console.log('\n=== PROPERTIES INCORRECTLY MARKED AS OWNER FINANCE ===');
    console.log('These are "not interested" but have owner finance flag:\n');
    
    for (const item of results.foundWithIncorrectFlag) {
      console.log(`ID: ${item.db.id}`);
      console.log(`Address: ${item.csv.address}, ${item.csv.city}, ${item.csv.state} ${item.csv.zip}`);
      console.log(`Current flags: isOwnerFinance=${item.db.isOwnerFinance}, dealType=${item.db.dealType}`);
      console.log('Should be: isOwnerFinance=false');
      console.log('---');
    }
    
    // Save list of IDs that need to be fixed
    const idsToFix = results.foundWithIncorrectFlag.map(item => item.db.id);
    fs.writeFileSync('/tmp/not_interested_to_fix.json', JSON.stringify(idsToFix, null, 2));
    console.log(`\nList of ${idsToFix.length} property IDs that need fixing saved to: /tmp/not_interested_to_fix.json`);
  } else {
    console.log('\n✅ All checked "not interested" properties are correctly marked!');
  }
  
  process.exit(0);
}

checkNotInterestedProperties().catch(console.error);