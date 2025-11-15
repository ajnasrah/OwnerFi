#!/usr/bin/env tsx
/**
 * Test NEW property queue system (propertyShowcaseWorkflows)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const adminConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
};

const app = initializeApp(adminConfig);
const db = getFirestore(app);

async function testNewQueue() {
  console.log('\n🧪 TESTING NEW PROPERTY QUEUE SYSTEM');
  console.log('=' .repeat(60));

  try {
    // Get all workflows
    const allSnapshot = await db.collection('propertyShowcaseWorkflows').get();
    console.log(`\n📊 Total workflows in propertyShowcaseWorkflows: ${allSnapshot.size}`);

    if (allSnapshot.size === 0) {
      console.log('\n⚠️  Queue is EMPTY! Need to run sync to populate.');
      return;
    }

    // Count by queue status
    const statusCounts: Record<string, number> = {};
    const languageCounts: Record<string, number> = {};
    const variantCounts: Record<string, number> = {};

    allSnapshot.docs.forEach(doc => {
      const data = doc.data();
      statusCounts[data.queueStatus] = (statusCounts[data.queueStatus] || 0) + 1;
      languageCounts[data.language] = (languageCounts[data.language] || 0) + 1;
      variantCounts[data.variant] = (variantCounts[data.variant] || 0) + 1;
    });

    console.log('\n📋 By Queue Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('\n🌐 By Language:');
    Object.entries(languageCounts).forEach(([lang, count]) => {
      console.log(`   ${lang}: ${count}`);
    });

    console.log('\n🎬 By Variant:');
    Object.entries(variantCounts).forEach(([variant, count]) => {
      console.log(`   ${variant}: ${count}`);
    });

    // Get next English workflow
    const nextEnQuery = await db.collection('propertyShowcaseWorkflows')
      .where('queueStatus', '==', 'queued')
      .where('language', '==', 'en')
      .orderBy('queuePosition', 'asc')
      .limit(1)
      .get();

    if (!nextEnQuery.empty) {
      const nextEn = nextEnQuery.docs[0].data();
      console.log('\n🎯 Next English Workflow:');
      console.log(`   ID: ${nextEnQuery.docs[0].id}`);
      console.log(`   Property: ${nextEn.address}`);
      console.log(`   Position: ${nextEn.queuePosition}`);
      console.log(`   Language: ${nextEn.language}`);
      console.log(`   Status: ${nextEn.status}`);
    }

    // Get next Spanish workflow
    const nextEsQuery = await db.collection('propertyShowcaseWorkflows')
      .where('queueStatus', '==', 'queued')
      .where('language', '==', 'es')
      .orderBy('queuePosition', 'asc')
      .limit(1)
      .get();

    if (!nextEsQuery.empty) {
      const nextEs = nextEsQuery.docs[0].data();
      console.log('\n🎯 Next Spanish Workflow:');
      console.log(`   ID: ${nextEsQuery.docs[0].id}`);
      console.log(`   Property: ${nextEs.address}`);
      console.log(`   Position: ${nextEs.queuePosition}`);
      console.log(`   Language: ${nextEs.language}`);
      console.log(`   Status: ${nextEs.status}`);
    }

    // Check for duplicates (same property with same language)
    const propertyMap = new Map<string, any[]>();
    allSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const key = `${data.propertyId}-${data.language}`;
      if (!propertyMap.has(key)) {
        propertyMap.set(key, []);
      }
      propertyMap.get(key)!.push({ id: doc.id, ...data });
    });

    const duplicates = Array.from(propertyMap.entries()).filter(([_, workflows]) => workflows.length > 1);
    if (duplicates.length > 0) {
      console.log(`\n⚠️  Found ${duplicates.length} properties with duplicate workflows:`);
      duplicates.slice(0, 5).forEach(([key, workflows]) => {
        console.log(`   ${key}: ${workflows.length} workflows`);
      });
    } else {
      console.log('\n✅ No duplicate workflows found');
    }

    console.log('\n✅ Queue check complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

testNewQueue()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
