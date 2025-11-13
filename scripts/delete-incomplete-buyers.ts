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

async function deleteIncompleteBuyers() {
  console.log('🔍 Finding incomplete buyer accounts...\n');

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

  console.log(`Found ${usersWithoutProfiles.length} incomplete buyers (never logged in, no profile)`);
  console.log('='.repeat(80));

  usersWithoutProfiles.forEach((user, i) => {
    console.log(`${i + 1}. ${user.email} - ${user.name || 'No name'}`);
  });

  console.log('\n🔴 DELETING...');

  const batch = db.batch();
  let deleteCount = 0;

  for (const user of usersWithoutProfiles) {
    // Delete user document
    batch.delete(db.collection('users').doc(user.id));
    deleteCount++;

    // Delete any related data (likedProperties, matches, etc.)
    const likedQuery = await db.collection('likedProperties').where('buyerId', '==', user.id).get();
    likedQuery.docs.forEach(likedDoc => {
      batch.delete(db.collection('likedProperties').doc(likedDoc.id));
    });

    const matchesQuery = await db.collection('propertyBuyerMatches').where('buyerId', '==', user.id).get();
    matchesQuery.docs.forEach(matchDoc => {
      batch.delete(db.collection('propertyBuyerMatches').doc(matchDoc.id));
    });
  }

  await batch.commit();
  console.log(`\n✅ Deleted ${deleteCount} incomplete buyer accounts`);
}

deleteIncompleteBuyers().then(() => process.exit(0)).catch(console.error);
