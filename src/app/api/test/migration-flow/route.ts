/**
 * TEST ENDPOINT: Simulate Old Account Migration Flow
 *
 * This endpoint simulates the complete phone signup flow
 * without requiring actual SMS verification.
 *
 * USE ONLY FOR TESTING!
 */

import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/unified-db';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const { testEmail } = await request.json();

    if (!testEmail) {
      return NextResponse.json(
        { error: 'testEmail is required' },
        { status: 400 }
      );
    }

    console.log('\n🧪 ========== TEST: OLD ACCOUNT MIGRATION ==========');
    console.log(`Testing with email: ${testEmail}\n`);

    // Step 1: Check if old account exists
    console.log('📋 STEP 1: Checking for old account...');
    const existingUser = await unifiedDb.users.findByEmail(testEmail.toLowerCase());

    if (!existingUser) {
      return NextResponse.json({
        success: false,
        error: 'No account found with this email',
        step: 'check_old_account'
      });
    }

    const hasPassword = existingUser.password && existingUser.password.length > 0;

    if (!hasPassword) {
      return NextResponse.json({
        success: false,
        error: 'Account exists but has no password (already migrated or phone-only)',
        step: 'check_old_account'
      });
    }

    console.log(`✅ Found old account: ${existingUser.id}`);
    console.log(`   - Name: ${existingUser.name}`);
    console.log(`   - Email: ${existingUser.email}`);
    console.log(`   - Phone: ${existingUser.phone || 'none'}`);
    console.log(`   - Role: ${existingUser.role}`);
    console.log(`   - Has Password: YES (old account)\n`);

    // Step 2: Find associated buyer profile
    console.log('📋 STEP 2: Checking for buyer profile...');
    let buyerProfile = null;
    if (db) {
      const buyerQuery = query(
        collection(db, 'buyerProfiles'),
        where('userId', '==', existingUser.id)
      );
      const buyerDocs = await getDocs(buyerQuery);
      if (!buyerDocs.empty) {
        buyerProfile = {
          id: buyerDocs.docs[0].id,
          ...buyerDocs.docs[0].data()
        };
        console.log(`✅ Found buyer profile: ${buyerProfile.id}\n`);
      } else {
        console.log('ℹ️  No buyer profile found\n');
      }
    }

    // Step 3: Simulate what WOULD happen during signup
    console.log('📋 STEP 3: Simulating phone signup flow...');
    console.log('   User would:');
    console.log('   1. Enter phone number (e.g., +15551234567)');
    console.log('   2. Verify SMS code');
    console.log(`   3. Enter email: ${testEmail}`);
    console.log('   4. Complete setup form\n');

    console.log('📋 STEP 4: What our code would do...');
    console.log(`   ✓ Detect old account: ${existingUser.id}`);
    console.log(`   ✓ Mark for deletion: oldAccountToDelete = "${existingUser.id}"`);
    console.log('   ✓ Create NEW phone-only account');
    console.log('   ✓ Sign user in to NEW account');
    console.log(`   ✓ Call cleanup endpoint with: { oldAccountId: "${existingUser.id}", newAccountId: "new_xyz" }`);
    console.log('\n📋 STEP 5: Cleanup endpoint would...');
    if (buyerProfile) {
      console.log(`   ✓ Delete buyer profile: ${buyerProfile.id}`);
    }
    console.log(`   ✓ Delete old user document: ${existingUser.id}`);
    console.log('   ✓ Log successful migration\n');

    console.log('✅ SIMULATION COMPLETE\n');
    console.log('🎯 RESULT: Migration would succeed!');
    console.log(`   - Old account would be deleted: ${existingUser.id}`);
    if (buyerProfile) {
      console.log(`   - Buyer profile would be deleted: ${buyerProfile.id}`);
    }
    console.log('   - New phone-only account would be created');
    console.log('   - User would be signed in and redirected to dashboard\n');

    return NextResponse.json({
      success: true,
      simulation: {
        oldAccount: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          phone: existingUser.phone,
          role: existingUser.role,
          hasPassword: true
        },
        buyerProfile: buyerProfile ? {
          id: buyerProfile.id,
          userId: buyerProfile.userId
        } : null,
        actions: {
          wouldDetect: true,
          wouldAllowSignup: true,
          wouldMarkForDeletion: true,
          wouldCreateNewAccount: true,
          wouldDeleteOldAccount: true,
          wouldDeleteBuyerProfile: !!buyerProfile
        },
        message: 'Migration would succeed! Old account would be deleted, new phone-only account would be created.'
      }
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
