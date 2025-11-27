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

async function checkStatusChecks() {
  const snapshot = await db.collection('zillow_imports').get();

  let withUrl = 0;
  let withoutUrl = 0;
  let hasStatusCheck = 0;
  let noStatusCheck = 0;
  let checkedToday = 0;
  let checkedLast3Days = 0;
  let checkedLast7Days = 0;
  const neverChecked: string[] = [];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  snapshot.docs.forEach(doc => {
    const data = doc.data();

    if (data.url) {
      withUrl++;
      const lastCheck = data.lastStatusCheck?.toDate?.();

      if (lastCheck) {
        hasStatusCheck++;
        if (lastCheck >= today) checkedToday++;
        if (lastCheck >= threeDaysAgo) checkedLast3Days++;
        if (lastCheck >= sevenDaysAgo) checkedLast7Days++;
      } else {
        noStatusCheck++;
        neverChecked.push(data.fullAddress || data.streetAddress || doc.id);
      }
    } else {
      withoutUrl++;
    }
  });

  console.log('\n📊 ZILLOW STATUS CHECK ANALYSIS');
  console.log('='.repeat(50));
  console.log('Total properties:', snapshot.size);
  console.log('With URL (in rotation):', withUrl);
  console.log('Without URL (skipped):', withoutUrl);
  console.log('');
  console.log('STATUS CHECK COVERAGE:');
  console.log('  Has lastStatusCheck:', hasStatusCheck, '(' + (withUrl > 0 ? ((hasStatusCheck/withUrl)*100).toFixed(1) : 0) + '%)');
  console.log('  Never checked:', noStatusCheck, '(' + (withUrl > 0 ? ((noStatusCheck/withUrl)*100).toFixed(1) : 0) + '%)');
  console.log('');
  console.log('RECENCY:');
  console.log('  Checked today:', checkedToday);
  console.log('  Checked last 3 days:', checkedLast3Days);
  console.log('  Checked last 7 days:', checkedLast7Days);

  if (neverChecked.length > 0) {
    console.log('');
    console.log('⚠️  NEVER CHECKED (' + neverChecked.length + ' properties):');
    neverChecked.slice(0, 10).forEach(addr => console.log('  -', addr));
    if (neverChecked.length > 10) console.log('  ... and', neverChecked.length - 10, 'more');
  }

  process.exit(0);
}

checkStatusChecks().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
