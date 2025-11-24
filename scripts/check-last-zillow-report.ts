/**
 * Check the last Zillow status refresh report
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function checkLastReport() {
  console.log('🔍 Fetching most recent status change report...\n');

  const snapshot = await db.collection('status_change_reports')
    .orderBy('date', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('❌ No status change reports found');
    return;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();

  console.log('📊 MOST RECENT ZILLOW STATUS CHECK REPORT');
  console.log('='.repeat(60));
  console.log('Report Date:', data.date?.toDate?.() || data.date);
  console.log('Total Properties Checked:', data.totalChecked);
  console.log('Status Changes Detected:', data.statusChanges);
  console.log('Properties DELETED:', data.deleted);
  console.log('='.repeat(60));

  if (data.deletions && data.deletions.length > 0) {
    console.log('\n🗑️  DELETED PROPERTIES DETAILS:\n');
    data.deletions.forEach((del: any, i: number) => {
      console.log(`${i + 1}. ${del.address}`);
      console.log(`   Status: ${del.status}`);
      console.log(`   Reason: ${del.reason}`);
      console.log('');
    });
  }

  if (data.changes && data.changes.length > 0) {
    console.log('📋 STATUS CHANGES (properties that were updated, not deleted):\n');
    data.changes.forEach((change: any, i: number) => {
      console.log(`${i + 1}. ${change.address}`);
      console.log(`   ${change.oldStatus} → ${change.newStatus}`);
      console.log('');
    });
  }

  console.log('='.repeat(60));
  console.log(`SUMMARY: ${data.deleted} properties were REMOVED from the database`);
  console.log('='.repeat(60));
}

checkLastReport().catch(console.error);
