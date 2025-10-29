#!/usr/bin/env tsx
/**
 * Export Analytics Data
 *
 * Exports performance data to CSV for external analysis
 * (Excel, Google Sheets, data visualization tools)
 *
 * Usage:
 *   npx tsx scripts/export-analytics.ts
 *   npx tsx scripts/export-analytics.ts --brand carz --days 30
 *   npx tsx scripts/export-analytics.ts --format json
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync } from 'fs';

config({ path: resolve(process.cwd(), '.env.local') });

const { adminDb } = require('../src/lib/firebase-admin');

async function exportAnalytics(
  brand?: string,
  days: number = 7,
  format: 'csv' | 'json' = 'csv'
): Promise<void> {
  console.log(`\n📤 Exporting analytics data...`);
  console.log(`   Brand: ${brand || 'ALL'}`);
  console.log(`   Period: Last ${days} days`);
  console.log(`   Format: ${format.toUpperCase()}\n`);

  // Query analytics collection
  let query: any = adminDb.collection('workflow_analytics');

  if (brand) {
    query = query.where('brand', '==', brand);
  }

  const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
  query = query.where('lastUpdated', '>=', cutoffDate);

  const snapshot = await query.get();

  if (snapshot.empty) {
    console.log('⚠️  No data to export. Run: npx tsx scripts/collect-analytics-data.ts');
    return;
  }

  console.log(`   Found ${snapshot.size} records\n`);

  const data: any[] = [];

  snapshot.forEach(doc => {
    const d = doc.data();

    // Flatten platform metrics
    const platformData: any = {};
    if (d.platformMetrics) {
      Object.entries(d.platformMetrics).forEach(([platform, metrics]: [string, any]) => {
        platformData[`${platform}_views`] = metrics.views || 0;
        platformData[`${platform}_likes`] = metrics.likes || 0;
        platformData[`${platform}_comments`] = metrics.comments || 0;
        platformData[`${platform}_shares`] = metrics.shares || 0;
        platformData[`${platform}_engagement`] = metrics.engagement_rate || 0;
      });
    }

    data.push({
      workflow_id: d.workflowId,
      late_post_id: d.latePostId,
      brand: d.brand,
      content_type: d.contentType,
      variant: d.variant || '',
      scheduled_time: d.scheduledTime,
      posted_time: d.postedTime || '',
      time_slot: d.timeSlot,
      day_of_week: d.dayOfWeek,
      hook: (d.hook || '').replace(/"/g, '""'), // Escape quotes for CSV
      hook_type: d.hookType || '',
      caption: (d.caption || '').substring(0, 200).replace(/"/g, '""'),
      total_views: d.totalViews,
      total_likes: d.totalLikes,
      total_comments: d.totalComments,
      total_shares: d.totalShares,
      total_saves: d.totalSaves,
      engagement_rate: d.overallEngagementRate.toFixed(2),
      ...platformData
    });
  });

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `analytics_${brand || 'all'}_${timestamp}.${format}`;

  if (format === 'csv') {
    // Convert to CSV
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          // Quote strings that contain commas
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    writeFileSync(filename, csvContent, 'utf-8');
  } else {
    // Export as JSON
    writeFileSync(filename, JSON.stringify(data, null, 2), 'utf-8');
  }

  console.log(`✅ Exported to: ${filename}`);
  console.log(`   Records: ${data.length}\n`);

  console.log('📊 You can now:');
  console.log('  • Open in Excel/Google Sheets for analysis');
  console.log('  • Import into data visualization tools');
  console.log('  • Build custom reports and charts');
  console.log('  • Share with your team\n');
}

async function main() {
  const args = process.argv.slice(2);

  const brandArg = args.find(arg => arg.startsWith('--brand='));
  const daysArg = args.find(arg => arg.startsWith('--days='));
  const formatArg = args.find(arg => arg.startsWith('--format='));

  const brand = brandArg?.split('=')[1];
  const days = daysArg ? parseInt(daysArg.split('=')[1]) : 7;
  const format = (formatArg?.split('=')[1] || 'csv') as 'csv' | 'json';

  await exportAnalytics(brand, days, format);
}

main().catch(console.error);
