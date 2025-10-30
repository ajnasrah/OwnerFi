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

// Balanced scaling - fill frame but show faces
const guestConfigs = {
  doctor: {
    scale: 3.2,
    offset: { x: 0, y: -0.1 }
  },
  real_estate_agent: {
    scale: 3.2,
    offset: { x: 0, y: -0.1 }
  },
  car_salesman: {
    scale: 3.2,
    offset: { x: 0, y: -0.1 }
  },
  financial_advisor: {
    scale: 3.2,
    offset: { x: 0, y: -0.1 }
  },
  tech_expert: {
    scale: 2.5,  // Standing avatar needs less
    offset: { x: 0, y: -0.05 }
  },
  fitness_trainer: {
    scale: 3.2,
    offset: { x: 0, y: -0.1 }
  }
};

async function applyAggressiveScaling() {
  console.log('🎯 Applying balanced scaling (3.2) to fill frame and show faces...\n');

  for (const [guestId, config] of Object.entries(guestConfigs)) {
    await db.collection('podcast_guest_profiles').doc(guestId).update({
      scale: config.scale,
      offset: config.offset,
      voice_speed: 1.15,
      updatedAt: Date.now()
    });

    console.log(`✅ ${guestId}: scale ${config.scale}, offset (${config.offset.x}, ${config.offset.y})`);
  }

  console.log('\n✅ All guests set to balanced scale (3.2) - fills frame while showing faces');
}

applyAggressiveScaling().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
