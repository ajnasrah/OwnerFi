import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error('Missing Firebase credentials');
  }

  initializeApp({
    credential: cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    })
  });
}

const db = getFirestore();

async function checkBuyers() {
  console.log('Checking buyers in project:', process.env.FIREBASE_PROJECT_ID);

  // Get all users with role buyer
  const usersSnapshot = await db.collection('users').where('role', '==', 'buyer').get();
  console.log('Total users with role=buyer:', usersSnapshot.size);

  // Get all buyer profiles
  const profilesSnapshot = await db.collection('buyerProfiles').get();
  console.log('Total buyerProfiles:', profilesSnapshot.size);

  // Check which users don't have profiles
  const profileUserIds = new Set();
  profilesSnapshot.docs.forEach(doc => {
    const userId = doc.data().userId;
    if (userId) profileUserIds.add(userId);
  });

  const usersWithoutProfiles: any[] = [];
  usersSnapshot.docs.forEach(doc => {
    if (profileUserIds.has(doc.id) === false) {
      const data = doc.data();
      usersWithoutProfiles.push({
        id: doc.id,
        email: data.email,
        createdAt: data.createdAt
      });
    }
  });

  console.log('\n========================================');
  console.log('ANALYSIS:');
  console.log('========================================');
  console.log('Users WITHOUT profiles:', usersWithoutProfiles.length);
  console.log('Users WITH profiles:', usersSnapshot.size - usersWithoutProfiles.length);
  console.log('This explains why your buyer count is lower in the admin panel!');
  console.log('========================================\n');

  if (usersWithoutProfiles.length > 0) {
    console.log('First 10 users without profiles:');
    usersWithoutProfiles.slice(0, 10).forEach(u => {
      console.log('  -', u.email, '(created:', u.createdAt?.toDate?.() || u.createdAt, ')');
    });
  }
}

checkBuyers().then(() => process.exit(0)).catch(console.error);
