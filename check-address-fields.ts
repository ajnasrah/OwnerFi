import { getFirebaseAdmin } from './src/lib/scraper-v2/firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkAddressFields() {
  try {
    const { db } = getFirebaseAdmin();
    
    console.log('=== CHECKING ADDRESS FIELD MAPPING ===\n');
    
    // Get a sample of owner finance properties to check field names
    const snapshot = await db.collection('properties')
      .where('isOwnerFinance', '==', true)
      .limit(5)
      .get();
    
    console.log(`Checking ${snapshot.size} sample properties...\n`);
    
    const addressFields = new Set<string>();
    const allFields = new Set<string>();
    
    snapshot.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`Property ${i + 1} (ZPID: ${data.zpid || 'N/A'}):`);
      
      // Collect all field names
      Object.keys(data).forEach(key => allFields.add(key));
      
      // Check for address-related fields
      Object.keys(data).forEach(key => {
        const lowKey = key.toLowerCase();
        if (lowKey.includes('address') || lowKey.includes('street') || lowKey.includes('location')) {
          addressFields.add(key);
          console.log(`  ${key}: ${data[key]}`);
        }
      });
      
      // Also check common address field variations
      const commonAddressFields = ['address', 'streetAddress', 'street', 'fullAddress', 'propertyAddress', 'location', 'addressLine1'];
      commonAddressFields.forEach(field => {
        if (data[field]) {
          console.log(`  ${field}: ${data[field]}`);
        }
      });
      
      console.log('');
    });
    
    console.log('=== SUMMARY ===');
    console.log(`Address-related fields found: ${Array.from(addressFields).join(', ')}`);
    console.log(`Total unique fields in properties: ${allFields.size}`);
    
    console.log('\nAll fields (first 50):');
    Array.from(allFields).slice(0, 50).forEach(field => {
      console.log(`  - ${field}`);
    });
    
    // Check one specific high-value property
    console.log('\n=== CHECKING HIGH-VALUE PROPERTY ===');
    const highValueSnapshot = await db.collection('properties')
      .where('isOwnerFinance', '==', true)
      .where('rentEstimate', '>=', 4000)
      .limit(1)
      .get();
    
    if (!highValueSnapshot.empty) {
      const highValueDoc = highValueSnapshot.docs[0];
      const data = highValueDoc.data();
      console.log(`High-value property (ZPID: ${data.zpid}):`);
      Object.keys(data).sort().forEach(key => {
        if (key.toLowerCase().includes('address') || key.toLowerCase().includes('street') || 
            key.toLowerCase().includes('city') || key.toLowerCase().includes('state') ||
            key === 'rentEstimate' || key === 'price') {
          console.log(`  ${key}: ${data[key]}`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAddressFields();