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

async function dissectAllDescriptions() {
  console.log('\n🔬 DEEP ANALYSIS: Dissecting ALL Property Descriptions\n');
  console.log('='.repeat(80));

  const snapshot = await db.collection('zillow_imports').get();

  console.log(`\n📊 Total properties in database: ${snapshot.size}\n`);

  const suspiciousProperties: Array<{
    id: string;
    address: string;
    description: string;
    matchedPattern: string;
    hasCashOnly: boolean;
    hasConventionalOnly: boolean;
    hasNoOwnerFinancing: boolean;
  }> = [];

  // Patterns that indicate false positives
  const suspiciousPatterns = [
    { pattern: /cash.*only/i, name: 'cash only' },
    { pattern: /conventional.*only/i, name: 'conventional only' },
    { pattern: /no.*owner.*financ/i, name: 'no owner financing' },
    { pattern: /financing.*available.*conventional/i, name: 'conventional financing only' },
    { pattern: /down.*payment.*assistance/i, name: 'down payment assistance (not owner financing)' },
    { pattern: /fha.*va.*only/i, name: 'FHA/VA only' },
    { pattern: /traditional.*financing.*only/i, name: 'traditional financing only' },
  ];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const desc = data.description || '';
    const result = hasOwnerFinancing(desc);

    // Only check properties that PASSED the filter
    if (result.shouldSend) {
      // Check if description contains suspicious patterns
      let hasSuspiciousPattern = false;
      let matchedPattern = '';

      for (const { pattern, name } of suspiciousPatterns) {
        if (pattern.test(desc)) {
          hasSuspiciousPattern = true;
          matchedPattern = name;
          break;
        }
      }

      if (hasSuspiciousPattern) {
        suspiciousProperties.push({
          id: doc.id,
          address: data.fullAddress || data.streetAddress || 'Unknown',
          description: desc,
          matchedPattern,
          hasCashOnly: /cash.*only/i.test(desc),
          hasConventionalOnly: /conventional.*only/i.test(desc),
          hasNoOwnerFinancing: /no.*owner.*financ/i.test(desc),
        });
      }
    }
  }

  console.log('='.repeat(80));
  console.log('\n🚨 SUSPICIOUS PROPERTIES FOUND:\n');
  console.log(`Total Suspicious: ${suspiciousProperties.length}`);
  console.log(`Suspicion Rate: ${((suspiciousProperties.length / snapshot.size) * 100).toFixed(1)}%`);

  if (suspiciousProperties.length === 0) {
    console.log('\n✅ No suspicious properties found!\n');
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n🔍 DETAILED BREAKDOWN (First 20):\n');

  suspiciousProperties.slice(0, 20).forEach((prop, i) => {
    console.log(`\n${i + 1}. ${prop.address}`);
    console.log(`   ID: ${prop.id}`);
    console.log(`   Matched Pattern: ${prop.matchedPattern}`);
    console.log(`   🚩 Flags:`);
    console.log(`      - Cash Only: ${prop.hasCashOnly ? 'YES ❌' : 'no'}`);
    console.log(`      - Conventional Only: ${prop.hasConventionalOnly ? 'YES ❌' : 'no'}`);
    console.log(`      - No Owner Financing: ${prop.hasNoOwnerFinancing ? 'YES ❌' : 'no'}`);
    console.log(`   Description:`);
    console.log(`   "${prop.description.substring(0, 300)}..."`);
    console.log('-'.repeat(80));
  });

  if (suspiciousProperties.length > 20) {
    console.log(`\n... and ${suspiciousProperties.length - 20} more suspicious properties\n`);
  }

  // Breakdown by flag type
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 BREAKDOWN BY FLAG TYPE:\n');
  console.log(`  Cash Only: ${suspiciousProperties.filter(p => p.hasCashOnly).length}`);
  console.log(`  Conventional Only: ${suspiciousProperties.filter(p => p.hasConventionalOnly).length}`);
  console.log(`  No Owner Financing: ${suspiciousProperties.filter(p => p.hasNoOwnerFinancing).length}`);

  console.log('\n' + '='.repeat(80));
}

dissectAllDescriptions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
