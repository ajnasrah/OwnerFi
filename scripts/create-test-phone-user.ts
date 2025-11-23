/**
 * Create a test user with the Firebase test phone number
 * So you can test with 555-555-1234 / 123456
 */

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import { hash } from 'bcryptjs';

async function createTestUser() {
  if (!db) {
    console.error('Firebase not initialized');
    process.exit(1);
  }

  const testPhone = '+15555551234';
  const testEmail = 'testphone555@yopmail.com';

  console.log('\n🔧 Creating test user for phone auth testing...\n');

  try {
    // Create test password (old account)
    const hashedPassword = await hash('TestPassword123!', 10);

    const userId = `test_user_${Date.now()}`;

    // Create user document
    await setDoc(doc(db, 'users', userId), {
      email: testEmail,
      name: 'Test Phone User',
      phone: testPhone,
      role: 'buyer',
      password: hashedPassword, // Old account with password
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Test user created!');
    console.log('');
    console.log('📋 Account Details:');
    console.log(`   - ID: ${userId}`);
    console.log(`   - Email: ${testEmail}`);
    console.log(`   - Phone: ${testPhone} (555-555-1234)`);
    console.log(`   - Password: TestPassword123!`);
    console.log(`   - Has Password: YES (old account)`);
    console.log('');
    console.log('🧪 Now you can test migration:');
    console.log('');
    console.log('1. Go to http://localhost:3001/auth');
    console.log('2. Enter phone: 555-555-1234');
    console.log('3. Enter code: 123456');
    console.log(`4. Enter email: ${testEmail}`);
    console.log('5. Complete signup');
    console.log('');
    console.log('Expected:');
    console.log('✅ Old account detected');
    console.log('✅ New phone-only account created');
    console.log('✅ Old account deleted');
    console.log('✅ Signed in to new account');
    console.log('');

  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }

  process.exit(0);
}

createTestUser();
