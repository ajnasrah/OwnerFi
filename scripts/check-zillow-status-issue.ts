import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function check() {
  const snap = await db.collection('zillow_imports').get();
  console.log('Total properties:', snap.size);

  const statusCounts: Record<string, number> = {};
  let noUrlCount = 0;
  const lastChecked = { never: 0, over7days: 0, under7days: 0, over3days: 0 };
  const now = Date.now();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  // Track properties that should be deleted but aren't
  const inactiveButStillHere: Array<{address: string, status: string, lastCheck: string}> = [];
  const inactiveStatuses = ['PENDING', 'SOLD', 'RECENTLY_SOLD', 'OFF_MARKET', 'FOR_RENT', 'CONTINGENT'];

  snap.forEach(doc => {
    const data = doc.data();
    const status = data.homeStatus || 'NO_STATUS';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (!data.url) noUrlCount++;

    const lastCheck = data.lastStatusCheck?.toDate?.()?.getTime();
    if (!lastCheck) {
      lastChecked.never++;
    } else if (now - lastCheck > sevenDays) {
      lastChecked.over7days++;
    } else if (now - lastCheck > threeDays) {
      lastChecked.over3days++;
    } else {
      lastChecked.under7days++;
    }

    // Check for properties that should be deleted
    if (inactiveStatuses.includes(status)) {
      inactiveButStillHere.push({
        address: data.fullAddress || data.streetAddress || 'Unknown',
        status,
        lastCheck: lastCheck ? new Date(lastCheck).toISOString() : 'never'
      });
    }
  });

  console.log('\n📊 Status distribution:');
  Object.entries(statusCounts).sort((a,b) => (b[1] as number) - (a[1] as number)).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  console.log('\n📋 Properties without URL:', noUrlCount);

  console.log('\n⏰ Last status check:');
  console.log('  Never checked:', lastChecked.never);
  console.log('  Over 7 days ago:', lastChecked.over7days);
  console.log('  3-7 days ago:', lastChecked.over3days);
  console.log('  Under 3 days ago:', lastChecked.under7days);

  if (inactiveButStillHere.length > 0) {
    console.log('\n🚨 PROBLEM: Properties with INACTIVE status still in database:');
    inactiveButStillHere.slice(0, 20).forEach(p => {
      console.log(`  ${p.address} - ${p.status} (last check: ${p.lastCheck})`);
    });
    if (inactiveButStillHere.length > 20) {
      console.log(`  ... and ${inactiveButStillHere.length - 20} more`);
    }
  }

  // Calculate how long to check all properties
  const propertiesWithUrls = snap.size - noUrlCount;
  const runsPerDay = 12; // every 2 hours
  const propertiesPerRun = 125;
  const daysToCheckAll = propertiesWithUrls / (runsPerDay * propertiesPerRun);
  console.log(`\n📈 At current rate (${propertiesPerRun}/run × ${runsPerDay} runs/day = ${runsPerDay * propertiesPerRun}/day):`);
  console.log(`  ${propertiesWithUrls} properties would take ~${daysToCheckAll.toFixed(1)} days to check all`);
}

check().catch(console.error);
