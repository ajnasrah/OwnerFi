#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const { getAdminDb } = require('../src/lib/firebase-admin');

async function checkFirestoreAnalytics() {
  const db = await getAdminDb();
  if (!db) {
    console.error('Failed to initialize Firebase Admin');
    return;
  }

  console.log('Checking workflow_analytics collection...\n');

  try {
    // Get all docs (limited)
    const snap = await (db as any).collection('workflow_analytics').limit(5).get();

    console.log(`Total docs found: ${snap.size}\n`);

    if (snap.empty) {
      console.log('❌ NO ANALYTICS DATA IN FIRESTORE');
      console.log('You need to run the sync script to populate data from Late.dev\n');
    } else {
      console.log('✅ FOUND ANALYTICS DATA\n');
      snap.forEach((doc: any) => {
        const data = doc.data();
        console.log(`Doc ID: ${doc.id}`);
        console.log(`  Brand: ${data.brand}`);
        console.log(`  Views: ${data.totalViews || 0}`);
        console.log(`  Likes: ${data.totalLikes || 0}`);
        console.log(`  Engagement: ${data.overallEngagementRate?.toFixed(2) || 0}%`);
        console.log(`  Last Updated: ${data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'N/A'}`);
        console.log('');
      });
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

checkFirestoreAnalytics().catch(console.error);
