import { unifiedDb } from '../src/lib/unified-db';

async function fixAccount() {
  const email = 'abdullah@ownerfi.ai';

  console.log(`🔍 Searching for user with email: ${email}`);

  const user = await unifiedDb.users.findByEmail(email);

  if (!user) {
    console.log('❌ No user found with that email');
    return;
  }

  console.log('✅ User found:', {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    hasPassword: !!user.password && user.password.length > 0,
    createdAt: user.createdAt
  });

  console.log('\n🗑️  Deleting this user account...');

  // Delete the user
  await unifiedDb.users.delete(user.id);

  console.log('✅ User deleted successfully!');
  console.log('\nYou can now sign up with this email again.');
}

fixAccount().catch(console.error);
