/**
 * Configure individual scale and offset for each podcast guest
 * Each guest avatar sits differently and needs custom positioning
 */

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

// Individual configurations for each guest based on their avatar positioning
const guestConfigs = {
  doctor: {
    // Dr. Sofia - Ann_Doctor_Sitting_public
    scale: 2.8,
    offset: { x: 0, y: 0.2 }  // Perfect - centered
  },
  real_estate_agent: {
    // Zelena - Caroline_Business_Sitting_Front_public
    scale: 2.8,
    offset: { x: 0, y: 0.3 }  // Move DOWN more - head was cut off
  },
  car_salesman: {
    // Colton - Brandon_Business_Sitting_Front_public
    scale: 2.8,
    offset: { x: 0, y: 0.3 }  // Move DOWN more - head was cut off
  },
  financial_advisor: {
    // Henry - Byron_Business_Sitting_Front_public
    scale: 2.8,
    offset: { x: 0, y: 0.25 }  // Estimate - need to test
  },
  tech_expert: {
    // Vince - Vince_standing_businesstraining_front (STANDING)
    scale: 2.0,  // Standing avatar needs less zoom
    offset: { x: 0, y: 0.1 }  // Standing avatars positioned differently
  },
  fitness_trainer: {
    // Oxana - Oxana_sitting_office_front
    scale: 2.8,
    offset: { x: 0, y: 0.25 }  // Estimate - need to test
  }
};

async function configureGuestOffsets() {
  console.log('🔧 Configuring individual scale and offset for each guest...\n');

  for (const [guestId, config] of Object.entries(guestConfigs)) {
    await db.collection('podcast_guest_profiles').doc(guestId).update({
      scale: config.scale,
      offset: config.offset,
      voice_speed: 1.15,
      updatedAt: Date.now()
    });

    console.log(`✅ ${guestId}: scale ${config.scale}, offset (${config.offset.x}, ${config.offset.y})`);
  }

  console.log('\n✅ All guests configured with individual positioning');
  console.log('\n📝 Next: Update API route to use guest.offset from Firestore');
}

configureGuestOffsets().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
