import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')!,
    })
  });
}

const db = getFirestore();

async function check() {
  // Check recent podcast workflows
  const workflows = await db.collection('podcast_workflow_queue')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  console.log('=== RECENT PODCAST WORKFLOWS ===');
  if (workflows.empty) {
    console.log('No workflows found');
  } else {
    workflows.docs.forEach(doc => {
      const d = doc.data();
      console.log(`\nID: ${doc.id}`);
      console.log(`Status: ${d.status}`);
      console.log(`Episode: ${d.episodeNumber || '?'}`);
      console.log(`Guest: ${d.guestName || 'unknown'}`);
      console.log(`Title: ${d.episodeTitle || 'untitled'}`);
      console.log(`Created: ${new Date(d.createdAt).toISOString()}`);
      if (d.heygenVideoId) console.log(`HeyGen ID: ${d.heygenVideoId}`);
      if (d.error) console.log(`ERROR: ${d.error}`);
    });
  }

  // Check scheduler state
  const state = await db.collection('podcast_scheduler').doc('state').get();
  console.log('\n=== SCHEDULER STATE ===');
  if (!state.exists) {
    console.log('No scheduler state found');
  } else {
    const s = state.data();
    console.log(`Last episode: ${s?.last_episode_number}`);
    console.log(`Total episodes: ${s?.episodes?.length || 0}`);
    console.log(`Recent guests: ${s?.recent_guests?.join(', ') || 'none'}`);
  }
}

check().catch(console.error);
