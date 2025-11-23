import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')!,
    }),
  });
}

const db = getFirestore();

async function checkPhoneFormats() {
  console.log('\n🔍 Checking phone number formats in database...\n');

  // Search for various formats of the phone number 9018319661
  const searchNumbers = [
    '9018319661',
    '+19018319661',
    '+1 901 831 9661',
    '901-831-9661',
    '(901) 831-9661',
    '1-901-831-9661'
  ];

  for (const phoneNum of searchNumbers) {
    const usersRef = db.collection('users');
    const query = usersRef.where('phone', '==', phoneNum);
    const snapshot = await query.get();

    if (!snapshot.empty) {
      console.log(`✅ FOUND with format: "${phoneNum}"`);
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   User ID: ${doc.id}`);
        console.log(`   Name: ${data.firstName} ${data.lastName}`);
        console.log(`   Email: ${data.email}`);
        console.log(`   Role: ${data.role}`);
        console.log(`   Phone stored as: "${data.phone}"`);
      });
      console.log('');
    } else {
      console.log(`❌ Not found with format: "${phoneNum}"`);
    }
  }

  // Also check all users to see what phone formats exist
  console.log('\n📋 All users with phone numbers:\n');
  const allUsersSnapshot = await db.collection('users')
    .where('phone', '!=', null)
    .limit(20)
    .get();

  allUsersSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`User: ${data.firstName} ${data.lastName}`);
    console.log(`  Phone: "${data.phone}"`);
    console.log(`  Email: ${data.email}`);
    console.log(`  Role: ${data.role}`);
    console.log('');
  });
}

checkPhoneFormats()
  .then(() => {
    console.log('✅ Phone format check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
