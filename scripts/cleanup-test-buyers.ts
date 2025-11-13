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

const TEST_EMAIL_PATTERNS = [
  /test\d+.*@/i,
  /buyer\d+.*@test/i,
  /@test\.com$/i,
  /@example\.com$/i,
  /finaltest/i,
  /abdul@exp/i,
  /abdi@exp/i,
  /tersf@/i,
  /@adfda\.com$/i,
  /abdullah.*@expes/i,
];

function isTestAccount(email: string): boolean {
  return TEST_EMAIL_PATTERNS.some(pattern => pattern.test(email));
}

async function cleanupTestBuyers(dryRun = true) {
  console.log('🔍 Scanning for test buyer accounts...\n');
  console.log('Project:', process.env.FIREBASE_PROJECT_ID);
  console.log('Mode:', dryRun ? '🔵 DRY RUN (no changes)' : '🔴 LIVE MODE (will delete)');
  console.log('='.repeat(60));

  // Get all users with role buyer
  const usersSnapshot = await db.collection('users').where('role', '==', 'buyer').get();
  console.log(`\nTotal buyers: ${usersSnapshot.size}`);

  // Get all buyer profiles
  const profilesSnapshot = await db.collection('buyerProfiles').get();
  const profileUserIds = new Set();
  profilesSnapshot.docs.forEach(doc => {
    const userId = doc.data().userId;
    if (userId) profileUserIds.add(userId);
  });

  const testAccountsWithProfile: any[] = [];
  const testAccountsWithoutProfile: any[] = [];
  const realAccountsWithoutProfile: any[] = [];

  usersSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const email = data.email || '';
    const hasProfile = profileUserIds.has(doc.id);
    const isTest = isTestAccount(email);

    const account = {
      id: doc.id,
      email,
      createdAt: data.createdAt,
      hasProfile
    };

    if (isTest && hasProfile) {
      testAccountsWithProfile.push(account);
    } else if (isTest && !hasProfile) {
      testAccountsWithoutProfile.push(account);
    } else if (!isTest && !hasProfile) {
      realAccountsWithoutProfile.push(account);
    }
  });

  const totalTestAccounts = testAccountsWithProfile.length + testAccountsWithoutProfile.length;

  console.log('\n📊 ANALYSIS:');
  console.log('='.repeat(60));
  console.log(`✅ Test accounts WITH profiles: ${testAccountsWithProfile.length}`);
  console.log(`⚠️  Test accounts WITHOUT profiles: ${testAccountsWithoutProfile.length}`);
  console.log(`🚨 REAL accounts WITHOUT profiles: ${realAccountsWithoutProfile.length}`);
  console.log(`🧹 Total test accounts to delete: ${totalTestAccounts}`);

  if (realAccountsWithoutProfile.length > 0) {
    console.log('\n⚠️  WARNING: Found REAL accounts without profiles:');
    realAccountsWithoutProfile.forEach(acc => {
      console.log(`   - ${acc.email} (created: ${acc.createdAt?.toDate?.()})`);
    });
  }

  if (totalTestAccounts === 0) {
    console.log('\n✨ No test accounts found!');
    return;
  }

  console.log('\n📋 Test accounts to delete:');
  console.log('-'.repeat(60));

  [...testAccountsWithProfile, ...testAccountsWithoutProfile].forEach(acc => {
    console.log(`   ${acc.hasProfile ? '✓' : '✗'} ${acc.email}`);
  });

  if (dryRun) {
    console.log('\n🔵 DRY RUN MODE - No changes made');
    console.log('   Run with --execute flag to actually delete these accounts');
    return;
  }

  // DELETE MODE
  console.log('\n🔴 DELETING TEST ACCOUNTS...');

  const batch = db.batch();
  let deleteCount = 0;

  for (const account of [...testAccountsWithProfile, ...testAccountsWithoutProfile]) {
    // Delete user document
    batch.delete(db.collection('users').doc(account.id));
    deleteCount++;

    // Delete buyer profile if exists
    const profilesQuery = await db.collection('buyerProfiles').where('userId', '==', account.id).get();
    profilesQuery.docs.forEach(profileDoc => {
      batch.delete(db.collection('buyerProfiles').doc(profileDoc.id));
    });

    // Delete liked properties
    const likedQuery = await db.collection('likedProperties').where('buyerId', '==', account.id).get();
    likedQuery.docs.forEach(likedDoc => {
      batch.delete(db.collection('likedProperties').doc(likedDoc.id));
    });

    // Delete property matches
    const matchesQuery = await db.collection('propertyBuyerMatches').where('buyerId', '==', account.id).get();
    matchesQuery.docs.forEach(matchDoc => {
      batch.delete(db.collection('propertyBuyerMatches').doc(matchDoc.id));
    });
  }

  await batch.commit();
  console.log(`\n✅ Deleted ${deleteCount} test accounts and all related data`);
}

// Check command line args
const args = process.argv.slice(2);
const executeMode = args.includes('--execute');

cleanupTestBuyers(!executeMode)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
