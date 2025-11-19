import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function checkZillowSample() {
  console.log('\n📊 Checking Zillow Imports Sample Data\n');
  console.log('='.repeat(80));

  const snapshot = await db.collection('zillow_imports').limit(10).get();

  console.log(`\nShowing 10 sample properties:\n`);

  snapshot.forEach((doc, index) => {
    const data = doc.data();
    console.log(`\n${index + 1}. Property ID: ${doc.id}`);
    console.log(`   Address: ${data.fullAddress || data.streetAddress || 'Unknown'}`);
    console.log(`   Has isActive: ${data.isActive !== undefined}`);
    console.log(`   isActive value: ${data.isActive}`);
    console.log(`   Has status: ${data.status !== undefined}`);
    console.log(`   status value: ${data.status}`);
    console.log(`   Has description: ${!!data.description}`);
    console.log(`   Description preview: ${data.description?.substring(0, 100) || 'N/A'}...`);
    console.log(`   All fields: ${Object.keys(data).join(', ')}`);
  });

  // Also check what unique statuses exist
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 Analyzing all properties for status patterns...\n');

  const allSnapshot = await db.collection('zillow_imports').get();
  const statusCounts = new Map<string, number>();
  const isActiveCounts = new Map<string, number>();
  let withDescription = 0;
  let withoutDescription = 0;

  allSnapshot.forEach(doc => {
    const data = doc.data();

    const status = data.status?.toString() || 'undefined';
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

    const isActive = data.isActive?.toString() || 'undefined';
    isActiveCounts.set(isActive, (isActiveCounts.get(isActive) || 0) + 1);

    if (data.description) {
      withDescription++;
    } else {
      withoutDescription++;
    }
  });

  console.log('Status field distribution:');
  Array.from(statusCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

  console.log('\nisActive field distribution:');
  Array.from(isActiveCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([isActive, count]) => {
      console.log(`  ${isActive}: ${count}`);
    });

  console.log('\nDescription field:');
  console.log(`  With description: ${withDescription}`);
  console.log(`  Without description: ${withoutDescription}`);

  console.log('\n' + '='.repeat(80));
}

checkZillowSample()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
