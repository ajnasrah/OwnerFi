import { unifiedDb } from '../src/lib/unified-db';
import { FirebaseDB } from '../src/lib/firebase-db';

async function makeAdmin(phoneOrEmail: string) {
  try {
    console.log(`Looking for user: ${phoneOrEmail}`);

    let user;

    // Try email first
    if (phoneOrEmail.includes('@')) {
      user = await unifiedDb.users.findByEmail(phoneOrEmail);
    } else {
      // Try phone
      user = await unifiedDb.users.findByPhone(phoneOrEmail);
    }

    if (!user) {
      console.error('User not found');
      return;
    }

    console.log('Found user:', user.email);

    if (user.role === 'admin') {
      console.log('Already admin!');
      return;
    }

    // Update to admin (with automatic buyer profile cleanup)
    await FirebaseDB.changeUserRole(user.id, 'admin', user.role);

    console.log('✅ Made admin successfully!');

  } catch (error) {
    console.error('Error:', error);
  }
}

const input = process.argv[2];
if (!input) {
  console.error('Usage: npx tsx scripts/make-admin-simple.ts <email_or_phone>');
  process.exit(1);
}

makeAdmin(input).then(() => process.exit(0));
