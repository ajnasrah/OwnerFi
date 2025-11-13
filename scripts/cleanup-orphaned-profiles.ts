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

async function cleanupOrphanedProfiles() {
  console.log('🔍 Finding orphaned buyer profiles...\n');

  // Get all users with role buyer
  const usersSnapshot = await db.collection('users').where('role', '==', 'buyer').get();
  const validUserIds = new Set(usersSnapshot.docs.map(doc => doc.id));

  console.log(`Valid buyer users: ${validUserIds.size}`);

  // Get all buyer profiles
  const profilesSnapshot = await db.collection('buyerProfiles').get();
  console.log(`Total buyerProfiles: ${profilesSnapshot.size}`);

  const orphanedProfiles: any[] = [];
  profilesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const userId = data.userId;

    if (!userId || validUserIds.has(userId) === false) {
      orphanedProfiles.push({
        id: doc.id,
        userId: userId || 'NO_USER_ID',
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        city: data.city || data.preferredCity,
        state: data.state || data.preferredState,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
      });
    }
  });

  console.log(`\n📋 ORPHANED PROFILES (${orphanedProfiles.length} total)`);
  console.log('='.repeat(80));

  if (orphanedProfiles.length === 0) {
    console.log('✨ No orphaned profiles found!');
    return;
  }

  orphanedProfiles.forEach((profile, i) => {
    console.log(`\n${i + 1}. ${profile.email || 'No email'}`);
    console.log(`   Profile ID: ${profile.id}`);
    console.log(`   User ID: ${profile.userId}`);
    console.log(`   Name: ${profile.firstName || ''} ${profile.lastName || ''}`);
    console.log(`   Location: ${profile.city || 'N/A'}, ${profile.state || 'N/A'}`);
    console.log(`   Created: ${profile.createdAt}`);
  });

  console.log('\n🔴 DELETING ORPHANED PROFILES...');

  const batch = db.batch();

  for (const profile of orphanedProfiles) {
    // Delete the orphaned profile
    batch.delete(db.collection('buyerProfiles').doc(profile.id));

    // Clean up any related data
    const likedQuery = await db.collection('likedProperties').where('buyerId', '==', profile.id).get();
    likedQuery.docs.forEach(likedDoc => {
      batch.delete(db.collection('likedProperties').doc(likedDoc.id));
    });

    const matchesQuery = await db.collection('propertyBuyerMatches').where('buyerId', '==', profile.id).get();
    matchesQuery.docs.forEach(matchDoc => {
      batch.delete(db.collection('propertyBuyerMatches').doc(matchDoc.id));
    });
  }

  await batch.commit();
  console.log(`\n✅ Deleted ${orphanedProfiles.length} orphaned profiles and related data`);
}

cleanupOrphanedProfiles().then(() => process.exit(0)).catch(console.error);
