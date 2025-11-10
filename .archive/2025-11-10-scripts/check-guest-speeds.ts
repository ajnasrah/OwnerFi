import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function checkGuestSpeeds() {
  console.log('🔍 Checking guest profiles in Firestore...\n');

  const guestsSnapshot = await db.collection('podcast_guest_profiles').get();

  console.log(`Found ${guestsSnapshot.size} guests\n`);

  guestsSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`Guest: ${data.name}`);
    console.log(`  ID: ${doc.id}`);
    console.log(`  Scale: ${data.scale || 'NOT SET'}`);
    console.log(`  Voice Speed: ${data.voice_speed || 'NOT SET'}`);
    console.log(`  Avatar: ${data.avatar_id}`);
    console.log('');
  });

  // Check host too
  const hostDoc = await db.collection('podcast_config').doc('host').get();
  if (hostDoc.exists) {
    const hostData = hostDoc.data();
    console.log('Host:');
    console.log(`  Name: ${hostData?.name}`);
    console.log(`  Scale: ${hostData?.scale || 'NOT SET'}`);
    console.log(`  Voice Speed: ${hostData?.voice_speed || 'NOT SET'}`);
  } else {
    console.log('⚠️  Host profile not found in Firestore');
  }
}

checkGuestSpeeds().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
