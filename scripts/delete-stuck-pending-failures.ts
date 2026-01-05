#!/usr/bin/env tsx
/**
 * Delete Failed Pending Workflows
 * Deletes workflows that failed due to being stuck in Pending with no HeyGen video ID
 */

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

interface Workflow {
  id: string;
  status: string;
  error?: string;
  title?: string;
  articleTitle?: string;
  createdAt?: any;
}

async function deleteStuckPendingFailures() {
  console.log('🔍 Searching for failed stuck pending workflows...\n');

  // Check all brand workflow queues
  const collections = [
    { name: 'carz_workflow_queue', brand: 'carz' },
    { name: 'ownerfi_workflow_queue', brand: 'ownerfi' },
    { name: 'benefit_workflow_queue', brand: 'benefit' },
    { name: 'abdullah_workflow_queue', brand: 'abdullah' },
    { name: 'gaza_workflow_queue', brand: 'gaza' },
  ];

  let totalDeleted = 0;

  for (const { name: collectionName, brand } of collections) {
    console.log(`\n📁 Checking ${collectionName}...`);

    try {
      // Query for failed workflows
      const q = query(
        collection(db, collectionName),
        where('status', '==', 'failed')
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log(`   No failed workflows found`);
        continue;
      }

      console.log(`   Found ${snapshot.size} failed workflow(s)`);

      // Filter for stuck pending failures
      const stuckPendingFailures: Workflow[] = [];

      snapshot.forEach(doc => {
        const data = doc.data() as Workflow;
        const error = data.error?.toLowerCase() || '';

        if (
          error.includes('stuck in pending') ||
          error.includes('no heygen video id')
        ) {
          stuckPendingFailures.push({
            id: doc.id,
            ...data
          });
        }
      });

      if (stuckPendingFailures.length === 0) {
        console.log(`   No stuck pending failures found`);
        continue;
      }

      console.log(`\n   🎯 Found ${stuckPendingFailures.length} stuck pending failure(s):`);

      // Delete each workflow
      for (const workflow of stuckPendingFailures) {
        const createdAt = workflow.createdAt?.toDate?.() || new Date(0);
        const hoursAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));
        const title = workflow.title || workflow.articleTitle || 'N/A';

        console.log(`\n   ❌ Deleting workflow: ${workflow.id}`);
        console.log(`      Title: ${title.substring(0, 60)}...`);
        console.log(`      Failed: ${hoursAgo}h ago`);
        console.log(`      Error: ${workflow.error?.substring(0, 80)}...`);

        try {
          await deleteDoc(doc(db, collectionName, workflow.id));
          console.log(`      ✅ Deleted`);
          totalDeleted++;
        } catch (deleteError) {
          console.error(`      ❌ Failed to delete:`, deleteError);
        }
      }

    } catch (error) {
      console.error(`   ❌ Error processing ${collectionName}:`, error);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Deleted ${totalDeleted} stuck pending failure(s)`);
  console.log(`${'='.repeat(60)}\n`);
}

deleteStuckPendingFailures().catch(console.error);
