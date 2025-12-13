import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function checkUser() {
  const phone = '9018319661';
  const formats = ['+19018319661', '9018319661', '19018319661', '(901) 831-9661'];

  console.log('Checking for phone formats:', formats);
  console.log('---');

  // Check users collection
  console.log('🔍 Checking USERS collection:');
  let foundInUsers = false;
  for (const format of formats) {
    const docs = await db.collection('users').where('phone', '==', format).get();
    if (!docs.empty) {
      foundInUsers = true;
      docs.forEach(doc => {
        const data = doc.data();
        console.log(`  Found with format "${format}":`, {
          id: doc.id,
          phone: data.phone,
          role: data.role,
          name: data.name,
          email: data.email
        });
      });
    }
  }
  if (!foundInUsers) {
    console.log('  ❌ No users found with this phone!');
  }

  // Check buyerProfiles collection
  console.log('\n🔍 Checking BUYERPROFILES collection:');
  let foundInBuyers = false;
  for (const format of formats) {
    const docs = await db.collection('buyerProfiles').where('phone', '==', format).get();
    if (!docs.empty) {
      foundInBuyers = true;
      docs.forEach(doc => {
        const data = doc.data();
        console.log(`  Found with format "${format}":`, {
          id: doc.id,
          phone: data.phone,
          name: data.name || data.firstName,
          userId: data.userId
        });
      });
    }
  }
  if (!foundInBuyers) {
    console.log('  ❌ No buyerProfiles found with this phone!');
  }

  process.exit(0);
}

checkUser().catch(console.error);
