import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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

const deletedProperties = JSON.parse(
  fs.readFileSync('/Users/abdullahabunasrah/Desktop/ownerfi/deleted-properties-to-restore.json', 'utf-8')
);

async function restoreDeletedProperties() {
  console.log(`\n🔄 Restoring ${deletedProperties.length} accidentally deleted properties...\n`);

  let restored = 0;

  for (const prop of deletedProperties) {
    const opportunityId = prop['Opportunity ID'];
    const address = prop['Property Address'];
    const city = prop['Property city'];
    const state = prop['State '];
    const zipCode = prop['zip code '];
    const price = parseFloat(prop['Price ']) || 0;
    const bedrooms = parseInt(prop['bedrooms']) || 0;
    const bathrooms = parseFloat(prop['bathrooms']) || 0;
    const squareFeet = parseInt(prop['livingArea']) || 0;
    const yearBuilt = parseInt(prop['yearBuilt']) || 0;
    const lotSize = parseInt(prop['lot sizes']) || 0;
    const imageUrl = prop['Image link'];
    const description = prop['description '] || prop['New Description '] || '';
    const balloonYears = parseFloat(prop['Balloon ']) || null;
    const interestRate = parseFloat(prop['Interest rate ']) || 0;
    const downPaymentAmount = parseFloat(prop['down payment amount ']) || 0;
    const downPaymentPercent = parseFloat(prop['down payment %']) || 0;
    const monthlyPayment = parseFloat(prop['Monthly payment']) || 0;

    // Normalize property type
    let propertyType = 'single-family';
    const homeType = (prop['homeType'] || '').toLowerCase();
    if (homeType.includes('condo')) propertyType = 'condo';
    else if (homeType.includes('townhouse')) propertyType = 'townhouse';
    else if (homeType.includes('multi')) propertyType = 'multi-family';

    // Calculate monthly payment if missing
    let calculatedMonthlyPayment = monthlyPayment;
    if (!calculatedMonthlyPayment && interestRate && price) {
      const loanAmount = price - downPaymentAmount;
      const monthlyRate = interestRate / 100 / 12;
      const numPayments = 20 * 12;

      if (monthlyRate > 0) {
        calculatedMonthlyPayment = Math.round(
          loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
          (Math.pow(1 + monthlyRate, numPayments) - 1)
        );
      } else {
        calculatedMonthlyPayment = Math.round(loanAmount / numPayments);
      }
    }

    const propertyData = {
      id: opportunityId,
      opportunityId: opportunityId,
      opportunityName: prop['Opportunity Name'] || address,
      address,
      city,
      state,
      zipCode,
      price,
      listPrice: price,
      bedrooms,
      bathrooms,
      squareFeet,
      yearBuilt,
      lotSize,
      propertyType,
      description,
      monthlyPayment: calculatedMonthlyPayment,
      downPaymentAmount,
      downPaymentPercent: downPaymentPercent || (downPaymentAmount && price ? (downPaymentAmount / price) * 100 : 0),
      interestRate,
      termYears: 20,
      balloonYears: balloonYears > 0 ? balloonYears : null,
      imageUrls: imageUrl ? [imageUrl] : [],
      source: 'gohighlevel',
      status: 'active',
      isActive: true,
      featured: false,
      priority: 1,
      nearbyCities: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    try {
      await db.collection('properties').doc(opportunityId).set(propertyData);
      console.log(`✅ Restored: ${address}, ${city}, ${state} (Opp ID: ${opportunityId})`);
      restored++;
    } catch (error: any) {
      console.error(`❌ Failed to restore ${address}: ${error.message}`);
    }
  }

  console.log(`\n✅ Successfully restored ${restored}/${deletedProperties.length} properties!\n`);
}

restoreDeletedProperties().catch(console.error);
