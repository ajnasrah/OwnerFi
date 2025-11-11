#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

// Import after env is loaded
const { getAdminDb } = require('../src/lib/firebase-admin');

async function checkUpcomingPosts() {
  const db = await getAdminDb();
  if (!db) {
    console.error('Failed to initialize Firebase Admin');
    return;
  }

  const now = Date.now();
  const in24Hours = now + (24 * 60 * 60 * 1000);

  console.log('Checking for posts scheduled in the next 24 hours...\n');
  console.log('Current time:', new Date(now).toISOString());
  console.log('24 hours from now:', new Date(in24Hours).toISOString());
  console.log('─'.repeat(80));

  const collections = [
    'carz_workflow_queue',
    'ownerfi_workflow_queue',
    'podcast_workflow_queue',
    'vassdistro_workflow_queue',
    'abdullah_workflow_queue'
  ];

  for (const collection of collections) {
    const snap = await (db as any).collection(collection)
      .where('status', '==', 'completed')
      .where('scheduledTime', '>=', new Date(now).toISOString())
      .where('scheduledTime', '<=', new Date(in24Hours).toISOString())
      .get();

    if (!snap.empty) {
      console.log(`\n${collection}:`);
      snap.forEach((doc: any) => {
        const data = doc.data();
        const scheduledTime = new Date(data.scheduledTime);
        const minutesUntil = Math.round((scheduledTime.getTime() - now) / (1000 * 60));

        console.log(`  • ${doc.id}`);
        console.log(`    Scheduled: ${scheduledTime.toLocaleString()}`);
        console.log(`    Time until post: ${minutesUntil} minutes`);
        console.log(`    Late Post ID: ${data.latePostId || 'N/A'}`);
        console.log(`    Status: ${data.status}`);
      });
    }
  }

  // Also check for posts that are already "posted" to see if they have analytics
  console.log('\n' + '─'.repeat(80));
  console.log('\nChecking recently posted content for analytics...\n');

  const oneDayAgo = now - (24 * 60 * 60 * 1000);

  for (const collection of collections) {
    const snap = await (db as any).collection(collection)
      .where('status', '==', 'completed')
      .where('completedAt', '>=', oneDayAgo)
      .limit(5)
      .get();

    if (!snap.empty) {
      console.log(`\n${collection} (recently completed):`);

      for (const doc of snap.docs) {
        const data = doc.data();

        if (data.latePostId) {
          console.log(`\n  • ${doc.id}`);
          console.log(`    Late Post ID: ${data.latePostId}`);
          console.log(`    Completed: ${data.completedAt ? new Date(data.completedAt).toLocaleString() : 'N/A'}`);

          // Check Late API for this post
          const LATE_API_KEY = process.env.LATE_API_KEY;
          try {
            const response = await fetch(`https://getlate.dev/api/v1/posts/${data.latePostId}`, {
              headers: {
                'Authorization': `Bearer ${LATE_API_KEY}`,
                'Content-Type': 'application/json'
              }
            });

            if (response.ok) {
              const lateData = await response.json();
              const post = lateData.post;

              console.log(`    Late Status: ${post.status}`);
              console.log(`    Total Views: ${post.analytics?.views || 0}`);
              console.log(`    Total Likes: ${post.analytics?.likes || 0}`);
              console.log(`    Total Comments: ${post.analytics?.comments || 0}`);

              if (post.platforms) {
                console.log(`    Platform breakdown:`);
                post.platforms.forEach((p: any) => {
                  const analytics = p.analytics || {};
                  console.log(`      - ${p.platform}: ${analytics.views || 0} views, ${p.status}`);
                });
              }
            }
          } catch (error) {
            console.log(`    Error fetching from Late API`);
          }
        }
      }
    }
  }
}

checkUpcomingPosts().catch(console.error);
