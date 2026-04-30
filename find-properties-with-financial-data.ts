import { getFirebaseAdmin } from './src/lib/scraper-v2/firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function findPropertiesWithFinancialData() {
  const { db } = getFirebaseAdmin();
  
  console.log('=== FINDING OWNER FINANCE PROPERTIES WITH FINANCIAL DATA ===\n');
  
  // Get all owner finance properties
  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .get();
  
  console.log(`Checking ${snapshot.size} owner finance properties...\n`);
  
  let withTaxData = 0;
  let withInsuranceData = 0;
  let withHOAData = 0;
  let withRentData = 0;
  let qualifyingProperties = 0;
  
  const propertiesWithData: any[] = [];
  
  snapshot.docs.forEach(doc => {
    const property = doc.data();
    
    // Check if has financial data
    const hasTax = property.annualTaxAmount && property.annualTaxAmount > 0;
    const hasInsurance = property.annualHomeownersInsurance && property.annualHomeownersInsurance > 0;
    const hasHOA = property.hoa || property.monthlyHoaFee;
    const hasRent = property.rentEstimate && property.rentEstimate > 0;
    
    if (hasTax) withTaxData++;
    if (hasInsurance) withInsuranceData++;
    if (hasHOA) withHOAData++;
    if (hasRent) withRentData++;
    
    // Check if qualifies for analysis (same filters as cash flow script)
    const qualifies = property.rentEstimate && property.rentEstimate > 0 &&
                     property.price && property.price > 0 &&
                     (!property.propertyType || property.propertyType.toLowerCase().includes('single family')) &&
                     (!property.yearBuilt || property.yearBuilt >= 1970) &&
                     (!property.bedrooms || property.bedrooms >= 2) &&
                     (!property.bathrooms || property.bathrooms >= 1);
    
    if (qualifies) qualifyingProperties++;
    
    // Collect properties that have ALL financial data AND qualify
    if (hasTax && hasInsurance && hasRent && qualifies) {
      propertiesWithData.push({
        zpid: property.zpid,
        address: property.fullAddress || property.address,
        price: property.price,
        rentEstimate: property.rentEstimate,
        annualTaxAmount: property.annualTaxAmount,
        annualHomeownersInsurance: property.annualHomeownersInsurance,
        hoa: property.hoa || 0,
        monthlyHoaFee: property.monthlyHoaFee || 0
      });
    }
  });
  
  console.log('=== FINANCIAL DATA SUMMARY ===');
  console.log(`Total owner finance properties: ${snapshot.size}`);
  console.log(`Properties qualifying for analysis: ${qualifyingProperties}`);
  console.log(`Properties with tax data: ${withTaxData}`);
  console.log(`Properties with insurance data: ${withInsuranceData}`);
  console.log(`Properties with HOA data: ${withHOAData}`);
  console.log(`Properties with rent data: ${withRentData}`);
  console.log(`Properties with ALL data (tax + insurance + rent + qualifying): ${propertiesWithData.length}`);
  
  console.log('\n=== PROPERTIES WITH COMPLETE FINANCIAL DATA ===');
  propertiesWithData.slice(0, 10).forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address} (ZPID: ${prop.zpid})`);
    console.log(`   Price: $${prop.price?.toLocaleString()}, Rent: $${prop.rentEstimate}`);
    console.log(`   Annual Tax: $${prop.annualTaxAmount}, Insurance: $${prop.annualHomeownersInsurance}, HOA: $${prop.monthlyHoaFee || prop.hoa}`);
    console.log('');
  });
  
  // Try the Chicago properties specifically
  console.log('=== CHECKING SPECIFIC CHICAGO PROPERTIES ===');
  const chicagoZpids = ['101317013', '101344699', '101446184'];
  
  for (const zpid of chicagoZpids) {
    const doc = await db.collection('properties').doc(`zpid_${zpid}`).get();
    if (doc.exists) {
      const data = doc.data();
      console.log(`ZPID ${zpid}:`);
      console.log(`  Address: ${data?.fullAddress}`);
      console.log(`  isOwnerFinance: ${data?.isOwnerFinance}`);
      console.log(`  rentEstimate: ${data?.rentEstimate}`);
      console.log(`  price: ${data?.price}`);
      console.log(`  annualTaxAmount: ${data?.annualTaxAmount}`);
      console.log(`  annualHomeownersInsurance: ${data?.annualHomeownersInsurance}`);
      console.log(`  propertyType: ${data?.propertyType}`);
      console.log(`  yearBuilt: ${data?.yearBuilt}`);
      console.log(`  bedrooms: ${data?.bedrooms}, bathrooms: ${data?.bathrooms}`);
      
      // Check why they might be filtered out
      const hasRent = data?.rentEstimate && data?.rentEstimate > 0;
      const hasPrice = data?.price && data?.price > 0;
      const isSF = !data?.propertyType || data?.propertyType.toLowerCase().includes('single family');
      const isNewEnough = !data?.yearBuilt || data?.yearBuilt >= 1970;
      const isBigEnough = (!data?.bedrooms || data?.bedrooms >= 2) && (!data?.bathrooms || data?.bathrooms >= 1);
      
      console.log(`  Filter check: hasRent=${hasRent}, hasPrice=${hasPrice}, isSF=${isSF}, isNewEnough=${isNewEnough}, isBigEnough=${isBigEnough}`);
      console.log('');
    }
  }
}

findPropertiesWithFinancialData();