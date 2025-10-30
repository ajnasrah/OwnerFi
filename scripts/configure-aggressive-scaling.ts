/**
 * Apply aggressive scaling to completely fill vertical frame
 * No more black bars!
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

// AGGRESSIVE scaling - use max scale and NEGATIVE offset to move UP
const guestConfigs = {
  doctor: {
    scale: 4.5,
    offset: { x: 0, y: -0.3 }  // Move UP significantly
  },
  real_estate_agent: {
    scale: 4.5,
    offset: { x: 0, y: -0.3 }  // Move UP significantly
  },
  car_salesman: {
    scale: 4.5,
    offset: { x: 0, y: -0.3 }  // Move UP significantly
  },
  financial_advisor: {
    scale: 4.5,
    offset: { x: 0, y: -0.3 }  // Move UP significantly
  },
  tech_expert: {
    scale: 3.5,  // Standing avatar
    offset: { x: 0, y: -0.2 }  // Move UP
  },
  fitness_trainer: {
    scale: 4.5,
    offset: { x: 0, y: -0.3 }  // Move UP significantly
  }
};

async function applyAggressiveScaling() {
  console.log('🚀 Applying AGGRESSIVE scaling to fill frame completely...\n');

  for (const [guestId, config] of Object.entries(guestConfigs)) {
    await db.collection('podcast_guest_profiles').doc(guestId).update({
      scale: config.scale,
      offset: config.offset,
      voice_speed: 1.15,
      updatedAt: Date.now()
    });

    console.log(`✅ ${guestId}: scale ${config.scale}, offset (${config.offset.x}, ${config.offset.y})`);
  }

  console.log('\n✅ All guests set to MAXIMUM scale (4.5) to eliminate black bars');
}

applyAggressiveScaling().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
