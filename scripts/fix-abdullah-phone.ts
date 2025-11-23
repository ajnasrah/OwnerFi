import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

async function fixPhone() {
  if (!db) {
    console.error('Firebase not initialized');
    process.exit(1);
  }

  const userId = 'eVXYF6XVlBMp3rlKTgApjXqQNOY2'; // Your user ID

  console.log('Updating phone format for abdullah@ownerfi.ai...');

  await updateDoc(doc(db, 'users', userId), {
    phone: '+19018319661' // E.164 format
  });

  console.log('✅ Phone updated to: +19018319661');
  console.log('\nNow try signing in with: 901-831-9661');

  process.exit(0);
}

fixPhone();
