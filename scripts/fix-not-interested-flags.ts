import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  updateDoc,
  getDoc
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

async function fixNotInterestedFlags() {
  console.log('\n=== FIXING INCORRECTLY MARKED "NOT INTERESTED" PROPERTIES ===\n');
  
  // Read the list of property IDs to fix
  const idsToFix = JSON.parse(fs.readFileSync('/tmp/not_interested_ids_to_fix.json', 'utf8'));
  
  // Remove duplicates (zpid_2063411605 appears multiple times)
  const uniqueIds = [...new Set(idsToFix)];
  
  console.log(`Found ${idsToFix.length} properties to fix (${uniqueIds.length} unique IDs)\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const propertyId of uniqueIds) {
    try {
      console.log(`Processing property: ${propertyId}`);
      
      const propertyRef = doc(db, 'properties', propertyId);
      
      // First verify the property exists
      const propertyDoc = await getDoc(propertyRef);
      if (!propertyDoc.exists()) {
        console.log(`  ⚠️  Property ${propertyId} not found, skipping...`);
        continue;
      }
      
      const currentData = propertyDoc.data();
      console.log(`  Current: isOwnerFinance=${currentData.isOwnerFinance}, dealType=${currentData.dealType}`);
      
      // Update the property to remove owner finance flags
      await updateDoc(propertyRef, {
        isOwnerFinance: false,
        dealType: 'regular',
        updatedAt: new Date().toISOString(),
        updateReason: 'MLS outreach agent marked as NOT interested - removing incorrect owner finance flag'
      });
      
      console.log(`  ✅ Fixed - set isOwnerFinance=false, dealType=regular`);
      successCount++;
      
    } catch (error) {
      console.error(`  ❌ Failed to update property ${propertyId}:`, error);
      errorCount++;
    }
  }
  
  console.log('\n=== UPDATE COMPLETE ===\n');
  console.log(`Successfully fixed: ${successCount} properties`);
  console.log(`Errors: ${errorCount} properties`);
  console.log('\nThese properties will no longer appear as owner finance properties on the website.');
  
  // Verify the most problematic ID
  if (uniqueIds.includes('zpid_2063411605')) {
    console.log('\n⚠️  Note: zpid_2063411605 appeared multiple times with different addresses.');
    console.log('This might be a data quality issue where multiple properties share the same ID.');
  }
  
  process.exit(0);
}

// Run the fix
fixNotInterestedFlags().catch(console.error);