#!/usr/bin/env tsx
/**
 * Delete Failed Circuit Breaker Workflows
 * Deletes workflows that failed with "Circuit breaker is OPEN for Late" errors
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
  category?: string;
  headline?: string;
  createdAt?: any;
}

async function deleteFailedCircuitBreakerWorkflows() {

  console.log('🔍 Searching for failed circuit breaker workflows...\n');

  const collections = [
    { name: 'property_videos', brand: 'property' },
    { name: 'ownerfi_workflow_queue', brand: 'ownerfi' },
    { name: 'benefit_workflow_queue', brand: 'benefit' },
  ];

  let totalDeleted = 0;

  for (const { name: collectionName, brand } of collections) {
    console.log(`\n📁 Checking ${collectionName}...`);

    try {
      // Query for failed workflows with circuit breaker errors
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

      // Filter for circuit breaker errors
      const circuitBreakerFailures: Workflow[] = [];

      snapshot.forEach(doc => {
        const data = doc.data() as Workflow;
        const error = data.error?.toLowerCase() || '';

        if (error.includes('circuit breaker') && error.includes('late')) {
          circuitBreakerFailures.push({
            id: doc.id,
            ...data
          });
        }
      });

      if (circuitBreakerFailures.length === 0) {
        console.log(`   No circuit breaker failures found`);
        continue;
      }

      console.log(`\n   🎯 Found ${circuitBreakerFailures.length} circuit breaker failure(s):`);

      // Delete each workflow
      for (const workflow of circuitBreakerFailures) {
        const createdAt = workflow.createdAt?.toDate?.() || new Date(0);
        const hoursAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));

        console.log(`\n   ❌ Deleting workflow: ${workflow.id}`);
        console.log(`      Category: ${workflow.category || 'N/A'}`);
        console.log(`      Headline: ${workflow.headline || 'N/A'}`);
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
  console.log(`✅ Deleted ${totalDeleted} failed circuit breaker workflow(s)`);
  console.log(`${'='.repeat(60)}\n`);
}

deleteFailedCircuitBreakerWorkflows().catch(console.error);
