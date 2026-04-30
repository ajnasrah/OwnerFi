import { getFirebaseAdmin } from './src/lib/scraper-v2/firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function examineRawPropertyData() {
  const { db } = getFirebaseAdmin();
  
  console.log('=== EXAMINING RAW PROPERTY DATA FROM APIFY ===\n');
  
  // Get a few owner finance properties to see ALL their fields
  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .limit(3)
    .get();
  
  snapshot.docs.forEach((doc, i) => {
    const data = doc.data();
    console.log(`========== PROPERTY ${i + 1} (ZPID: ${data.zpid}) ==========`);
    console.log(`Address: ${data.fullAddress || data.address}`);
    console.log(`Price: $${data.price?.toLocaleString()}`);
    console.log(`Rent: $${data.rentEstimate}`);
    console.log('');
    console.log('ALL FIELDS AND VALUES:');
    
    // Sort fields alphabetically for easier reading
    const sortedFields = Object.keys(data).sort();
    
    sortedFields.forEach(field => {
      const value = data[field];
      const type = typeof value;
      
      // Highlight potential tax/insurance/hoa fields
      const lowField = field.toLowerCase();
      let prefix = '  ';
      if (lowField.includes('tax') || lowField.includes('property_tax')) {
        prefix = '🟨 TAX: ';
      } else if (lowField.includes('insurance') || lowField.includes('homeowner')) {
        prefix = '🟦 INS: ';
      } else if (lowField.includes('hoa') || lowField.includes('association') || lowField.includes('dues')) {
        prefix = '🟩 HOA: ';
      } else if (lowField.includes('monthly') && !lowField.includes('mortgage')) {
        prefix = '🟪 MONTHLY: ';
      } else if (lowField.includes('annual') && !lowField.includes('mortgage')) {
        prefix = '🟫 ANNUAL: ';
      } else if (lowField.includes('cost') || lowField.includes('expense') || lowField.includes('fee')) {
        prefix = '🟧 COST: ';
      }
      
      // Show value with type info
      let displayValue = value;
      if (type === 'object' && value !== null) {
        displayValue = Array.isArray(value) ? `[Array of ${value.length}]` : `[Object]`;
      } else if (type === 'string' && value.length > 100) {
        displayValue = value.substring(0, 100) + '...';
      }
      
      console.log(`${prefix}${field}: ${displayValue} (${type})`);
    });
    
    console.log('\n' + '='.repeat(80) + '\n');
  });
  
  // Also check a non-owner-finance property to compare
  console.log('========== COMPARISON: NON-OWNER-FINANCE PROPERTY ==========');
  const nonOfSnapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', false)
    .limit(1)
    .get();
  
  if (!nonOfSnapshot.empty) {
    const data = nonOfSnapshot.docs[0].data();
    console.log(`Address: ${data.fullAddress || data.address}`);
    console.log(`Price: $${data.price?.toLocaleString()}`);
    console.log('');
    console.log('TAX/INSURANCE/HOA FIELDS ONLY:');
    
    Object.keys(data).sort().forEach(field => {
      const lowField = field.toLowerCase();
      if (lowField.includes('tax') || lowField.includes('insurance') || 
          lowField.includes('hoa') || lowField.includes('monthly') || 
          lowField.includes('annual') || lowField.includes('cost') ||
          lowField.includes('expense') || lowField.includes('fee')) {
        console.log(`  ${field}: ${data[field]} (${typeof data[field]})`);
      }
    });
  }
}

examineRawPropertyData();