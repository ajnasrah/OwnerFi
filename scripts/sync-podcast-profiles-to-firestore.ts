/**
 * Sync podcast profiles from JSON to Firestore
 * This ensures all guest and host profiles are in the database with correct settings
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

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

async function syncProfiles() {
  console.log('🔄 Syncing podcast profiles to Firestore...\n');

  // Load profiles from JSON
  const configPath = join(process.cwd(), 'podcast', 'config', 'guest-profiles.json');
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));

  // Sync each guest
  const guests = Object.values(config.profiles) as any[];

  for (const guest of guests) {
    console.log(`📝 Syncing guest: ${guest.name} (${guest.id})`);

    // Set voice_speed to 1.15 and scale to 2.8 for all guests
    const guestData = {
      ...guest,
      scale: 2.8,         // FORCE all guests to 2.8 (fills vertical frame)
      voice_speed: 1.15,  // FORCE all guests to 1.15
      updatedAt: Date.now()
    };

    await db.collection('podcast_guest_profiles').doc(guest.id).set(guestData);

    console.log(`  ✅ Scale: ${guestData.scale}, Voice Speed: ${guestData.voice_speed}`);
  }

  // Sync host
  console.log(`\n📝 Syncing host: ${config.host.name}`);

  const hostData = {
    ...config.host,
    voice_speed: 1.0,  // Host at normal speed
    updatedAt: Date.now()
  };

  await db.collection('podcast_config').doc('host').set(hostData);
  console.log(`  ✅ Scale: ${hostData.scale}, Voice Speed: ${hostData.voice_speed || 1.0}`);

  console.log(`\n✅ Synced ${guests.length} guests + 1 host to Firestore`);
  console.log('\n🎯 All guests now have voice_speed = 1.15');
}

syncProfiles().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
