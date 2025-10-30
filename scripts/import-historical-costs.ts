/**
 * Historical Cost Data Importer
 *
 * This script fetches historical usage data from all services and backfills
 * the cost tracking database with historical costs.
 *
 * Services:
 * - OpenAI: Uses /v1/organization/usage/completions and /v1/organization/costs
 * - HeyGen: Uses account usage history endpoint
 * - Submagic: Manual import from dashboard export (no API available)
 * - Late: Fixed monthly cost (no usage tracking)
 * - R2: Cloudflare R2 storage usage
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Brand } from '../src/config/constants';

// Load environment variables
config({ path: '.env.local' });

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

// Get API key from environment
const OPENAI_ADMIN_KEY = process.env.OPENAI_ADMIN_API_KEY || process.env.OPENAI_API_KEY;

// ============================================================================
// OpenAI Historical Data Import
// ============================================================================

interface OpenAIUsageBucket {
  object: string;
  start_time: number;
  end_time: number;
  start_time_iso: string;
  end_time_iso: string;
  results: Array<{
    object: string;
    input_tokens?: number;
    output_tokens?: number;
    input_cached_tokens?: number;
    num_model_requests?: number;
    project_id?: string;
    user_id?: string;
    api_key_id?: string;
    model?: string;
    batch?: boolean;
  }>;
}

interface OpenAICostBucket {
  start_time: number;
  end_time: number;
  results: Array<{
    object: string;
    amount: {
      value: number;
      currency: string;
    };
    line_item: string;
    project_id: string | null;
  }>;
}

/**
 * Fetch OpenAI usage data for a date range
 */
