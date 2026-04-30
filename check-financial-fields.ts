import { getFirebaseAdmin } from './src/lib/scraper-v2/firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkFinancialFields() {
  try {
    const { db } = getFirebaseAdmin();
    
    console.log('=== CHECKING TAX, INSURANCE, HOA FIELDS ===\n');
    
    // Get a sample of owner finance properties to check field names
    const snapshot = await db.collection('properties')
      .where('isOwnerFinance', '==', true)
      .limit(10)
      .get();
    
    console.log(`Checking ${snapshot.size} sample properties...\n`);
    
    const taxFields = new Set<string>();
    const insuranceFields = new Set<string>();
    const hoaFields = new Set<string>();
    const allFinancialFields = new Set<string>();
    
    snapshot.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`Property ${i + 1} (ZPID: ${data.zpid || 'N/A'}):`);
      console.log(`  Address: ${data.fullAddress || data.address || 'Unknown'}`);
      console.log(`  Price: $${data.price?.toLocaleString() || 'N/A'}`);
      console.log(`  Rent Estimate: $${data.rentEstimate || 'N/A'}`);
      
      // Check all fields for tax/insurance/hoa related
      Object.keys(data).forEach(key => {
        const lowKey = key.toLowerCase();
        
        if (lowKey.includes('tax') || lowKey.includes('property_tax') || lowKey.includes('annual_tax')) {
          taxFields.add(key);
          allFinancialFields.add(key);
          console.log(`  TAX - ${key}: ${data[key]}`);
        }
        
        if (lowKey.includes('insurance') || lowKey.includes('homeowner')) {
          insuranceFields.add(key);
          allFinancialFields.add(key);
          console.log(`  INSURANCE - ${key}: ${data[key]}`);
        }
        
        if (lowKey.includes('hoa') || lowKey.includes('association') || lowKey.includes('dues')) {
          hoaFields.add(key);
          allFinancialFields.add(key);
          console.log(`  HOA - ${key}: ${data[key]}`);
        }
        
        // Check other potential expense fields
        if (lowKey.includes('monthly') || lowKey.includes('expense') || lowKey.includes('fee') || 
            lowKey.includes('cost') || lowKey.includes('payment')) {
          if (!key.toLowerCase().includes('mortgage') && !key.toLowerCase().includes('loan')) {
            allFinancialFields.add(key);
            console.log(`  OTHER EXPENSE - ${key}: ${data[key]}`);
          }
        }
      });
      
      console.log('');
    });
    
    console.log('=== FIELD SUMMARY ===');
    console.log(`Tax-related fields found: ${Array.from(taxFields).join(', ') || 'NONE'}`);
    console.log(`Insurance-related fields found: ${Array.from(insuranceFields).join(', ') || 'NONE'}`);
    console.log(`HOA-related fields found: ${Array.from(hoaFields).join(', ') || 'NONE'}`);
    console.log(`Other financial fields: ${Array.from(allFinancialFields).join(', ') || 'NONE'}`);
    
    // Check if we have any properties with these specific fields
    console.log('\n=== CHECKING FOR SPECIFIC EXPECTED FIELDS ===');
    const expectedFields = ['taxAnnualAmount', 'annualHomeownersInsurance', 'hoaFee', 'monthlyTax', 'monthlyInsurance', 'monthlyHOA'];
    
    for (const field of expectedFields) {
      const fieldSnapshot = await db.collection('properties')
        .where('isOwnerFinance', '==', true)
        .orderBy(field, 'desc')
        .limit(1)
        .get();
      
      if (!fieldSnapshot.empty) {
        const doc = fieldSnapshot.docs[0];
        const data = doc.data();
        console.log(`✅ Found ${field}: ${data[field]} (ZPID: ${data.zpid})`);
      } else {
        console.log(`❌ No properties found with field: ${field}`);
      }
    }
    
  } catch (error) {
    if (error.message.includes('index')) {
      console.log(`⚠️  Skipping field check due to missing index: ${error.message.split('create it here:')[0]}`);
    } else {
      console.error('Error:', error);
    }
  }
}

checkFinancialFields();