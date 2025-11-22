/**
 * Test improved owner financing filter
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
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

async function improvedFilterTest() {
  console.log('🔍 Testing IMPROVED owner financing filter...\n');

  const q = query(collection(db, 'zillow_imports'), where('ownerFinanceVerified', '==', true));
  const snap = await getDocs(q);
  console.log(`Total verified properties: ${snap.size}\n`);

  const originalKeywords = [
    'owner financ', 'seller financ', 'owner carry', 'seller carry',
    'owner will finance', 'seller will finance', 'creative financing',
    'flexible financing', 'terms available', 'financing available'
  ];

  const expandedKeywords = [
    ...originalKeywords,
    'no banks needed', 'no bank needed', 'ez qual', 'easy qual',
    'special financing', 'owner will carry', 'seller will carry', 'owc',
    'lease to own', 'lease-to-own', 'rent to own', 'rent-to-own',
    'down payment', 'downpayment', 'balloon', 'amortization',
    'interest rate', 'monthly payment', 'terms negotiable',
    'flexible terms', 'no credit check', 'proof of income'
  ];

  let originalPass = 0, originalFail = 0, expandedPass = 0, expandedFail = 0;
  const stillMissing: any[] = [], nowPassing: any[] = [];

  snap.forEach(doc => {
    const data = doc.data();
    const description = (data.description || '').toLowerCase();

    const passesOriginal = originalKeywords.some(k => description.includes(k.toLowerCase()));
    const passesExpanded = expandedKeywords.some(k => description.includes(k.toLowerCase()));

    if (passesOriginal) {
      originalPass++;
    } else {
      originalFail++;
      if (passesExpanded) {
        nowPassing.push({
          id: doc.id,
          address: data.fullAddress || data.address,
          city: data.city,
          state: data.state,
          description: data.description || 'NO DESCRIPTION'
        });
      } else {
        stillMissing.push({
          id: doc.id,
          address: data.fullAddress || data.address,
          city: data.city,
          state: data.state,
          description: data.description || 'NO DESCRIPTION'
        });
      }
    }

    if (passesExpanded) expandedPass++;
    else expandedFail++;
  });

  console.log('📊 ORIGINAL FILTER RESULTS:');
  console.log(`✅ Passed: ${originalPass}`);
  console.log(`❌ Failed: ${originalFail}\n`);

  console.log('📊 EXPANDED FILTER RESULTS:');
  console.log(`✅ Passed: ${expandedPass}`);
  console.log(`❌ Failed: ${expandedFail}\n`);

  console.log('📈 IMPROVEMENT:');
  console.log(`🎉 Additional properties captured: ${nowPassing.length}`);
  console.log(`⚠️  Still missing: ${stillMissing.length}\n`);

  if (nowPassing.length > 0) {
    console.log('🎯 NOW PASSING:\n');
    nowPassing.slice(0, 10).forEach((prop, i) => {
      console.log(`${i + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
      const matched = expandedKeywords.filter(k =>
        prop.description.toLowerCase().includes(k.toLowerCase()) && !originalKeywords.includes(k)
      );
      console.log(`   Matched: ${matched.slice(0, 3).join(', ')}`);
      console.log(`   Description: ${prop.description.substring(0, 150)}...\n`);
    });
    if (nowPassing.length > 10) console.log(`   ... and ${nowPassing.length - 10} more\n`);
  }

  if (stillMissing.length > 0) {
    console.log('🚨 STILL MISSING:\n');
    stillMissing.slice(0, 5).forEach((prop, i) => {
      console.log(`${i + 1}. ${prop.address}`);
      console.log(`   Description: ${prop.description.substring(0, 150)}...\n`);
    });
    if (stillMissing.length > 5) console.log(`   ... and ${stillMissing.length - 5} more\n`);
  }

  console.log('✅ RECOMMENDATION:');
  if (nowPassing.length > 40) console.log('   Expanded filter is MUCH better!');
  else if (nowPassing.length > 10) console.log('   Good improvement.');
  else console.log('   Minimal improvement.');
}

improvedFilterTest().catch(console.error);
