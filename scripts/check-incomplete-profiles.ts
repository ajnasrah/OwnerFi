/**
 * Check for incomplete buyer profiles that would cause them to see no properties
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkIncompleteProfiles() {
  console.log('🔍 Checking for incomplete buyer profiles...\n');

  const buyersSnap = await getDocs(collection(db, 'buyerProfiles'));

  let incomplete = 0;
  let noCities = 0;
  let noBudget = 0;
  let noSearchCriteria = 0;
  const examples: any[] = [];

  buyersSnap.forEach(doc => {
    const data = doc.data();
    const hasCity = data.preferredCity || (data.searchCriteria?.cities && data.searchCriteria.cities.length > 0);
    const hasBudget = (data.maxMonthlyPayment && data.maxMonthlyPayment > 0) ||
                      (data.maxDownPayment && data.maxDownPayment > 0) ||
                      (data.searchCriteria?.maxMonthlyPayment && data.searchCriteria.maxMonthlyPayment > 0);
    const hasSearchCriteria = data.searchCriteria && Object.keys(data.searchCriteria).length > 0;

    if (!hasCity) noCities++;
    if (!hasBudget) noBudget++;
    if (!hasSearchCriteria) noSearchCriteria++;

    if (!hasCity || !hasBudget) {
      incomplete++;
      if (examples.length < 5) {
        examples.push({
          email: data.email,
          phone: data.phone,
          hasCity,
          hasBudget,
          createdAt: data.createdAt
        });
      }
    }
  });

  console.log('📊 Buyer Profile Completeness Stats:');
  console.log(`   Total buyers: ${buyersSnap.size}`);
  console.log(`   Incomplete profiles: ${incomplete} (${Math.round(incomplete/buyersSnap.size*100)}%)`);
  console.log(`   Missing cities: ${noCities}`);
  console.log(`   Missing budget: ${noBudget}`);
  console.log(`   Missing searchCriteria: ${noSearchCriteria}`);

  if (incomplete > 0) {
    console.log(`\n⚠️  ${incomplete} buyers will see NO or INCORRECT properties!`);
    console.log('\nExample incomplete profiles:');
    examples.forEach(ex => {
      console.log(`   ${ex.email || ex.phone || 'Unknown'}`);
      console.log(`      Has city: ${ex.hasCity}, Has budget: ${ex.hasBudget}`);
    });

    console.log('\n💡 RECOMMENDED FIX:');
    console.log('   Add validation in buyer onboarding to require:');
    console.log('   1. At least one city preference');
    console.log('   2. Monthly payment budget OR down payment budget');
    console.log('   3. Redirect incomplete profiles to finish setup');
  } else {
    console.log('\n✅ All buyer profiles are complete!');
  }
}

checkIncompleteProfiles().catch(console.error);