async function fetchOpenAIUsage(startDate: Date, endDate: Date): Promise<OpenAIUsageBucket[]> {
  const startTime = Math.floor(startDate.getTime() / 1000);
  const endTime = Math.floor(endDate.getTime() / 1000);

  const url = `https://api.openai.com/v1/organization/usage/completions?start_time=${startTime}&end_time=${endTime}&bucket_width=1d`;

  console.log(`📊 Fetching OpenAI usage from ${startDate.toISOString()} to ${endDate.toISOString()}...`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${OPENAI_ADMIN_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Usage API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Debug: log the response structure
  if (data.data && data.data.length > 0) {
    console.log('📋 Sample usage bucket:', JSON.stringify(data.data[0], null, 2));
  }

  return data.data || [];
}

/**
 * Fetch OpenAI cost data for a date range
 */
async function fetchOpenAICosts(startDate: Date, endDate: Date): Promise<OpenAICostBucket[]> {
  const startTime = Math.floor(startDate.getTime() / 1000);
  const endTime = Math.floor(endDate.getTime() / 1000);

  const url = `https://api.openai.com/v1/organization/costs?start_time=${startTime}&end_time=${endTime}&bucket_width=1d`;

  console.log(`💰 Fetching OpenAI costs from ${startDate.toISOString()} to ${endDate.toISOString()}...`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${OPENAI_ADMIN_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Costs API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Import OpenAI historical data into Firestore
 */
async function importOpenAIHistory(startDate: Date, endDate: Date, brand: Brand = 'ownerfi') {
  console.log(`\n🔄 Importing OpenAI history for ${brand}...`);

  try {
    // Fetch usage data
    const usageData = await fetchOpenAIUsage(startDate, endDate);
    console.log(`✅ Found ${usageData.length} usage buckets`);

    // Fetch cost data
    const costData = await fetchOpenAICosts(startDate, endDate);
    console.log(`✅ Found ${costData.length} cost buckets`);

    // Process each day
    for (const bucket of usageData) {
      const date = new Date(bucket.start_time * 1000);

      if (isNaN(date.getTime())) {
        console.warn(`⚠️  Skipping invalid timestamp: ${bucket.start_time}`);
        continue;
      }

      const dateStr = date.toISOString().split('T')[0];

      // Sum up all results for this bucket
      let inputTokens = 0;
      let outputTokens = 0;
      let requests = 0;

      for (const result of bucket.results) {
        inputTokens += result.input_tokens || 0;
        outputTokens += result.output_tokens || 0;
        requests += result.num_model_requests || 0;
      }

      // Skip if no usage
      if (inputTokens === 0 && outputTokens === 0) {
        console.log(`  📅 ${dateStr}: No usage`);
        continue;
      }

      // Calculate cost (GPT-4o-mini pricing)
      const inputCost = (inputTokens / 1_000_000) * 0.15;
      const outputCost = (outputTokens / 1_000_000) * 0.60;
      const totalCost = inputCost + outputCost;

      console.log(`  📅 ${dateStr}: ${requests} requests, ${inputTokens + outputTokens} tokens, $${totalCost.toFixed(4)}`);

      // Create cost entry
      const costEntry = {
        id: `${brand}_openai_${date.getTime()}_import`,
        timestamp: date.getTime(),
        brand,
        service: 'openai' as const,
        operation: 'api_calls',
        units: inputTokens + outputTokens,
        costUSD: totalCost,
        metadata: {
          inputTokens,
          outputTokens,
          requests,
          source: 'historical_import',
          importDate: Date.now(),
        },
      };

      // Save to cost_entries
      await db.collection('cost_entries').doc(costEntry.id).set(costEntry);

      // Update daily_costs
      const dailyDocId = `${brand}_${dateStr}`;

      await db.collection('daily_costs').doc(dailyDocId).set({
        date: dateStr,
        brand,
        heygen: { units: 0, costUSD: 0 },
        submagic: { units: 0, costUSD: 0 },
        late: { units: 0, costUSD: 0 },
        openai: { units: inputTokens + outputTokens, costUSD: totalCost },
        r2: { units: 0, costUSD: 0 },
        total: totalCost,
        updatedAt: Date.now(),
      }, { merge: true });

      // Update monthly_costs
      const monthStr = dateStr.substring(0, 7); // YYYY-MM
      const monthlyDocId = `${brand}_${monthStr}`;

      await db.collection('monthly_costs').doc(monthlyDocId).set({
        month: monthStr,
        brand,
        heygen: { units: 0, costUSD: 0 },
        submagic: { units: 0, costUSD: 0 },
        late: { units: 0, costUSD: 0 },
        openai: { units: inputTokens + outputTokens, costUSD: totalCost },
        r2: { units: 0, costUSD: 0 },
        total: totalCost,
        updatedAt: Date.now(),
      }, { merge: true });
    }

    console.log(`✅ OpenAI history import complete for ${brand}\n`);

  } catch (error) {
    console.error(`❌ Error importing OpenAI history:`, error);
    throw error;
  }
}

// ============================================================================
// HeyGen Historical Data Import
// ============================================================================

/**
 * Import HeyGen historical data
 * Note: HeyGen doesn't provide a direct API for historical usage.
 * We can infer from completed videos in our database.
 */
async function importHeyGenHistory(brand: Brand = 'ownerfi') {
  console.log(`\n🔄 Importing HeyGen history for ${brand}...`);
  console.log(`⚠️  HeyGen doesn't provide historical usage API.`);
  console.log(`💡 Suggestion: Check HeyGen dashboard → Settings → History → API Usage`);
  console.log(`   Export the data and we can import it manually.\n`);
}

// ============================================================================
// Main Import Function
// ============================================================================

async function main() {
  console.log('🚀 Starting Historical Cost Data Import\n');
  console.log('=' .repeat(60));

  // Date range: Last 60 days (OpenAI API limit)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 60);

  console.log(`📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  console.log('=' .repeat(60));

  // Import for all brands
  const brands: Brand[] = ['ownerfi', 'carz', 'vassdistro'];

  for (const brand of brands) {
    try {
      // OpenAI (all brands share the same OpenAI account)
      if (brand === 'ownerfi') {
        await importOpenAIHistory(startDate, endDate, brand);
      }

      // HeyGen (check dashboard for export)
      await importHeyGenHistory(brand);

    } catch (error) {
      console.error(`❌ Error importing data for ${brand}:`, error);
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log('✅ Historical import process complete!');
  console.log('=' .repeat(60));
  console.log('\n📊 Next Steps:');
  console.log('1. Check HeyGen dashboard → Settings → History → Export usage data');
  console.log('2. Check Submagic dashboard for usage export');
  console.log('3. Refresh the Cost Dashboard to see historical data');
  console.log('\n');
}

// Run the import
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
