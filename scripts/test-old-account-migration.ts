/**
 * Test Script: Old Account Migration Flow
 *
 * This script:
 * 1. Finds existing old email/password accounts
 * 2. Shows their details
 * 3. Helps test the migration flow
 */

import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

async function findOldAccounts() {
  if (!db) {
    console.error('❌ Firebase not initialized');
    process.exit(1);
  }

  console.log('\n🔍 Searching for old email/password accounts...\n');

  try {
    // Find users with passwords (old accounts)
    const usersRef = collection(db, 'users');
    const usersQuery = query(
      usersRef,
      orderBy('createdAt', 'desc')
    );

    const userDocs = await getDocs(usersQuery);

    const oldAccounts: Array<{
      id: string;
      email: string;
      name: string;
      phone: string;
      role: string;
      hasPassword: boolean;
      createdAt: any;
    }> = [];

    userDocs.forEach(doc => {
      const data = doc.data();

      // Check if has password (old account)
      if (data.password && data.password.length > 0) {
        oldAccounts.push({
          id: doc.id,
          email: data.email || 'no-email',
          name: data.name || 'no-name',
          phone: data.phone || 'no-phone',
          role: data.role || 'unknown',
          hasPassword: true,
          createdAt: data.createdAt
        });
      }
    });

    if (oldAccounts.length === 0) {
      console.log('❌ No old email/password accounts found in database');
      console.log('ℹ️  You need to create an old account first to test migration');
      console.log('\n📝 To create a test account, use the old signup API:');
      console.log('   POST /api/auth/signup');
      console.log('   Body: { email, password, firstName, lastName, role: "buyer" }\n');
      return;
    }

    console.log(`✅ Found ${oldAccounts.length} old email/password account(s):\n`);

    oldAccounts.forEach((account, index) => {
      console.log(`${index + 1}. Account ID: ${account.id}`);
      console.log(`   Email: ${account.email}`);
      console.log(`   Name: ${account.name}`);
      console.log(`   Phone: ${account.phone}`);
      console.log(`   Role: ${account.role}`);
      console.log(`   Has Password: ✓ YES (old account)`);
      console.log(`   Created: ${account.createdAt?.toDate?.() || 'unknown'}`);
      console.log('');
    });

    console.log('\n🧪 TO TEST MIGRATION:\n');
    console.log('1. Go to http://localhost:3001/auth');
    console.log('2. Enter a phone number and verify the SMS code');
    console.log(`3. Use one of the emails above (e.g., ${oldAccounts[0].email})`);
    console.log('4. Complete the signup form');
    console.log('5. Check console logs for migration messages');
    console.log('6. Run this script again to verify old account was deleted\n');

    console.log('📊 WHAT SHOULD HAPPEN:\n');
    console.log('• New phone-only account created with the email');
    console.log('• You\'re signed in to the new account');
    console.log('• Old account gets deleted automatically');
    console.log('• Console shows: 🔄 [SIGNUP-PHONE] and 🗑️ [CLEANUP-OLD-ACCOUNT]\n');

  } catch (error) {
    console.error('❌ Error finding old accounts:', error);
  }
}

// Run the script
findOldAccounts().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});
