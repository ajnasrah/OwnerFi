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

async function analyzeDescriptions() {
  console.log('\n🔍 Analyzing Property Descriptions for Suspicious Patterns\n');
  console.log('='.repeat(80));

  const snapshot = await db.collection('zillow_imports').get();

  console.log(`\n📊 Analyzing ${snapshot.size} properties...\n`);

  // Patterns that might indicate no owner financing
  const suspiciousPatterns = [
    // Cash patterns
    { pattern: /\bcash\s+only\b/i, name: 'cash only' },
    { pattern: /\bcash\s+buyers\s+only\b/i, name: 'cash buyers only' },
    { pattern: /\bcash\s+or\s+conventional\b/i, name: 'cash or conventional' },
    { pattern: /\bconventional\s+only\b/i, name: 'conventional only' },
    { pattern: /\bconventional\s+financing\s+only\b/i, name: 'conventional financing only' },

    // No financing patterns
    { pattern: /\bno\s+financing\b/i, name: 'no financing' },
    { pattern: /\bno\s+owner\s+fin/i, name: 'no owner fin*' },
    { pattern: /\bno\s+seller\s+fin/i, name: 'no seller fin*' },
    { pattern: /\bno\s+creative\b/i, name: 'no creative' },
    { pattern: /\bnot\s+offering.*financing/i, name: 'not offering financing' },

    // FHA/VA only patterns
    { pattern: /\bfha\s+or\s+va\s+only\b/i, name: 'FHA or VA only' },
    { pattern: /\bfha\/va\s+only\b/i, name: 'FHA/VA only' },

    // Other exclusions
    { pattern: /\bno\s+wholesalers/i, name: 'no wholesalers' },
    { pattern: /\bno\s+assignments/i, name: 'no assignments' },
    { pattern: /\bno\s+contract/i, name: 'no contract' },
    { pattern: /\bwill\s+not\s+carry\b/i, name: 'will not carry' },
    { pattern: /\bcannot\s+carry\b/i, name: 'cannot carry' },

    // Suspicious investor language
    { pattern: /\binvestors?\s+only\b/i, name: 'investors only' },
    { pattern: /\bcash\s+flow/i, name: 'cash flow' },
  ];

  const findings = new Map<string, Array<{id: string, address: string, excerpt: string}>>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const description = data.description || '';
    const address = data.fullAddress || data.streetAddress || 'Unknown';

    for (const { pattern, name } of suspiciousPatterns) {
      const match = description.match(pattern);
      if (match) {
        if (!findings.has(name)) {
          findings.set(name, []);
        }

        // Get context around the match
        const matchIndex = match.index || 0;
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(description.length, matchIndex + match[0].length + 50);
        const excerpt = description.substring(start, end);

        findings.get(name)!.push({
          id: doc.id,
          address,
          excerpt: '...' + excerpt + '...',
        });
      }
    }
  }

  // Display findings
  console.log('='.repeat(80));
  console.log('\n📋 SUSPICIOUS PATTERNS FOUND:\n');

  if (findings.size === 0) {
    console.log('✅ No suspicious patterns found!\n');
    return;
  }

  // Sort by frequency
  const sorted = Array.from(findings.entries()).sort((a, b) => b[1].length - a[1].length);

  for (const [pattern, matches] of sorted) {
    console.log(`\n🔍 Pattern: "${pattern}" - Found in ${matches.length} properties`);
    console.log('─'.repeat(80));

    // Show first 3 examples
    matches.slice(0, 3).forEach((match, i) => {
      console.log(`\n  ${i + 1}. ${match.address}`);
      console.log(`     ID: ${match.id}`);
      console.log(`     "${match.excerpt}"`);
    });

    if (matches.length > 3) {
      console.log(`\n  ... and ${matches.length - 3} more`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 SUMMARY:\n');

  for (const [pattern, matches] of sorted) {
    console.log(`  ${pattern}: ${matches.length} properties`);
  }

  console.log('\n' + '='.repeat(80));
}

analyzeDescriptions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
