/**
 * Verify Zillow scraper → GoHighLevel pipeline
 * Check if ALL scraped properties with contact info are being sent to GHL
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

const db = getFirestore(app);

async function verifyPipeline() {
  console.log('🔍 ZILLOW → GHL PIPELINE VERIFICATION');
  console.log('======================================\n');

  try {
    // 1. Get all zillow_imports
    console.log('📊 Loading zillow_imports collection...');
    const importsSnapshot = await getDocs(collection(db, 'zillow_imports'));

    console.log(`   Total properties scraped: ${importsSnapshot.size}\n`);

    // Analyze properties
    let withContactInfo = 0;
    let sentToGHL = 0;
    let notSent = 0;
    let noContactInfo = 0;
    let sentSuccess = 0;
    let sentFailed = 0;

    const notSentProperties: any[] = [];
    const failedProperties: any[] = [];

    importsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const hasContact = !!(data.agentPhoneNumber || data.brokerPhoneNumber);

      if (hasContact) {
        withContactInfo++;

        if (data.sentToGHL === true) {
          sentToGHL++;

          if (data.ghlSendStatus === 'success') {
            sentSuccess++;
          } else if (data.ghlSendStatus === 'failed') {
            sentFailed++;
            failedProperties.push({
              id: doc.id,
              address: data.fullAddress || data.streetAddress,
              phone: data.agentPhoneNumber || data.brokerPhoneNumber,
              error: data.ghlSendError || 'Unknown error',
              scrapedAt: data.scrapedAt?.toDate?.() || data.importedAt?.toDate?.()
            });
          }
        } else {
          notSent++;
          notSentProperties.push({
            id: doc.id,
            address: data.fullAddress || data.streetAddress,
            phone: data.agentPhoneNumber || data.brokerPhoneNumber,
            scrapedAt: data.scrapedAt?.toDate?.() || data.importedAt?.toDate?.()
          });
        }
      } else {
        noContactInfo++;
      }
    });

    // 2. Display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PIPELINE ANALYSIS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Total scraped properties: ${importsSnapshot.size}`);
    console.log(`   ✅ With contact info: ${withContactInfo} (${Math.round(withContactInfo/importsSnapshot.size*100)}%)`);
    console.log(`   ⚠️  No contact info: ${noContactInfo} (${Math.round(noContactInfo/importsSnapshot.size*100)}%)\n`);

    console.log(`Properties with contact info breakdown:`);
    console.log(`   ✅ Sent to GHL: ${sentToGHL} (${Math.round(sentToGHL/withContactInfo*100)}%)`);
    console.log(`      ├─ Success: ${sentSuccess}`);
    console.log(`      └─ Failed: ${sentFailed}`);
    console.log(`   ❌ NOT sent: ${notSent} (${Math.round(notSent/withContactInfo*100)}%)\n`);

    // 3. Show unsent properties
    if (notSent > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`❌ ${notSent} PROPERTIES NOT SENT TO GHL:`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const recent = notSentProperties
        .sort((a, b) => (b.scrapedAt?.getTime() || 0) - (a.scrapedAt?.getTime() || 0))
        .slice(0, 10);

      recent.forEach((prop, idx) => {
        console.log(`${idx + 1}. ${prop.address}`);
        console.log(`   Phone: ${prop.phone}`);
        console.log(`   Scraped: ${prop.scrapedAt?.toLocaleString() || 'Unknown'}`);
        console.log(`   Firebase ID: ${prop.id}\n`);
      });

      if (notSent > 10) {
        console.log(`   ... and ${notSent - 10} more\n`);
      }

      console.log('💡 ISSUE: Properties scraped but NOT sent to GHL');
      console.log('   Possible causes:');
      console.log('   1. process-scraper-queue cron sends immediately (working)');
      console.log('   2. Manual send-to-ghl endpoint not being called');
      console.log('   3. Properties scraped via upload/scraper job (not via queue)\n');
    }

    // 4. Show failed properties
    if (sentFailed > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`⚠️  ${sentFailed} PROPERTIES FAILED TO SEND:`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      failedProperties.slice(0, 5).forEach((prop, idx) => {
        console.log(`${idx + 1}. ${prop.address}`);
        console.log(`   Error: ${prop.error}`);
        console.log(`   Phone: ${prop.phone}\n`);
      });

      if (sentFailed > 5) {
        console.log(`   ... and ${sentFailed - 5} more\n`);
      }
    }

    // 5. Check scraper queue
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 SCRAPER QUEUE STATUS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const queueSnapshot = await getDocs(collection(db, 'scraper_queue'));
    const pendingQueue = queueSnapshot.docs.filter(doc => doc.data().status === 'pending').length;
    const processingQueue = queueSnapshot.docs.filter(doc => doc.data().status === 'processing').length;
    const completedQueue = queueSnapshot.docs.filter(doc => doc.data().status === 'completed').length;

    console.log(`   Total queue items: ${queueSnapshot.size}`);
    console.log(`   Pending: ${pendingQueue}`);
    console.log(`   Processing: ${processingQueue}`);
    console.log(`   Completed: ${completedQueue}\n`);

    // 6. Check scraper jobs
    const jobsSnapshot = await getDocs(collection(db, 'scraper_jobs'));
    const pendingJobs = jobsSnapshot.docs.filter(doc => doc.data().status === 'pending').length;
    const processingJobs = jobsSnapshot.docs.filter(doc => doc.data().status === 'processing').length;
    const completedJobs = jobsSnapshot.docs.filter(doc => doc.data().status === 'complete').length;

    console.log(`   Total scraper jobs: ${jobsSnapshot.size}`);
    console.log(`   Pending: ${pendingJobs}`);
    console.log(`   Processing: ${processingJobs}`);
    console.log(`   Completed: ${completedJobs}\n`);

    // 7. Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (notSent === 0 && sentFailed === 0) {
      console.log('✅ PIPELINE IS WORKING PERFECTLY!');
      console.log('   All properties with contact info were sent to GHL\n');
    } else {
      if (notSent > 0) {
        console.log(`❌ ISSUE: ${notSent} properties with contact info NOT sent`);
        console.log('   ACTION: Run /api/admin/zillow-imports/send-to-ghl to send them\n');
      }
      if (sentFailed > 0) {
        console.log(`⚠️  WARNING: ${sentFailed} properties failed to send`);
        console.log('   ACTION: Check GHL webhook URL and retry\n');
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyPipeline().catch(console.error);
