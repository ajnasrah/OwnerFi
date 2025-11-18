import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { hasOwnerFinancing } from '../src/lib/owner-financing-filter';

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

async function findFalsePositives() {
  console.log('\n🔍 Searching for False Positives in Database\n');
  console.log('='.repeat(80));

  const snapshot = await db.collection('zillow_imports').get();

  console.log(`\n📊 Total properties in database: ${snapshot.size}\n`);
  console.log('Analyzing all properties for false positives...\n');

  const falsePositives: Array<{
    id: string;
    address: string;
    description: string;
    reason: string;
  }> = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const result = hasOwnerFinancing(data.description);

    // False positive: Property is in DB but SHOULDN'T be (no owner financing)
    if (!result.shouldSend) {
      falsePositives.push({
        id: doc.id,
        address: data.fullAddress || data.streetAddress || 'Unknown',
        description: data.description || 'NO DESCRIPTION',
        reason: result.reason,
      });
    }
  }

  console.log('='.repeat(80));
  console.log('\n📊 ANALYSIS RESULTS:\n');
  console.log(`Total Properties:         ${snapshot.size}`);
  console.log(`False Positives Found:    ${falsePositives.length}`);
  console.log(`Clean Properties:         ${snapshot.size - falsePositives.length}`);
  console.log(`False Positive Rate:      ${((falsePositives.length / snapshot.size) * 100).toFixed(1)}%`);

  if (falsePositives.length === 0) {
    console.log('\n✅ No false positives found! All properties have owner financing.\n');
    return;
  }

  console.log('\n='.repeat(80));
  console.log('\n⚠️  FALSE POSITIVES (First 10):\n');

  falsePositives.slice(0, 10).forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address}`);
    console.log(`   ID: ${prop.id}`);
    console.log(`   Reason: ${prop.reason}`);
    console.log(`   Description: ${prop.description.substring(0, 150)}...`);
    console.log();
  });

  if (falsePositives.length > 10) {
    console.log(`... and ${falsePositives.length - 10} more\n`);
  }

  // Breakdown by reason
  console.log('='.repeat(80));
  console.log('\n📋 BREAKDOWN BY REASON:\n');

  const reasonCounts = new Map<string, number>();
  falsePositives.forEach(prop => {
    const count = reasonCounts.get(prop.reason) || 0;
    reasonCounts.set(prop.reason, count + 1);
  });

  Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => {
      const percentage = ((count / falsePositives.length) * 100).toFixed(1);
      console.log(`  ${reason}: ${count} (${percentage}%)`);
    });

  console.log('\n' + '='.repeat(80));
}

findFalsePositives()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
