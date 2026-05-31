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

async function checkAllNotInterestedProperties() {
  // Read the original CSV file to get "not interested" properties
  const csvContent = fs.readFileSync('/Users/abdullahabunasrah/Downloads/opportunities.csv', 'utf8');
  const lines = csvContent.trim().split('\n');
  
  const notInterestedProperties: NotInterestedProperty[] = [];
  
  // Parse CSV - stage is column 6 (index 5)
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values[5] && values[5].includes('not interested')) {
      const address = values[22] || '';
      // Skip empty addresses
      if (address && address.trim().length > 0) {
        notInterestedProperties.push({
          firebase_id: values[47] || '',
          address: address,
          city: values[23] || '',
          state: values[24] || '',
          zip: values[25] || '',
          price: values[32] || ''
        });
      }
    }
  }
  
  console.log(`\nChecking ALL ${notInterestedProperties.length} "not interested" properties with valid addresses...\n`);
  
  const results = {
    foundWithCorrectFlag: [] as any[],
    foundWithIncorrectFlag: [] as any[],
    notFound: [] as NotInterestedProperty[],
    totalFound: 0
  };
  
  // Process in batches to avoid rate limits
  const batchSize = 10;
  let processedCount = 0;
  
  for (let i = 0; i < notInterestedProperties.length; i += batchSize) {
    const batch = notInterestedProperties.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (prop) => {
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
        // Silently skip errors to avoid flooding console
      }
    }));
    
    processedCount += batch.length;
    if (processedCount % 100 === 0) {
      console.log(`Processed ${processedCount} of ${notInterestedProperties.length} properties...`);
      if (results.foundWithIncorrectFlag.length > 0) {
        console.log(`  Found ${results.foundWithIncorrectFlag.length} incorrectly marked so far...`);
      }
    }
  }
  
  // Print results
  console.log('\n=== FINAL SUMMARY (ALL "not interested" properties) ===\n');
  console.log(`Total "not interested" checked: ${notInterestedProperties.length}`);
  console.log(`Found in database: ${results.totalFound}`);
  console.log(`Not found: ${results.notFound.length}`);
  console.log(`\nOf found properties:`);
  console.log(`  ✅ CORRECTLY marked (no owner finance flag): ${results.foundWithCorrectFlag.length}`);
  console.log(`  ❌ INCORRECTLY marked (HAS owner finance flag): ${results.foundWithIncorrectFlag.length}`);
  
  if (results.foundWithIncorrectFlag.length > 0) {
    console.log('\n=== PROPERTIES INCORRECTLY MARKED AS OWNER FINANCE ===');
    console.log('These are "not interested" but have owner finance flag:\n');
    
    // Show first 10 examples
    for (const item of results.foundWithIncorrectFlag.slice(0, 10)) {
      console.log(`ID: ${item.db.id}`);
      console.log(`Address: ${item.csv.address}, ${item.csv.city}, ${item.csv.state} ${item.csv.zip}`);
      console.log(`Current flags: isOwnerFinance=${item.db.isOwnerFinance}, dealType=${item.db.dealType}`);
      console.log('Should be: isOwnerFinance=false');
      console.log('---');
    }
    
    if (results.foundWithIncorrectFlag.length > 10) {
      console.log(`\n... and ${results.foundWithIncorrectFlag.length - 10} more`);
    }
    
    // Save full list to file
    const incorrectList = results.foundWithIncorrectFlag.map(item => ({
      id: item.db.id,
      address: `${item.csv.address}, ${item.csv.city}, ${item.csv.state} ${item.csv.zip}`,
      currentIsOwnerFinance: item.db.isOwnerFinance,
      currentDealType: item.db.dealType
    }));
    
    fs.writeFileSync('/tmp/not_interested_incorrectly_marked.json', JSON.stringify(incorrectList, null, 2));
    console.log(`\nFull list of ${results.foundWithIncorrectFlag.length} incorrectly marked properties saved to:`);
    console.log('/tmp/not_interested_incorrectly_marked.json');
    
    // Save just the IDs for fixing
    const idsToFix = results.foundWithIncorrectFlag.map(item => item.db.id);
    fs.writeFileSync('/tmp/not_interested_ids_to_fix.json', JSON.stringify(idsToFix, null, 2));
    console.log(`\nProperty IDs to fix saved to: /tmp/not_interested_ids_to_fix.json`);
  } else {
    console.log('\n✅ All "not interested" properties are correctly marked!');
  }
  
  // Show percentage breakdown
  const percentCorrect = results.totalFound > 0 
    ? ((results.foundWithCorrectFlag.length / results.totalFound) * 100).toFixed(1)
    : '100';
  const percentIncorrect = results.totalFound > 0
    ? ((results.foundWithIncorrectFlag.length / results.totalFound) * 100).toFixed(1)
    : '0';
    
  console.log('\n=== ACCURACY METRICS ===');
  console.log(`Correct: ${percentCorrect}%`);
  console.log(`Incorrect: ${percentIncorrect}%`);
  
  process.exit(0);
}

checkAllNotInterestedProperties().catch(console.error);