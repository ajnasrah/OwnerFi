import { unifiedDb } from '../src/lib/unified-db';

(async () => {
  const user = await unifiedDb.users.findByEmail('abdullah@ownerfi.ai');
  if (user) {
    console.log('Account found:');
    console.log('  Email:', user.email);
    console.log('  Phone:', user.phone || 'NO PHONE');
    console.log('  Has Password:', user.password ? 'YES' : 'NO');
    console.log('  Role:', user.role);
  } else {
    console.log('No account found');
  }
  process.exit(0);
})();
