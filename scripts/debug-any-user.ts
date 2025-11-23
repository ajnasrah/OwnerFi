/**
 * Debug ANY user signin issue
 * Usage: npx tsx scripts/debug-any-user.ts <phone or email>
 */

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

const identifier = process.argv[2];

if (!identifier) {
  console.log('Usage: npx tsx scripts/debug-any-user.ts <phone or email>');
  console.log('Example: npx tsx scripts/debug-any-user.ts 9018319661');
  console.log('Example: npx tsx scripts/debug-any-user.ts test@email.com');
  process.exit(1);
}

async function debugUser(id: string) {
  console.log(`\n🔍 Debugging user: ${id}\n`);

  // Determine if email or phone
  const isEmail = id.includes('@');
  const isPhone = !isEmail;

  let userDoc: any = null;
  let searchField = '';

  if (isEmail) {
    const snapshot = await db.collection('users').where('email', '==', id.toLowerCase()).get();
    if (!snapshot.empty) {
      userDoc = snapshot.docs[0];
      searchField = 'email';
    }
  } else {
    // Try phone formats
    const cleaned = id.replace(/\D/g, '');
    const last10 = cleaned.slice(-10);
    const formats = [id, last10, `+1${last10}`, `(${last10.slice(0,3)}) ${last10.slice(3,6)}-${last10.slice(6)}`];

    for (const fmt of formats) {
      const snapshot = await db.collection('users').where('phone', '==', fmt).get();
      if (!snapshot.empty) {
        userDoc = snapshot.docs[0];
        searchField = `phone (${fmt})`;
        break;
      }
    }
  }

  if (!userDoc) {
    console.log('❌ USER NOT FOUND');
    console.log('\n⚠️  ISSUE: User does not exist in database');
    console.log('FIX: They need to sign up first at /auth/setup\n');
    process.exit(0);
  }

  const userData = userDoc.data();
  console.log('✅ USER FOUND:');
  console.log(`  Search: ${searchField}`);
  console.log(`  ID: ${userDoc.id}`);
  console.log(`  Email: ${userData.email}`);
  console.log(`  Phone: ${userData.phone || 'none'}`);
  console.log(`  Role: ${userData.role}`);
  console.log(`  Has password: ${!!userData.password}`);

  // Find buyer profile
  console.log('\n🔍 Checking buyer profile...');

  let buyerSnapshot = await db.collection('buyerProfiles').where('userId', '==', userDoc.id).get();

  if (buyerSnapshot.empty && userData.phone) {
    const cleaned = userData.phone.replace(/\D/g, '');
    const last10 = cleaned.slice(-10);
    const formats = [userData.phone, last10, `+1${last10}`];

    for (const fmt of formats) {
      buyerSnapshot = await db.collection('buyerProfiles').where('phone', '==', fmt).get();
      if (!buyerSnapshot.empty) break;
    }
  }

  if (buyerSnapshot.empty) {
    console.log('❌ NO BUYER PROFILE FOUND');
    console.log('\n⚠️  ISSUE: This is why they get redirected to /auth/setup');
    console.log('FIX: Create buyer profile for this user\n');

    console.log('Run this to fix:');
    console.log(`  1. User signs in`);
    console.log(`  2. Goes to /auth/setup`);
    console.log(`  3. Fills out profile`);
    console.log(`  4. Or run: npx tsx scripts/create-buyer-profile.ts ${userDoc.id}\n`);
    process.exit(0);
  }

  const buyerData = buyerSnapshot.docs[0].data();
  console.log('✅ BUYER PROFILE FOUND:');
  console.log(`  ID: ${buyerSnapshot.docs[0].id}`);
  console.log(`  User ID: ${buyerData.userId}`);
  console.log(`  Phone: ${buyerData.phone}`);
  console.log(`  City: ${buyerData.preferredCity || buyerData.city || 'none'}`);
  console.log(`  Profile complete: ${buyerData.profileComplete}`);

  // Check for mismatches
  console.log('\n🔍 Checking for issues...');

  let issues = [];

  if (buyerData.userId !== userDoc.id) {
    issues.push(`⚠️  userId MISMATCH: buyer profile has ${buyerData.userId}, user is ${userDoc.id}`);
  }

  if (!buyerData.preferredCity && !buyerData.city) {
    issues.push('⚠️  No city set - user might have incomplete profile');
  }

  if (buyerData.profileComplete === false) {
    issues.push('⚠️  profileComplete is false - might trigger redirects');
  }

  if (issues.length > 0) {
    console.log('\n❌ ISSUES FOUND:');
    issues.forEach(issue => console.log(`  ${issue}`));
    console.log('\nThese issues may cause signin problems.\n');
  } else {
    console.log('✅ No issues found - signin should work!\n');
  }

  process.exit(0);
}

debugUser(identifier).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
