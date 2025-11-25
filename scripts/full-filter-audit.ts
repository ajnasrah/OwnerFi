/**
 * FULL FILTER AUDIT
 *
 * Tests ALL properties in the database against the UPDATED filter:
 * 1. Currently showing to buyers (ownerFinanceVerified=true) - check for false positives
 * 2. Previously rejected (ownerFinanceVerified=false) - check for false negatives we missed
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

// Import the UPDATED filters
import { hasStrictOwnerFinancing, getStrictMatchedPatterns } from '../src/lib/owner-financing-filter-strict';
import { hasNegativeFinancing, detectNegativeFinancing } from '../src/lib/negative-financing-detector';

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PropertyRecord {
  id: string;
  address: string;
  city: string;
  state: string;
  description: string;
  source: string;
  currentStatus: 'verified' | 'rejected' | 'unknown';
  // Filter results
  wouldPassNewFilter: boolean;
  matchedKeywords: string[];
  negativeReason: string;
  // AI verification
  aiSaysIsOwnerFinance?: boolean;
  aiReason?: string;
}

async function verifyWithAI(description: string, address: string): Promise<{ isOwnerFinance: boolean; reason: string }> {
  if (!description || description.trim().length < 10) {
    return { isOwnerFinance: false, reason: 'No/short description' };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at identifying owner financing properties.

OWNER FINANCING means the SELLER/OWNER is providing the financing - NOT a bank or lender.

Keywords that indicate REAL owner financing:
- "owner finance/financing", "seller finance/financing"
- "owner carry", "seller carry"
- "no bank needed", "no bank qualifying"
- "rent to own", "lease option", "lease purchase"
- "contract for deed", "land contract"

NOT owner financing (FALSE POSITIVES):
- "preferred lender", "our lender", "mortgage company"
- "special rate with lender", "lock in a rate"
- "FHA/VA financing", "conventional financing"
- Historical references like "seller financed foreclosure" (past, not current)
- "seller financing is not an option/available"
- "cannot do owner financing"

Answer with JSON: { "isOwnerFinance": true/false, "reason": "brief explanation" }`
        },
        {
          role: 'user',
          content: `Property: ${address}\n\nDescription:\n${description}`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    return {
      isOwnerFinance: result.isOwnerFinance ?? false,
      reason: result.reason || 'Unknown'
    };
  } catch (error) {
    return { isOwnerFinance: false, reason: 'AI error' };
  }
}

async function main() {
  console.log('=' .repeat(80));
  console.log('FULL FILTER AUDIT - Testing ALL properties against UPDATED filter');
  console.log('=' .repeat(80));
  console.log('');

  // Fetch all properties
  console.log('📥 Fetching all properties...\n');

  const verifiedProperties: PropertyRecord[] = [];
  const rejectedProperties: PropertyRecord[] = [];

  // 1. Curated properties (assume verified)
  const curatedSnapshot = await getDocs(query(collection(db, 'properties'), where('isActive', '==', true)));
  console.log(`   Curated properties: ${curatedSnapshot.size}`);

  curatedSnapshot.docs.forEach(doc => {
    const data = doc.data();
    verifiedProperties.push({
      id: doc.id,
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      description: data.description || '',
      source: 'curated',
      currentStatus: 'verified',
      wouldPassNewFilter: false,
      matchedKeywords: [],
      negativeReason: ''
    });
  });

  // 2. Zillow imports - VERIFIED (currently showing to buyers)
  const zillowVerifiedSnapshot = await getDocs(query(collection(db, 'zillow_imports'), where('ownerFinanceVerified', '==', true)));
  console.log(`   Zillow VERIFIED (showing to buyers): ${zillowVerifiedSnapshot.size}`);

  zillowVerifiedSnapshot.docs.forEach(doc => {
    const data = doc.data();
    verifiedProperties.push({
      id: doc.id,
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      description: data.description || '',
      source: 'zillow',
      currentStatus: 'verified',
      wouldPassNewFilter: false,
      matchedKeywords: [],
      negativeReason: ''
    });
  });

  // 3. Zillow imports - NOT VERIFIED (previously rejected)
  const zillowRejectedSnapshot = await getDocs(query(collection(db, 'zillow_imports'), where('ownerFinanceVerified', '==', false)));
  console.log(`   Zillow REJECTED (by old filter): ${zillowRejectedSnapshot.size}`);

  zillowRejectedSnapshot.docs.forEach(doc => {
    const data = doc.data();
    rejectedProperties.push({
      id: doc.id,
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      description: data.description || '',
      source: 'zillow',
      currentStatus: 'rejected',
      wouldPassNewFilter: false,
      matchedKeywords: [],
      negativeReason: ''
    });
  });

  console.log(`\n📊 Total: ${verifiedProperties.length} verified + ${rejectedProperties.length} rejected = ${verifiedProperties.length + rejectedProperties.length} total\n`);

  // ============================================================
  // PART 1: Check VERIFIED properties for FALSE POSITIVES
  // ============================================================
  console.log('=' .repeat(80));
  console.log('PART 1: Checking VERIFIED properties for FALSE POSITIVES');
  console.log('        (Properties showing to buyers that should NOT be)');
  console.log('=' .repeat(80));
  console.log('');

  const falsePositives: PropertyRecord[] = [];
  const truePositives: PropertyRecord[] = [];

  for (const prop of verifiedProperties) {
    const filterResult = hasStrictOwnerFinancing(prop.description);
    prop.wouldPassNewFilter = filterResult.passes;
    prop.matchedKeywords = filterResult.matchedKeywords;

    const negResult = detectNegativeFinancing(prop.description);
    prop.negativeReason = negResult.isNegative ? negResult.reason : '';

    if (prop.wouldPassNewFilter) {
      truePositives.push(prop);
    } else {
      falsePositives.push(prop);
    }
  }

  console.log(`   ✅ Still pass new filter (TRUE POSITIVES): ${truePositives.length}`);
  console.log(`   ❌ Would now be rejected (potential FALSE POSITIVES): ${falsePositives.length}`);

  // Verify false positives with AI
  if (falsePositives.length > 0) {
    console.log(`\n🤖 Verifying ${falsePositives.length} potential false positives with AI...\n`);

    const confirmedFalsePositives: PropertyRecord[] = [];
    const wronglyRejectedVerified: PropertyRecord[] = [];

    for (let i = 0; i < falsePositives.length; i += 10) {
      const batch = falsePositives.slice(i, Math.min(i + 10, falsePositives.length));
      await Promise.all(batch.map(async (prop) => {
        const aiResult = await verifyWithAI(prop.description, `${prop.address}, ${prop.city}, ${prop.state}`);
        prop.aiSaysIsOwnerFinance = aiResult.isOwnerFinance;
        prop.aiReason = aiResult.reason;

        if (aiResult.isOwnerFinance) {
          // AI says it IS owner finance but new filter rejects = we're wrong!
          wronglyRejectedVerified.push(prop);
        } else {
          // AI agrees it's NOT owner finance = confirmed false positive in DB
          confirmedFalsePositives.push(prop);
        }
      }));
      console.log(`   Verified ${Math.min(i + 10, falsePositives.length)}/${falsePositives.length}`);
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n   Results:`);
    console.log(`   ✅ Confirmed FALSE POSITIVES in DB (should delete): ${confirmedFalsePositives.length}`);
    console.log(`   ⚠️  Would wrongly reject REAL owner finance: ${wronglyRejectedVerified.length}`);

    if (wronglyRejectedVerified.length > 0) {
      console.log(`\n⚠️  PROBLEM: Filter would wrongly reject these REAL owner finance properties:`);
      wronglyRejectedVerified.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.address}, ${p.city}, ${p.state}`);
        console.log(`      Filter rejection: ${p.negativeReason || 'No keywords matched'}`);
        console.log(`      AI says: ${p.aiReason}`);
        console.log(`      Description: ${p.description?.substring(0, 150)}...`);
      });
    }

    // Export confirmed false positives
    if (confirmedFalsePositives.length > 0) {
      const data = confirmedFalsePositives.map(p => ({
        'ID': p.id,
        'Address': p.address,
        'City': p.city,
        'State': p.state,
        'Rejection Reason': p.negativeReason || 'No keywords',
        'AI Reason': p.aiReason,
        'Description': p.description?.substring(0, 500) || ''
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'False Positives');
      XLSX.writeFile(wb, 'CONFIRMED-FALSE-POSITIVES.xlsx');
      console.log(`\n📁 Saved to CONFIRMED-FALSE-POSITIVES.xlsx`);
    }
  }

  // ============================================================
  // PART 2: Check REJECTED properties for MISSED OPPORTUNITIES
  // ============================================================
  console.log('\n' + '=' .repeat(80));
  console.log('PART 2: Checking REJECTED properties for MISSED OPPORTUNITIES');
  console.log('        (Properties the OLD filter rejected that might be valid)');
  console.log('=' .repeat(80));
  console.log('');

  if (rejectedProperties.length === 0) {
    console.log('   No rejected properties found in database.');
  } else {
    // First, see how many would pass the NEW filter
    const wouldNowPass: PropertyRecord[] = [];
    const stillFail: PropertyRecord[] = [];

    for (const prop of rejectedProperties) {
      const filterResult = hasStrictOwnerFinancing(prop.description);
      prop.wouldPassNewFilter = filterResult.passes;
      prop.matchedKeywords = filterResult.matchedKeywords;

      const negResult = detectNegativeFinancing(prop.description);
      prop.negativeReason = negResult.isNegative ? negResult.reason : '';

      if (prop.wouldPassNewFilter) {
        wouldNowPass.push(prop);
      } else {
        stillFail.push(prop);
      }
    }

    console.log(`   Would NOW pass new filter: ${wouldNowPass.length}`);
    console.log(`   Still fail new filter: ${stillFail.length}`);

    // Sample check the stillFail ones to see if any are real owner finance
    const sampleSize = Math.min(100, stillFail.length);
    if (sampleSize > 0) {
      console.log(`\n🤖 Sampling ${sampleSize} rejected properties to find missed opportunities...\n`);

      const missedOpportunities: PropertyRecord[] = [];
      const sample = stillFail.slice(0, sampleSize);

      for (let i = 0; i < sample.length; i += 10) {
        const batch = sample.slice(i, Math.min(i + 10, sample.length));
        await Promise.all(batch.map(async (prop) => {
          const aiResult = await verifyWithAI(prop.description, `${prop.address}, ${prop.city}, ${prop.state}`);
          prop.aiSaysIsOwnerFinance = aiResult.isOwnerFinance;
          prop.aiReason = aiResult.reason;

          if (aiResult.isOwnerFinance) {
            missedOpportunities.push(prop);
          }
        }));
        console.log(`   Checked ${Math.min(i + 10, sample.length)}/${sampleSize}`);
        await new Promise(r => setTimeout(r, 500));
      }

      console.log(`\n   Results from sample:`);
      console.log(`   ❌ MISSED OPPORTUNITIES (AI says is owner finance): ${missedOpportunities.length}`);

      if (missedOpportunities.length > 0) {
        console.log(`\n⚠️  These properties were rejected but AI says they ARE owner finance:`);
        missedOpportunities.slice(0, 10).forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.address}, ${p.city}, ${p.state}`);
          console.log(`      AI says: ${p.aiReason}`);
          console.log(`      Description: ${p.description?.substring(0, 150)}...`);
        });

        // Export missed opportunities
        const data = missedOpportunities.map(p => ({
          'ID': p.id,
          'Address': p.address,
          'City': p.city,
          'State': p.state,
          'AI Reason': p.aiReason,
          'Description': p.description?.substring(0, 500) || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Missed Opportunities');
        XLSX.writeFile(wb, 'MISSED-OPPORTUNITIES.xlsx');
        console.log(`\n📁 Saved to MISSED-OPPORTUNITIES.xlsx`);
      }
    }
  }

  // Final summary
  console.log('\n' + '=' .repeat(80));
  console.log('FINAL SUMMARY');
  console.log('=' .repeat(80));
  console.log(`
Properties in DB:
  - Verified (showing to buyers): ${verifiedProperties.length}
  - Rejected (by old filter): ${rejectedProperties.length}

Filter Analysis:
  - Would still pass new filter: ${truePositives.length}
  - Would now be rejected: ${falsePositives.length}

Key Findings exported to Excel files.
`);

  console.log('✅ Audit complete!');
}

main().catch(console.error);
