import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

async function checkDuplicates() {
  console.log('=== CHECKING FOR DUPLICATES ===\n');

  // Check scraper_queue for duplicate URLs
  console.log('📋 SCRAPER_QUEUE DUPLICATES:');
  const queue = await db.collection('scraper_queue').get();

  const urlCounts: Record<string, number> = {};
  const zpidCounts: Record<string, number> = {};

  queue.docs.forEach(doc => {
    const d = doc.data();
    if (d.url) {
      urlCounts[d.url] = (urlCounts[d.url] || 0) + 1;
    }
    if (d.zpid) {
      zpidCounts[d.zpid] = (zpidCounts[d.zpid] || 0) + 1;
    }
  });

  const duplicateUrls = Object.entries(urlCounts).filter(([_, count]) => count > 1);
  const duplicateZpids = Object.entries(zpidCounts).filter(([_, count]) => count > 1);

  console.log(`  Total items: ${queue.size.toLocaleString()}`);
  console.log(`  Unique URLs: ${Object.keys(urlCounts).length.toLocaleString()}`);
  console.log(`  Duplicate URLs: ${duplicateUrls.length.toLocaleString()}`);
  console.log(`  Duplicate ZPIDs: ${duplicateZpids.length.toLocaleString()}`);

  if (duplicateUrls.length > 0) {
    console.log('\n  Top duplicate URLs:');
    duplicateUrls
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([url, count]) => {
        console.log(`    ${count}x: ${url.substring(0, 60)}...`);
      });
  }

  // Check zillow_imports for duplicates
  console.log('\n\n📥 ZILLOW_IMPORTS DUPLICATES:');
  const imports = await db.collection('zillow_imports').get();

  const importUrlCounts: Record<string, number> = {};
  const importZpidCounts: Record<string, number> = {};
  const importAddressCounts: Record<string, number> = {};

  imports.docs.forEach(doc => {
    const d = doc.data();
    if (d.url) {
      importUrlCounts[d.url] = (importUrlCounts[d.url] || 0) + 1;
    }
    if (d.zpid) {
      importZpidCounts[String(d.zpid)] = (importZpidCounts[String(d.zpid)] || 0) + 1;
    }
    if (d.address) {
      importAddressCounts[d.address.toLowerCase().trim()] = (importAddressCounts[d.address.toLowerCase().trim()] || 0) + 1;
    }
  });

  const dupImportUrls = Object.entries(importUrlCounts).filter(([_, count]) => count > 1);
  const dupImportZpids = Object.entries(importZpidCounts).filter(([_, count]) => count > 1);
  const dupImportAddresses = Object.entries(importAddressCounts).filter(([_, count]) => count > 1);

  console.log(`  Total items: ${imports.size.toLocaleString()}`);
  console.log(`  Unique URLs: ${Object.keys(importUrlCounts).length.toLocaleString()}`);
  console.log(`  Duplicate URLs: ${dupImportUrls.length.toLocaleString()}`);
  console.log(`  Duplicate ZPIDs: ${dupImportZpids.length.toLocaleString()}`);
  console.log(`  Duplicate Addresses: ${dupImportAddresses.length.toLocaleString()}`);

  if (dupImportAddresses.length > 0) {
    console.log('\n  Top duplicate addresses:');
    dupImportAddresses
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([addr, count]) => {
        console.log(`    ${count}x: ${addr}`);
      });
  }

  // Check overlap between queue and imports
  console.log('\n\n🔄 OVERLAP BETWEEN QUEUE AND IMPORTS:');
  const importUrls = new Set(Object.keys(importUrlCounts));
  const queueUrls = new Set(Object.keys(urlCounts));

  let overlapCount = 0;
  queueUrls.forEach(url => {
    if (importUrls.has(url)) overlapCount++;
  });

  console.log(`  URLs in both queue AND imports: ${overlapCount.toLocaleString()}`);
  console.log(`  These should have been skipped when adding to queue!`);

  // Check the deduplication logic in the code
  console.log('\n\n=== DIAGNOSIS ===');
  console.log(`
The deduplication should check:
1. Is URL already in scraper_queue? → Skip
2. Is URL already in zillow_imports? → Skip

But we have ${duplicateUrls.length} duplicate URLs in the queue itself.

This means either:
- The batch check function has a bug
- Multiple runs happened simultaneously
- The recovery script didn't check properly
`);
}

checkDuplicates();
