#!/usr/bin/env ts-node
/**
 * Test writing a Spanish property workflow to Firestore
 */

import * as admin from 'firebase-admin';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function testSpanishWorkflow() {
  // Initialize Firebase Admin
  if (getApps().length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  }

  const db = getFirestore();

  console.log('🧪 Testing Spanish workflow write to Firestore...\n');

  const testWorkflowId = `property_15sec_es_TEST_${Date.now()}`;
  const testWorkflow = {
    id: testWorkflowId,
    propertyId: 'TEST_PROPERTY',
    variant: '15sec',
    language: 'es', // SPANISH
    address: 'TEST 123 Main St',
    city: 'Test City',
    state: 'TX',
    downPayment: 10000,
    monthlyPayment: 500,
    script: 'Test Spanish script',
    caption: 'Test caption #test',
    title: 'Test Property',
    status: 'heygen_processing',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  console.log('📝 Writing test workflow to property_videos collection...');
  console.log(`   Workflow ID: ${testWorkflowId}`);
  console.log(`   Language: ${testWorkflow.language}`);

  try {
    await db.collection('property_videos').doc(testWorkflowId).set(testWorkflow);
    console.log('✅ Write successful!\n');

    // Read it back
    console.log('📖 Reading workflow back from Firestore...');
    const doc = await db.collection('property_videos').doc(testWorkflowId).get();

    if (doc.exists) {
      const data = doc.data();
      console.log('✅ Workflow found!');
      console.log(`   Language field: ${data?.language || 'MISSING'}`);
      console.log(`   Full data:`, JSON.stringify(data, null, 2));

      // Now test the logs endpoint query
      console.log('\n🔍 Testing logs query (language === "es")...');
      const spanishDocs = await db.collection('property_videos')
        .where('language', '==', 'es')
        .limit(5)
        .get();

      console.log(`✅ Found ${spanishDocs.size} Spanish workflows`);
      spanishDocs.forEach(doc => {
        console.log(`   - ${doc.id}: ${doc.data().address}`);
      });

      // Cleanup
      console.log('\n🧹 Cleaning up test workflow...');
      await db.collection('property_videos').doc(testWorkflowId).delete();
      console.log('✅ Test complete!\n');
    } else {
      console.log('❌ Workflow not found after write!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testSpanishWorkflow()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
