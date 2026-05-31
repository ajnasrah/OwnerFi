import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  updateDoc 
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

async function fixOwnerFinanceFlags() {
  console.log('\n=== FIXING OWNER FINANCE FLAGS ===\n');
  
  // Read the list of property IDs to update
  const idsToUpdate = JSON.parse(fs.readFileSync('/tmp/properties_to_update.json', 'utf8'));
  
  console.log(`Found ${idsToUpdate.length} properties to update\n`);
  
  for (const propertyId of idsToUpdate) {
    try {
      console.log(`Updating property: ${propertyId}`);
      
      const propertyRef = doc(db, 'properties', propertyId);
      
      // Update the property with owner finance flags
      await updateDoc(propertyRef, {
        isOwnerFinance: true,
        dealType: 'owner-finance',
        updatedAt: new Date().toISOString(),
        updateReason: 'MLS outreach agent marked as Interested - owner finance positive'
      });
      
      console.log(`✅ Successfully updated property ${propertyId}`);
      
    } catch (error) {
      console.error(`❌ Failed to update property ${propertyId}:`, error);
    }
  }
  
  console.log('\n=== UPDATE COMPLETE ===\n');
  console.log(`Updated ${idsToUpdate.length} properties with owner finance flags`);
  console.log('These properties should now appear on the website as owner finance properties.');
  
  process.exit(0);
}

// Run the fix
fixOwnerFinanceFlags().catch(console.error);