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

async function updateAvatars() {
  console.log('🔄 Updating Vince and Oxana avatars...\n');

  // Update Vince to STANDING version
  await db.collection('podcast_guest_profiles').doc('tech_expert').update({
    avatar_id: 'Vince_standing_businesstraining_front',
    scale: 2.8,
    voice_speed: 1.15,
    updatedAt: Date.now()
  });
  console.log('✅ Vince updated: Vince_standing_businesstraining_front (scale 2.8)');

  // Update Oxana to Office Front
  await db.collection('podcast_guest_profiles').doc('fitness_trainer').update({
    avatar_id: 'Oxana_sitting_office_front',
    scale: 2.8,
    voice_speed: 1.15,
    updatedAt: Date.now()
  });
  console.log('✅ Oxana updated: Oxana_sitting_office_front (scale 2.8)');

  console.log('\n✅ Both avatars updated with scale 2.8 and speed 1.15');
}

updateAvatars().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
