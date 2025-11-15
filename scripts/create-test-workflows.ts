#!/usr/bin/env tsx
/**
 * Create test workflows manually for testing
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

async function createTestWorkflows() {
  console.log('\n🧪 CREATING TEST WORKFLOWS');
  console.log('=' .repeat(60));

  try {
    // Get first 2 active properties
    const propertiesSnapshot = await db.collection('properties')
      .where('isActive', '==', true)
      .where('status', '==', 'active')
      .limit(2)
      .get();

    if (propertiesSnapshot.empty) {
      console.log('❌ No active properties found');
      return;
    }

    console.log(`\n📋 Found ${propertiesSnapshot.size} active properties`);

    let created = 0;

    for (const propertyDoc of propertiesSnapshot.docs) {
      const property = propertyDoc.data();

      // Check if property has images
      if (!property.imageUrls || property.imageUrls.length === 0) {
        console.log(`⏭️  Skipping ${property.address} - no images`);
        continue;
      }

      console.log(`\n🏡 Creating workflows for: ${property.address}`);
      console.log(`   City: ${property.city}, ${property.state}`);
      console.log(`   Images: ${property.imageUrls.length}`);

      // Create English workflow
      const workflowIdEn = `property_15sec_en_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const workflowEn = {
        id: workflowIdEn,
        propertyId: propertyDoc.id,
        queueStatus: 'queued',
        queuePosition: created * 2 + 1,
        queueAddedAt: Date.now(),
        totalVideosGenerated: 0,
        currentCycleCount: 0,
        status: 'pending',
        address: property.address,
        city: property.city,
        state: property.state,
        downPayment: property.downPaymentAmount || 0,
        monthlyPayment: property.monthlyPayment || 0,
        variant: '15sec',
        language: 'en',
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.collection('propertyShowcaseWorkflows').doc(workflowIdEn).set(workflowEn);
      console.log(`   ✅ Created English workflow: ${workflowIdEn}`);
      created++;

      // Create Spanish workflow
      const workflowIdEs = `property_15sec_es_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const workflowEs = {
        id: workflowIdEs,
        propertyId: propertyDoc.id,
        queueStatus: 'queued',
        queuePosition: created * 2,
        queueAddedAt: Date.now(),
        totalVideosGenerated: 0,
        currentCycleCount: 0,
        status: 'pending',
        address: property.address,
        city: property.city,
        state: property.state,
        downPayment: property.downPaymentAmount || 0,
        monthlyPayment: property.monthlyPayment || 0,
        variant: '15sec',
        language: 'es',
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.collection('propertyShowcaseWorkflows').doc(workflowIdEs).set(workflowEs);
      console.log(`   ✅ Created Spanish workflow: ${workflowIdEs}`);
      created++;
    }

    console.log(`\n✅ Created ${created} test workflows!\n`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

createTestWorkflows()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
