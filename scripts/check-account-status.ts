/**
 * Check Account Status - See if email has password or is phone-only
 */

import { unifiedDb } from '../src/lib/unified-db';

async function checkAccount() {
  const email = process.argv[2];

  if (!email) {
    console.log('Usage: npx tsx scripts/check-account-status.ts <email>');
    process.exit(1);
  }

  console.log(`\n🔍 Checking account status for: ${email}\n`);

  try {
    const user = await unifiedDb.users.findByEmail(email.toLowerCase());

    if (!user) {
      console.log('❌ No account found with this email');
      console.log('\n✅ SAFE TO USE: This email can be used for new signup\n');
      process.exit(0);
    }

    const hasPassword = user.password && user.password.length > 0;

    console.log('📋 Account Found:');
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Name: ${user.name}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Phone: ${user.phone || 'none'}`);
    console.log(`   - Role: ${user.role}`);
    console.log(`   - Has Password: ${hasPassword ? 'YES (old email/password account)' : 'NO (phone-only account)'}`);
    console.log('');

    if (hasPassword) {
      console.log('✅ OLD ACCOUNT - Can use for migration test');
      console.log('   If you sign up with phone auth using this email:');
      console.log('   • Signup will be allowed ✓');
      console.log('   • Old account will be deleted ✓');
      console.log('   • New phone-only account created ✓');
    } else {
      console.log('❌ PHONE-ONLY ACCOUNT - Cannot use for migration test');
      console.log('   This account was already migrated or created with phone auth');
      console.log('   If you try to sign up again:');
      console.log('   • Error: "An account with this email already exists. Please sign in instead."');
      console.log('\n   Use a different email for testing migration!');
      console.log('   Suggested: johndoe@yopmail.com, johnrealtor@yopmail.com');
    }

    console.log('');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

checkAccount();
