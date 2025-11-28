/**
 * Quick script to set isInvestor flag on a buyer profile
 * Usage: npx tsx scripts/set-investor-flag.ts <phone or email>
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function setInvestorFlag(identifier: string) {
  console.log(`\n🔍 Looking for buyer profile with: ${identifier}\n`);

  const buyersRef = db.collection('buyerProfiles');

  // Try phone first
  let snapshot = await buyersRef.where('phone', '==', identifier).get();

  if (snapshot.empty) {
    // Try with +1 prefix
    const normalized = `+1${identifier.replace(/\D/g, '')}`;
    console.log(`   Trying normalized phone: ${normalized}`);
    snapshot = await buyersRef.where('phone', '==', normalized).get();
  }

  if (snapshot.empty) {
    // Try email
    console.log(`   Trying email: ${identifier.toLowerCase()}`);
    snapshot = await buyersRef.where('email', '==', identifier.toLowerCase()).get();
  }

  if (snapshot.empty) {
    console.log('❌ No buyer profile found with that phone or email');

    // List recent profiles to help find the right one
    console.log('\n📋 Recent buyer profiles:');
    const recentProfiles = await buyersRef.orderBy('createdAt', 'desc').limit(5).get();
    recentProfiles.forEach(doc => {
      const d = doc.data();
      console.log(`   - ${d.firstName} ${d.lastName} | ${d.email} | ${d.phone} | isInvestor: ${d.isInvestor}`);
    });

    process.exit(1);
  }

  const doc = snapshot.docs[0];
  const data = doc.data();

  console.log('📋 Found profile:');
  console.log(`   ID: ${doc.id}`);
  console.log(`   Name: ${data.firstName} ${data.lastName}`);
  console.log(`   Email: ${data.email}`);
  console.log(`   Phone: ${data.phone}`);
  console.log(`   Current isInvestor: ${data.isInvestor}`);

  // Update the flag
  await doc.ref.update({
    isInvestor: true,
  });

  console.log('\n✅ Updated isInvestor to TRUE');
  console.log('   User should now see Cash Deals tab after refreshing');
}

const identifier = process.argv[2];
if (!identifier) {
  console.log('Usage: npx tsx scripts/set-investor-flag.ts <phone or email>');
  console.log('\nListing recent buyer profiles...');

  db.collection('buyerProfiles').orderBy('createdAt', 'desc').limit(10).get()
    .then(snapshot => {
      console.log('\n📋 Recent buyer profiles:');
      snapshot.forEach(doc => {
        const d = doc.data();
        console.log(`   - ${d.firstName || '?'} ${d.lastName || '?'} | ${d.email} | ${d.phone} | isInvestor: ${d.isInvestor}`);
      });
      process.exit(0);
    });
} else {
  setInvestorFlag(identifier)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}
