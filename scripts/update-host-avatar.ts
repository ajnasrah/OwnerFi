// Quick script to update host avatar in Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

// Initialize Firebase
const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

const db = getFirestore(app);

async function main() {
  try {
    console.log('🔧 Updating host avatar...');

    await updateDoc(doc(db, 'podcast_config', 'main'), {
      'host.avatar_id': 'd33fe3abc2914faa88309c3bdb9f47f4',
      'host.avatar_type': 'talking_photo',
      'host.scale': 1.0
    });

    console.log('✅ Host avatar updated successfully!');
    console.log('   Avatar ID: d33fe3abc2914faa88309c3bdb9f47f4');
    console.log('   Type: talking_photo (motion-enabled)');
    console.log('   Scale: 1.0');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
