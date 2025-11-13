#!/usr/bin/env tsx
import { populateBlogQueue } from './src/lib/blog-queue';

async function main() {
  console.log('📝 Populating OwnerFi blog queue with 3 test topics...\n');

  const items = await populateBlogQueue('ownerfi', 3, {
    daysApart: 0, // All scheduled for today for testing
  });

  console.log(`✅ Added ${items.length} topics to queue:\n`);
  items.forEach((item, i) => {
    console.log(`${i + 1}. ${item.topic}`);
    console.log(`   Pillar: ${item.pillar}`);
    console.log(`   Status: ${item.status}`);
    console.log(`   Scheduled: ${item.scheduledFor?.toLocaleString() || 'Now'}\n`);
  });
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
