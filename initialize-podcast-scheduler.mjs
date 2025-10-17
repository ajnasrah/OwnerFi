#!/usr/bin/env node
// Initialize podcast scheduler state in Firestore

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, getDocs, orderBy, query, limit } from 'firebase/firestore';
import { config } from 'dotenv';

config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initializeScheduler() {
  try {
    console.log('🔍 Checking for existing completed podcast workflows...\n');

    // Get all completed workflows to build initial state
    const workflowsQuery = query(
      collection(db, 'podcast_workflow_queue'),
      orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(workflowsQuery);
    const completedWorkflows = snapshot.docs
      .map(doc => doc.data())
      .filter(w => w.status === 'completed');

    console.log(`Found ${completedWorkflows.length} completed workflow(s)\n`);

    // Build episodes array from completed workflows
    const episodes = completedWorkflows.map((workflow, index) => {
      // Try to extract guest ID from guest name
      // Based on the completed workflow: "Sarah Johnson" -> likely "real_estate_agent"
      let guestId = 'real_estate_agent'; // Default fallback

      if (workflow.guestName) {
        const guestName = workflow.guestName.toLowerCase();
        if (guestName.includes('sarah') || guestName.includes('johnson')) {
          guestId = 'real_estate_agent';
        } else if (guestName.includes('mike') || guestName.includes('thompson')) {
          guestId = 'car_salesman';
        } else if (guestName.includes('james') || guestName.includes('chen')) {
          guestId = 'financial_advisor';
        } else if (guestName.includes('alex') || guestName.includes('rivera')) {
          guestId = 'tech_expert';
        } else if (guestName.includes('maria')) {
          guestId = 'fitness_trainer';
        } else if (guestName.includes('smith')) {
          guestId = 'doctor';
        }
      }

      return {
        episode_number: workflow.episodeNumber || (index + 1),
        guest_id: guestId,
        generated_at: new Date(workflow.createdAt).toISOString(),
        video_id: workflow.heygenVideoId || '',
        published: !!workflow.latePostId
      };
    });

    // Get recent guest IDs (last 4)
    const recentGuests = episodes.slice(-4).map(e => e.guest_id);

    // Calculate last episode number
    const lastEpisodeNumber = episodes.length > 0
      ? Math.max(...episodes.map(e => e.episode_number))
      : 0;

    const schedulerState = {
      last_episode_number: lastEpisodeNumber,
      recent_guests: recentGuests,
      episodes: episodes
    };

    console.log('📊 Initializing scheduler state:');
    console.log(`   Last Episode Number: ${schedulerState.last_episode_number}`);
    console.log(`   Total Episodes: ${schedulerState.episodes.length}`);
    console.log(`   Recent Guests: ${schedulerState.recent_guests.join(', ')}`);
    console.log('');

    // Display episodes
    if (schedulerState.episodes.length > 0) {
      console.log('📺 Episodes:');
      schedulerState.episodes.forEach(ep => {
        console.log(`   Episode #${ep.episode_number}`);
        console.log(`      Guest: ${ep.guest_id}`);
        console.log(`      Generated: ${new Date(ep.generated_at).toLocaleString()}`);
        console.log(`      Video ID: ${ep.video_id}`);
        console.log(`      Published: ${ep.published ? 'Yes' : 'No'}`);
        console.log('');
      });
    }

    // Write to Firestore
    console.log('💾 Writing scheduler state to Firestore...');
    await setDoc(doc(db, 'podcast_scheduler', 'state'), schedulerState);

    console.log('✅ Scheduler state initialized successfully!\n');
    console.log('🎯 Next steps:');
    console.log('   - Next episode will be #' + (lastEpisodeNumber + 1));
    console.log('   - Scheduler will avoid recent guests: ' + recentGuests.join(', '));
    console.log('   - Run check-podcast-scheduler.mjs to verify\n');

  } catch (error) {
    console.error('❌ Error initializing scheduler:', error);
    process.exit(1);
  }
}

initializeScheduler().then(() => process.exit(0));
