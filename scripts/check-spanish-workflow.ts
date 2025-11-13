#!/usr/bin/env npx tsx

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function checkWorkflow() {
  const admin = await import('firebase-admin');

  // Initialize Firebase Admin if not already done
  if (!admin.default.apps.length) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount as any),
    });
  }

  const db = admin.default.firestore();

  // Get the latest Spanish workflow
  const snapshot = await db
    .collection('property_videos')
    .where('language', '==', 'es')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('❌ No Spanish workflows found');
    return;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();

  console.log('\n✅ Latest Spanish Workflow:');
  console.log('   Workflow ID:', doc.id);
  console.log('   Language:', data.language);
  console.log('   Property:', data.propertyAddress);
  console.log('   Status:', data.status);
  console.log('   Video Title:', data.videoTitle);
  console.log('\n📝 Script (Spanish):');
  console.log(data.script?.substring(0, 300) + '...');
  console.log('\n🎬 HeyGen Status:', data.heygenStatus || 'pending');
  console.log('   Video ID:', data.heygenVideoId || 'N/A');

  console.log('\n✅ Spanish video is queued for processing!');
  console.log('   Next: HeyGen will callback to webhook when video is ready');
  console.log('   Then: Submagic will add Spanish captions');
  console.log('   Finally: Video will be posted to GetLate queue');
}

checkWorkflow().catch(console.error);
