/**
 * AI Filter Accuracy Check
 *
 * Finds properties that failed the owner financing filter and uses AI
 * to analyze if the filter was accurate or missed real owner financing deals.
 */

import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';
import { hasNegativeFinancing } from '../src/lib/negative-financing-detector';
import OpenAI from 'openai';

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
const openai = new OpenAI();

interface PropertyToCheck {
  id: string;
  address: string;
  description: string;
  filterResult: {
    passes: boolean;
    matchedKeywords: string[];
  };
  negativeResult: boolean;
  collection: string;
}

async function analyzeWithAI(description: string): Promise<{
  isOwnerFinancing: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  keywords: string[];
}> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Analyze this real estate listing description and determine if it offers OWNER FINANCING, SELLER FINANCING, or similar seller-backed financing options.

DESCRIPTION:
${description}

Answer in JSON format:
{
  "isOwnerFinancing": true/false,
  "confidence": "high"/"medium"/"low",
  "reasoning": "Brief explanation",
  "keywords": ["list", "of", "relevant", "keywords", "found"]
}

IMPORTANT:
- Owner financing means the SELLER provides the loan, not a bank
- "Preferred lender" or "lock in your rate" means traditional bank financing, NOT owner financing
- "Creative financing" alone without explicit owner/seller mention is ambiguous
- Look for: "owner financing", "seller financing", "owner carry", "seller carry", "rent to own", "lease option", "contract for deed", "land contract", "no bank qualifying"
- Reject if: "no owner financing", "cash only", "conventional only", "must qualify for loan"`
    }]
  });

  try {
    const text = response.choices[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse AI response');
  }

  return {
    isOwnerFinancing: false,
    confidence: 'low',
    reasoning: 'Failed to analyze',
    keywords: []
  };
}

async function main() {
  console.log('='.repeat(70));
  console.log('🤖 AI FILTER ACCURACY CHECK');
  console.log('='.repeat(70));
  console.log('');

  // Focus on zillow_imports - these are properties SHOWING TO BUYERS
  // We want to verify these are all real owner financing deals
  const zillowSnapshot = await db.collection('zillow_imports')
    .orderBy('importedAt', 'desc')
    .limit(250)
    .get();

  console.log(`Found ${zillowSnapshot.size} zillow_imports (properties showing to buyers)\n`);

  // Collect properties with descriptions to analyze
  const propertiesToCheck: PropertyToCheck[] = [];

  for (const doc of zillowSnapshot.docs) {
    const data = doc.data();
    const description = data.description || '';

    if (description && description.length > 50) {
      const filterResult = hasStrictOwnerFinancing(description);
      const negativeResult = hasNegativeFinancing(description);

      propertiesToCheck.push({
        id: doc.id,
        address: data.fullAddress || data.address || 'Unknown',
        description,
        filterResult,
        negativeResult,
        collection: 'zillow_imports',
        source: data.source || 'unknown',
        agentConfirmed: data.agentConfirmedOwnerFinance || false
      } as any);
    }
  }

  console.log(`Total properties to analyze: ${propertiesToCheck.length}\n`);
  console.log('='.repeat(70));

  // Analyze sample with AI
  const sampleSize = Math.min(200, propertiesToCheck.length);
  const sample = propertiesToCheck.slice(0, sampleSize);

  let filterCorrect = 0;
  let filterWrong = 0;
  let falsePositives: any[] = [];  // Filter said yes but AI says no
  let falseNegatives: any[] = [];  // Filter said no but AI says yes

  for (let i = 0; i < sample.length; i++) {
    const prop = sample[i];
    const propAny = prop as any;
    console.log(`\n[${i + 1}/${sampleSize}] ${prop.address}`);
    console.log(`   Source: ${propAny.source || 'unknown'}`);
    console.log(`   Agent Confirmed: ${propAny.agentConfirmed ? '✅ YES' : '❌ No'}`);
    console.log(`   Filter Result: ${prop.filterResult.passes ? '✅ PASS' : '❌ FAIL'}`);
    if (prop.filterResult.matchedKeywords.length > 0) {
      console.log(`   Matched Keywords: ${prop.filterResult.matchedKeywords.join(', ')}`);
    }
    console.log(`   Negative Keywords: ${prop.negativeResult ? '⚠️ YES' : '✓ No'}`);

    // Truncate description for display
    const shortDesc = prop.description.substring(0, 200).replace(/\n/g, ' ') + '...';
    console.log(`   Description: ${shortDesc}`);

    // Analyze with AI
    console.log('   🤖 Analyzing with AI...');
    const aiResult = await analyzeWithAI(prop.description);

    console.log(`   AI Result: ${aiResult.isOwnerFinancing ? '✅ YES' : '❌ NO'} (${aiResult.confidence} confidence)`);
    console.log(`   AI Reasoning: ${aiResult.reasoning}`);
    if (aiResult.keywords.length > 0) {
      console.log(`   AI Keywords: ${aiResult.keywords.join(', ')}`);
    }

    // Compare filter vs AI
    const filterSaysYes = prop.filterResult.passes && !prop.negativeResult;
    const aiSaysYes = aiResult.isOwnerFinancing;

    if (filterSaysYes === aiSaysYes) {
      filterCorrect++;
      console.log('   ✅ FILTER ACCURATE');
    } else if (filterSaysYes && !aiSaysYes) {
      filterWrong++;
      falsePositives.push({
        address: prop.address,
        collection: prop.collection,
        filterKeywords: prop.filterResult.matchedKeywords,
        aiReasoning: aiResult.reasoning,
        description: prop.description.substring(0, 500)
      });
      console.log('   ⚠️  FALSE POSITIVE - Filter passed but AI says no owner financing');
    } else if (!filterSaysYes && aiSaysYes) {
      filterWrong++;
      falseNegatives.push({
        address: prop.address,
        collection: prop.collection,
        aiKeywords: aiResult.keywords,
        aiReasoning: aiResult.reasoning,
        description: prop.description.substring(0, 500)
      });
      console.log('   ⚠️  FALSE NEGATIVE - Filter failed but AI found owner financing');
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 ACCURACY SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total analyzed: ${sampleSize}`);
  console.log(`Filter correct: ${filterCorrect} (${((filterCorrect/sampleSize)*100).toFixed(1)}%)`);
  console.log(`Filter wrong: ${filterWrong} (${((filterWrong/sampleSize)*100).toFixed(1)}%)`);
  console.log(`  - False positives: ${falsePositives.length}`);
  console.log(`  - False negatives: ${falseNegatives.length}`);

  if (falsePositives.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  FALSE POSITIVES (Filter too lenient)');
    console.log('='.repeat(70));
    falsePositives.forEach((fp, i) => {
      console.log(`\n${i + 1}. ${fp.address}`);
      console.log(`   Filter Keywords: ${fp.filterKeywords.join(', ')}`);
      console.log(`   AI Says: ${fp.aiReasoning}`);
      console.log(`   Description: ${fp.description}...`);
    });
  }

  if (falseNegatives.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  FALSE NEGATIVES (Filter too strict - MISSING DEALS)');
    console.log('='.repeat(70));
    falseNegatives.forEach((fn, i) => {
      console.log(`\n${i + 1}. ${fn.address}`);
      console.log(`   AI Found Keywords: ${fn.aiKeywords.join(', ')}`);
      console.log(`   AI Says: ${fn.aiReasoning}`);
      console.log(`   Description: ${fn.description}...`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ ANALYSIS COMPLETE');
  console.log('='.repeat(70));
}

main().then(() => process.exit(0)).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
