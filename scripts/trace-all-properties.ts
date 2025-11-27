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

async function traceProperties() {
  console.log('=== TRACING ALL PROPERTIES ===\n');

  // Get all zillow_imports grouped by date and source
  const imports = await db.collection('zillow_imports')
    .orderBy('createdAt', 'desc')
    .get();

  const byDate: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  imports.docs.forEach(doc => {
    const d = doc.data();
    const date = d.createdAt?.toDate?.();
    if (date) {
      const dateKey = date.toLocaleDateString();
      byDate[dateKey] = (byDate[dateKey] || 0) + 1;
    }
    const source = d.source || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;
  });

  console.log('📥 zillow_imports BY DATE:');
  Object.entries(byDate)
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .slice(0, 15)
    .forEach(([date, count]) => {
      console.log(`  ${date}: ${count}`);
    });

  console.log('\n📥 zillow_imports BY SOURCE:');
  Object.entries(bySource)
    .sort((a, b) => b[1] - a[1])
    .forEach(([source, count]) => {
      console.log(`  ${source}: ${count}`);
    });

  // Show 5 most recent imports
  console.log('\n📋 MOST RECENT zillow_imports:');
  imports.docs.slice(0, 5).forEach((doc, i) => {
    const d = doc.data();
    const date = d.createdAt?.toDate?.() || 'Unknown';
    console.log(`${i+1}. ${d.address || 'No address'}`);
    console.log(`   Price: $${d.price?.toLocaleString() || '?'}`);
    console.log(`   Source: ${d.source || 'unknown'}`);
    console.log(`   Created: ${date}`);
  });

  // Check scraper_queue status breakdown
  console.log('\n\n=== SCRAPER QUEUE STATUS ===');
  const queueByStatus = await db.collection('scraper_queue').get();
  const statusCounts: Record<string, number> = {};
  queueByStatus.docs.forEach(doc => {
    const status = doc.data().status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count.toLocaleString()}`);
  });

  // Show what happened with the 36k scrape - check for any error logs
  console.log('\n\n=== UNDERSTANDING THE TIMELINE ===');
  console.log('');
  console.log('1. You had 1,129 owner finance properties in zillow_imports (accumulated over time)');
  console.log('2. The runaway scrape pulled 36k+ URLs from Zillow (using pagination mode)');
  console.log('3. Today, recover-apify-data.ts added 18,518 of those URLs to scraper_queue');
  console.log('4. But Apify monthly limit hit, so they cant be processed');
  console.log('5. The queue is now stuck with 18.5k unprocessed URLs');
}

traceProperties();
