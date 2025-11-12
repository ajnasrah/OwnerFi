/**
 * Check Property Update Logs
 *
 * Verify that property updates are being logged to systemLogs collection
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function checkPropertyUpdateLogs() {
  console.log('🔍 Checking property update logs...\n');

  // Get recent logs from systemLogs collection
  const logsSnapshot = await db.collection('systemLogs')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  console.log(`📋 Found ${logsSnapshot.size} recent logs\n`);

  // Filter for property-related logs
  const propertyLogs = logsSnapshot.docs.filter(doc => {
    const data = doc.data();
    const message = data.message || '';
    let action = '';

    try {
      const context = data.context ? JSON.parse(data.context) : {};
      action = context.action || '';
    } catch (e) {
      // Ignore parse errors
    }

    return message.toLowerCase().includes('property') ||
           action.includes('property');
  });

  console.log(`🏠 Found ${propertyLogs.length} property-related logs\n`);
  console.log('═'.repeat(80) + '\n');

  // Show recent property update/create logs
  console.log('📝 RECENT PROPERTY UPDATE/CREATE LOGS:\n');

  propertyLogs.slice(0, 20).forEach((logDoc, idx) => {
    const data = logDoc.data();
    let context: any = {};

    try {
      context = data.context ? JSON.parse(data.context) : {};
    } catch (e) {
      // Ignore parse errors
    }

    const timestamp = data.createdAt?.toDate?.() || new Date(data.createdAt);

    console.log(`${idx + 1}. ${data.message}`);
    console.log(`   Level: ${data.level}`);
    console.log(`   Time: ${timestamp.toLocaleString()}`);
    console.log(`   Action: ${context.action || 'N/A'}`);

    if (context.metadata) {
      console.log(`   Details:`);
      console.log(`     - Property ID: ${context.metadata.propertyId || 'N/A'}`);
      console.log(`     - Address: ${context.metadata.address || 'N/A'}`);
      console.log(`     - City: ${context.metadata.city || 'N/A'}`);
      console.log(`     - State: ${context.metadata.state || 'N/A'}`);
      console.log(`     - Price: ${context.metadata.price ? '$' + context.metadata.price.toLocaleString() : 'N/A'}`);

      if (context.metadata.updatedFields) {
        console.log(`     - Updated Fields: ${context.metadata.updatedFields.join(', ')}`);
      }
    }
    console.log('');
  });

  if (propertyLogs.length > 20) {
    console.log(`   ... and ${propertyLogs.length - 20} more\n`);
  }

  // Show breakdown by action type
  const actionBreakdown = propertyLogs.reduce((acc, logDoc) => {
    const data = logDoc.data();
    let context: any = {};

    try {
      context = data.context ? JSON.parse(data.context) : {};
    } catch (e) {
      // Ignore parse errors
    }

    const action = context.action || 'unknown';
    acc[action] = (acc[action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('═'.repeat(80) + '\n');
  console.log('📊 PROPERTY LOGS BY ACTION:\n');
  Object.entries(actionBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([action, count]) => {
      console.log(`   ${action}: ${count}`);
    });

  console.log('\n');
}

// Run the script
checkPropertyUpdateLogs()
  .then(() => {
    console.log('✅ Log check completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
