#!/usr/bin/env tsx
/**
 * Analytics Data Collection Script
 *
 * Collects performance data from Late.dev and stores it in Firestore
 * for analysis of: time slots, content types, hooks, platforms, etc.
 *
 * Usage:
 *   npx tsx scripts/collect-analytics-data.ts
 *   npx tsx scripts/collect-analytics-data.ts --brand carz --days 14
 *   npx tsx scripts/collect-analytics-data.ts --all
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

// Import after env is loaded
const { syncBrandAnalytics, syncAllBrandAnalytics } = require('../src/lib/late-analytics');

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const brandArg = args.find(arg => arg.startsWith('--brand='));
  const daysArg = args.find(arg => arg.startsWith('--days='));
  const allFlag = args.includes('--all');

  const brand = brandArg?.split('=')[1] as 'carz' | 'ownerfi' | 'podcast' | 'vassdistro' | 'abdullah';
  const days = daysArg ? parseInt(daysArg.split('=')[1]) : 7;

  console.log('📊 Analytics Data Collection\n');
  console.log('══════════════════════════════════════════\n');

  if (allFlag) {
    console.log(`Collecting analytics for ALL brands (last ${days} days)...\n`);
    await syncAllBrandAnalytics(days);
  } else if (brand) {
    console.log(`Collecting analytics for ${brand.toUpperCase()} (last ${days} days)...\n`);
    await syncBrandAnalytics(brand, days);
  } else {
    // Default: sync all brands for last 7 days
    console.log(`Collecting analytics for ALL brands (last ${days} days)...\n`);
    await syncAllBrandAnalytics(days);
  }

  console.log('\n══════════════════════════════════════════');
  console.log('✅ Analytics collection complete!');
  console.log('══════════════════════════════════════════\n');

  console.log('📈 Next steps:');
  console.log('  • View reports: npx tsx scripts/analytics-report.ts');
  console.log('  • Export data: npx tsx scripts/export-analytics.ts');
  console.log('  • Check Firestore: "workflow_analytics" collection\n');
}

main().catch(console.error);
