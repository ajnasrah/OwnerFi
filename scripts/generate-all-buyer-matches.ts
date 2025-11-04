import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

interface PropertyForMatching {
  id: string;
  monthlyPayment: number;
  downPaymentAmount: number;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
}

interface BuyerForMatching {
  id: string;
  userId: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
  preferredCity?: string;
  preferredState?: string;
  city?: string;
  state?: string;
  minBedrooms?: number;
  minBathrooms?: number;
}

function isPropertyMatch(property: PropertyForMatching, buyer: BuyerForMatching): boolean {
  // 1. Monthly Payment Check (CRITICAL)
  if (property.monthlyPayment > buyer.maxMonthlyPayment) {
    return false;
  }

  // 2. Down Payment Check (CRITICAL)
  if (property.downPaymentAmount > buyer.maxDownPayment) {
    return false;
  }

  // 3. Location Check (CRITICAL)
  const buyerCity = (buyer.preferredCity || buyer.city || '').toLowerCase();
  const buyerState = (buyer.preferredState || buyer.state || '').toLowerCase();
  const propertyCity = (property.city || '').toLowerCase();
  const propertyState = (property.state || '').toLowerCase();

  if (buyerCity && buyerState) {
    if (propertyCity !== buyerCity || propertyState !== buyerState) {
      return false;
    }
  }

  // 4. Bedrooms (Optional - if buyer specified)
  if (buyer.minBedrooms && property.bedrooms < buyer.minBedrooms) {
    return false;
  }

  // 5. Bathrooms (Optional - if buyer specified)
  if (buyer.minBathrooms && property.bathrooms < buyer.minBathrooms) {
    return false;
  }

  return true;
}

async function generateAllMatches() {
  console.log('\n🔄 Generating matches for all buyers...\n');

  // Get all buyer profiles
  const buyersSnapshot = await db.collection('buyerProfiles').get();
  console.log(`📊 Found ${buyersSnapshot.size} buyer profiles`);

  // Get all active properties
  const propertiesSnapshot = await db.collection('properties')
    .where('status', '==', 'active')
    .get();
  console.log(`📊 Found ${propertiesSnapshot.size} active properties\n`);

  if (buyersSnapshot.size === 0 || propertiesSnapshot.size === 0) {
    console.log('❌ Cannot generate matches - no buyers or no properties');
    return;
  }

  // Convert to matching format
  const buyers: BuyerForMatching[] = buyersSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      maxMonthlyPayment: data.maxMonthlyPayment || 999999,
      maxDownPayment: data.maxDownPayment || 999999,
      preferredCity: data.preferredCity,
      preferredState: data.preferredState,
      city: data.city,
      state: data.state,
      minBedrooms: data.minBedrooms,
      minBathrooms: data.minBathrooms,
    };
  });

  const properties: PropertyForMatching[] = propertiesSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      monthlyPayment: data.monthlyPayment || 0,
      downPaymentAmount: data.downPaymentAmount || 0,
      city: data.city || '',
      state: data.state || '',
      bedrooms: data.bedrooms || 0,
      bathrooms: data.bathrooms || 0,
    };
  });

  console.log('🔍 Matching buyers to properties...\n');

  let totalMatches = 0;
  const matchesToCreate = [];

  for (const buyer of buyers) {
    let buyerMatches = 0;

    for (const property of properties) {
      if (isPropertyMatch(property, buyer)) {
        matchesToCreate.push({
          propertyId: property.id,
          buyerId: buyer.userId,
          matchedAt: new Date(),
          isActive: true,
          withinBudget: true,
          withinRadius: true,
          meetsRequirements: true,
        });
        buyerMatches++;
      }
    }

    if (buyerMatches > 0) {
      console.log(`✅ Buyer ${buyer.id}: ${buyerMatches} matches`);
      totalMatches += buyerMatches;
    }
  }

  console.log(`\n📊 Total matches to create: ${totalMatches}\n`);

  if (matchesToCreate.length === 0) {
    console.log('⚠️  No matches found. This might be due to strict matching criteria.');
    return;
  }

  // Batch write matches
  console.log('💾 Saving matches to propertyBuyerMatches collection...\n');

  const BATCH_SIZE = 500;
  let saved = 0;

  for (let i = 0; i < matchesToCreate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = matchesToCreate.slice(i, Math.min(i + BATCH_SIZE, matchesToCreate.length));

    for (const match of chunk) {
      const docRef = db.collection('propertyBuyerMatches').doc();
      batch.set(docRef, match);
    }

    await batch.commit();
    saved += chunk.length;
    console.log(`   Saved ${saved}/${matchesToCreate.length} matches...`);
  }

  console.log(`\n✅ Successfully created ${totalMatches} matches!\n`);
}

generateAllMatches().catch(console.error);
