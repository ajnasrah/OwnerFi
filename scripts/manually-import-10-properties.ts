import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

// Read the missing properties
const missingProperties = JSON.parse(
  fs.readFileSync('/Users/abdullahabunasrah/Desktop/ownerfi/scripts/missing-exported-properties.json', 'utf-8')
);

function parseNumber(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function normalizeState(state: string): string {
  if (!state) return '';
  return state.trim().toUpperCase().substring(0, 2);
}

function normalizeCity(city: string): string {
  if (!city) return '';
  return city.trim().split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

async function importProperties() {
  console.log(`\\n🔄 Manually importing ${missingProperties.length} missing properties...\\n`);

  for (const csvProp of missingProperties) {
    const oppId = csvProp['Opportunity ID'];
    console.log(`\\nImporting: ${csvProp['Opportunity Name']}`);
    console.log(`   OpportunityId: ${oppId}`);

    try {
      // Check if already exists
      const existingDoc = await db.collection('properties').doc(oppId).get();
      if (existingDoc.exists) {
        console.log(`   ⚠️  Already exists, skipping`);
        continue;
      }

      const price = parseNumber(csvProp['Price']);
      const bedrooms = parseNumber(csvProp['bedrooms']);
      const bathrooms = parseNumber(csvProp['bathrooms']);
      const squareFeet = parseNumber(csvProp['livingArea']);
      const yearBuilt = parseNumber(csvProp['yearBuilt']);
      const downPaymentAmount = parseNumber(csvProp['down payment amount']);
      const interestRate = parseNumber(csvProp['Interest rate']);
      const monthlyPayment = parseNumber(csvProp['Monthly payment']);
      const balloonYears = parseNumber(csvProp['Balloon']);

      // Determine term years based on price
      const getDefaultTermYears = (listPrice: number): number => {
        if (listPrice < 150000) return 15;
        if (listPrice < 300000) return 20;
        if (listPrice < 600000) return 25;
        return 30;
      };
      const termYears = getDefaultTermYears(price);

      // Determine property type
      const homeType = (csvProp['homeType'] || 'single').toLowerCase();
      let propertyType = 'single-family';
      if (homeType.includes('condo')) propertyType = 'condo';
      else if (homeType.includes('townhouse')) propertyType = 'townhouse';
      else if (homeType.includes('multi')) propertyType = 'multi-family';

      const propertyData = {
        id: oppId,
        opportunityId: oppId,
        opportunityName: csvProp['Opportunity Name'],
        address: csvProp['Property Address'].trim(),
        city: normalizeCity(csvProp['Property city']),
        state: normalizeState(csvProp['State '] || csvProp['State']),
        zipCode: csvProp['zip code '] || csvProp['zip code'] || '',
        price: price,
        listPrice: price,
        bedrooms: bedrooms,
        beds: bedrooms,
        bathrooms: bathrooms,
        baths: bathrooms,
        squareFeet: squareFeet,
        yearBuilt: yearBuilt || 0,
        lotSize: parseNumber(csvProp['lot sizes']),
        propertyType,
        description: csvProp['description'] || '',
        monthlyPayment: monthlyPayment,
        downPaymentAmount: downPaymentAmount,
        downPaymentPercent: downPaymentAmount && price ? (downPaymentAmount / price) * 100 : 0,
        interestRate: interestRate,
        termYears: termYears,
        balloonYears: balloonYears > 0 ? balloonYears : null,
        balloonPayment: null,
        imageUrls: csvProp['Image link'] ? [csvProp['Image link']] : [],
        source: 'gohighlevel',
        status: 'active',
        isActive: true,
        featured: false,
        priority: 1,
        nearbyCities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dateAdded: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      await db.collection('properties').doc(oppId).set(propertyData);

      console.log(`   ✅ Successfully imported`);
      console.log(`      Address: ${propertyData.address}, ${propertyData.city}, ${propertyData.state}`);
      console.log(`      Price: $${price.toLocaleString()}`);

    } catch (error) {
      console.error(`   ❌ Error importing: ${(error as Error).message}`);
    }
  }

  console.log(`\\n✅ Import complete!\\n`);
}

importProperties().catch(console.error);
