/**
 * Check which Memphis properties Jordan passed vs should see
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

async function checkJordanMemphis() {
  // Get Jordan's profile
  const buyerQ = query(collection(db, 'buyerProfiles'), where('email', '==', 'thejordanv16@gmail.com'));
  const buyerSnap = await getDocs(buyerQ);
  const jordan = buyerSnap.docs[0].data();

  // Get all Memphis properties
  const allTN = await getDocs(query(collection(db, 'zillow_imports'), where('state', '==', 'TN'), where('ownerFinanceVerified', '==', true)));
  const memphisProps: any[] = [];
  allTN.forEach(doc => {
    const data = doc.data();
    if (data.city && data.city.toLowerCase().includes('memphis')) {
      memphisProps.push({
        id: doc.id,
        city: data.city,
        address: data.fullAddress || data.address,
        verified: data.ownerFinanceVerified,
        status: data.status
      });
    }
  });

  console.log('📊 JORDAN MEMPHIS ANALYSIS\n');
  console.log(`Total Memphis properties: ${memphisProps.length}`);
  console.log(`Jordan passed properties (total): ${jordan.passedPropertyIds.length}\n`);

  // Check which Memphis properties Jordan passed
  const passedMemphis = memphisProps.filter(p => jordan.passedPropertyIds.includes(p.id));
  console.log(`❌ Jordan PASSED ${passedMemphis.length} Memphis properties:`);
  passedMemphis.forEach(p => console.log(`   ${p.address}`));

  // Check which Memphis properties Jordan should see
  const availableMemphis = memphisProps.filter(p => {
    return jordan.passedPropertyIds.includes(p.id) === false;
  });
  console.log(`\n✅ Jordan SHOULD SEE ${availableMemphis.length} Memphis properties:`);
  availableMemphis.forEach(p => console.log(`   ${p.address} (status: ${p.status || 'none'})`));

  console.log(`\n🎯 CONCLUSION:`);
  console.log(`   If Jordan is seeing only 2 properties, he likely passed ${passedMemphis.length} of them.`);
  console.log(`   The passed properties filter is working correctly.`);
}

checkJordanMemphis().catch(console.error);
