import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = getFirestore();

console.log('🔍 DIAGNOSING PRODUCTION SYSTEM\n');

// Check recent jobs
console.log('1. RECENT SCRAPER JOBS (last 5):');
const jobs = await db.collection('scraper_jobs')
  .orderBy('createdAt', 'desc')
  .limit(5)
  .get();

if (jobs.empty) {
  console.log('   NO JOBS FOUND\n');
} else {
  jobs.forEach(doc => {
    const data = doc.data();
    console.log(`   Job ${doc.id}:`);
    console.log(`     Status: ${data.status}`);
    console.log(`     Total: ${data.total}`);
    console.log(`     Imported: ${data.imported || 0}`);
    console.log(`     Created: ${data.createdAt?.toDate?.()}`);
    console.log(`     Started: ${data.startedAt?.toDate?.() || 'N/A'}`);
    console.log(`     Completed: ${data.completedAt?.toDate?.() || 'N/A'}`);
    console.log(`     URLs count: ${data.urls?.length || 0}`);
    if (data.urls && data.urls.length > 0) {
      console.log(`     First URL: ${data.urls[0]}`);
    }
    console.log('');
  });
}

// Check recent imports
console.log('2. RECENT ZILLOW IMPORTS (last 5):');
const imports = await db.collection('zillow_imports')
  .orderBy('importedAt', 'desc')
  .limit(5)
  .get();

if (imports.empty) {
  console.log('   NO IMPORTS FOUND\n');
} else {
  imports.forEach((doc, idx) => {
    const data = doc.data();
    console.log(`   Import ${idx + 1} (${doc.id}):`);
    console.log(`     Street: ${data.streetAddress || 'MISSING'}`);
    console.log(`     Agent Name: ${data.agentName || 'MISSING'}`);
    console.log(`     Agent Phone: ${data.agentPhoneNumber || 'MISSING'}`);
    console.log(`     Broker Phone: ${data.brokerPhoneNumber || 'MISSING'}`);
    console.log(`     Images array: ${data.propertyImages?.length || 0}`);
    console.log(`     First Image: ${data.firstPropertyImage ? 'EXISTS' : 'MISSING'}`);
    console.log(`     Source: ${data.source}`);
    console.log(`     Imported: ${data.importedAt?.toDate?.()}`);
    console.log('');
  });
}

// Check if cron has run recently by looking at job timestamps
console.log('3. SYSTEM STATUS:');
const recentJobs = jobs.docs.filter(d => d.data().status === 'processing' || d.data().status === 'complete');
if (recentJobs.length > 0) {
  const latest = recentJobs[0].data();
  console.log(`   Latest processed job: ${latest.status}`);
  if (latest.startedAt) {
    const timeSinceStart = Date.now() - latest.startedAt.toDate().getTime();
    console.log(`   Time since start: ${Math.round(timeSinceStart / 1000)}s ago`);
  }
}

// Summary
const allImports = await db.collection('zillow_imports').get();
const withPhone = allImports.docs.filter(d => d.data().agentPhoneNumber).length;
const withImages = allImports.docs.filter(d => d.data().firstPropertyImage).length;
console.log(`\n4. OVERALL STATS:`);
console.log(`   Total imports: ${allImports.size}`);
console.log(`   With phone: ${withPhone} (${allImports.size > 0 ? Math.round(withPhone/allImports.size*100) : 0}%)`);
console.log(`   With images: ${withImages} (${allImports.size > 0 ? Math.round(withImages/allImports.size*100) : 0}%)`);

process.exit(0);
