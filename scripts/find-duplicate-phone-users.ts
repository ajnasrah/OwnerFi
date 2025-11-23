/**
 * Find ALL users with duplicate phone numbers
 * This will show us the scope of the problem
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
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

async function findDuplicatePhoneUsers() {
  console.log('🔍 Finding duplicate phone numbers in users collection...\n');

  const usersSnapshot = await db.collection('users').get();

  // Group users by phone number
  const phoneMap = new Map<string, any[]>();

  usersSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.phone) {
      const phone = data.phone;
      if (!phoneMap.has(phone)) {
        phoneMap.set(phone, []);
      }
      phoneMap.get(phone)!.push({
        id: doc.id,
        email: data.email,
        role: data.role,
        hasPassword: !!data.password,
        createdAt: data.createdAt?.toDate() || 'unknown'
      });
    }
  });

  // Find duplicates
  let duplicateCount = 0;
  const duplicates: Array<{ phone: string; users: any[] }> = [];

  phoneMap.forEach((users, phone) => {
    if (users.length > 1) {
      duplicateCount++;
      duplicates.push({ phone, users });
    }
  });

  if (duplicateCount === 0) {
    console.log('✅ No duplicate phone numbers found!\n');
    process.exit(0);
  }

  console.log(`❌ Found ${duplicateCount} phone numbers with multiple users:\n`);
  console.log('='.repeat(80));

  duplicates.forEach(({ phone, users }) => {
    console.log(`\n📱 Phone: ${phone} (${users.length} users)`);
    users.forEach((user, i) => {
      console.log(`  ${i + 1}. User ID: ${user.id}`);
      console.log(`     Email: ${user.email}`);
      console.log(`     Role: ${user.role}`);
      console.log(`     Has password: ${user.hasPassword}`);
      console.log(`     Created: ${user.createdAt}`);
    });
  });

  console.log('\n' + '='.repeat(80));
  console.log(`\n🔍 ANALYSIS:`);
  console.log(`Total duplicate phone numbers: ${duplicateCount}`);
  console.log(`Total affected user accounts: ${duplicates.reduce((sum, d) => sum + d.users.length, 0)}`);

  console.log('\n💡 ROOT CAUSE:');
  console.log('The system is creating NEW user accounts instead of using existing ones.');
  console.log('This happens when:');
  console.log('1. User signs up with email/password → creates user A');
  console.log('2. Same user signs up with phone auth → creates user B (NEW account)');
  console.log('3. Now they have 2 accounts with same phone number\n');

  process.exit(0);
}

findDuplicatePhoneUsers().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
