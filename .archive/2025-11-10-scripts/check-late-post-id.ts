#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

// Import after env is loaded
const { getAdminDb } = require('../src/lib/firebase-admin');

async function checkLatePostId() {
  const db = await getAdminDb();
  if (!db) {
    console.error('Failed to initialize Firebase Admin');
    return;
  }

  const snap = await (db as any).collection('carz_workflow_queue').doc('wf_1761836449916_ftc805iwh').get();
  const data = snap.data();

  console.log('Late Post ID:', data?.latePostId);
  console.log('Status:', data?.status);
  console.log('Scheduled Time:', data?.scheduledTime);

  if (data?.latePostId) {
    // Test the API
    const LATE_API_KEY = process.env.LATE_API_KEY;
    console.log('\nTesting Late API...');

    const response = await fetch(`https://getlate.dev/api/v1/posts/${data.latePostId}`, {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Status:', response.status);
    const apiData = await response.json();
    console.log('Response:', JSON.stringify(apiData, null, 2));
  }
}

checkLatePostId().catch(console.error);
