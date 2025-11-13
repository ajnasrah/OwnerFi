import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function showIncompleteProfiles() {
  // Get all users with role buyer
  const usersSnapshot = await db.collection('users').where('role', '==', 'buyer').get();

  // Get all buyer profiles
  const profilesSnapshot = await db.collection('buyerProfiles').get();
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
        name: data.name,
        email: data.email,
        phone: data.phone,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        lastSignIn: data.lastSignIn?.toDate?.() || data.lastSignIn,
      });
    }
  });

  console.log('📋 BUYERS WITHOUT PROFILES (' + usersWithoutProfiles.length + ' total)');
  console.log('='.repeat(80));

  usersWithoutProfiles.forEach((user, i) => {
    console.log(`\n${i + 1}. ${user.name || 'No name'}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Phone: ${user.phone || 'No phone'}`);
    console.log(`   Created: ${user.createdAt}`);
    console.log(`   Last Login: ${user.lastSignIn || 'Never'}`);
  });
}

showIncompleteProfiles().then(() => process.exit(0)).catch(console.error);
