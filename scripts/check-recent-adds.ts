import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function checkRecent() {
  // Get recent zillow imports - just order by importedAt
  const zillowSnap = await db.collection('zillow_imports')
    .orderBy('importedAt', 'desc')
    .limit(300)
    .get();

  // Get recent cash houses
  const cashSnap = await db.collection('cash_houses')
    .orderBy('importedAt', 'desc')
    .limit(300)
    .get();

  // Group by run time (within same minute = same run)
  const zillowRuns = new Map<string, number>();
  const zillowOwnerFinanceRuns = new Map<string, number>();
  zillowSnap.docs.forEach(doc => {
    const d = doc.data();
    const date = d.importedAt?.toDate?.() || new Date(d.importedAt);
    const key = date.toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
    zillowRuns.set(key, (zillowRuns.get(key) || 0) + 1);
    if (d.ownerFinanceVerified === true) {
      zillowOwnerFinanceRuns.set(key, (zillowOwnerFinanceRuns.get(key) || 0) + 1);
    }
  });

  const cashRuns = new Map<string, number>();
  cashSnap.docs.forEach(doc => {
    const d = doc.data();
    const date = d.importedAt?.toDate?.() || new Date(d.importedAt);
    const key = date.toISOString().substring(0, 16);
    cashRuns.set(key, (cashRuns.get(key) || 0) + 1);
  });

  console.log('=== ZILLOW IMPORTS - Recent Runs ===');
  const zillowSorted = [...zillowRuns.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  zillowSorted.slice(0, 15).forEach(([datetime, count]) => {
    const d = new Date(datetime);
    const ownerFinance = zillowOwnerFinanceRuns.get(datetime) || 0;
    console.log(`  ${d.toLocaleDateString()} ${d.toLocaleTimeString()}: ${count} total (${ownerFinance} owner finance)`);
  });

  console.log('\n=== CASH HOUSES - Recent Runs ===');
  const cashSorted = [...cashRuns.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  cashSorted.slice(0, 15).forEach(([datetime, count]) => {
    const d = new Date(datetime);
    console.log(`  ${d.toLocaleDateString()} ${d.toLocaleTimeString()}: ${count} properties`);
  });

  // Calculate since last run
  console.log('\n=== SUMMARY ===');
  if (zillowSorted.length >= 1) {
    const lastRun = zillowSorted[0];
    const lastOwnerFinance = zillowOwnerFinanceRuns.get(lastRun[0]) || 0;
    const lastDate = new Date(lastRun[0]);
    console.log(`Zillow Last Run: ${lastDate.toLocaleDateString()} ${lastDate.toLocaleTimeString()}`);
    console.log(`  -> Added ${lastRun[1]} total properties (${lastOwnerFinance} owner finance verified)`);
  }

  if (cashSorted.length >= 1) {
    const lastRun = cashSorted[0];
    const lastDate = new Date(lastRun[0]);
    console.log(`Cash Deals Last Run: ${lastDate.toLocaleDateString()} ${lastDate.toLocaleTimeString()}`);
    console.log(`  -> Added ${lastRun[1]} properties`);
  }

  process.exit(0);
}

checkRecent();
