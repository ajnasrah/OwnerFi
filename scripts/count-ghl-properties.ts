import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('Missing Firebase credentials in environment variables');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = getFirestore(app);

async function countGHLProperties() {
  console.log('🔍 Counting properties sent to GoHighLevel...\n');

  try {
    // Get all documents from zillow_imports collection
    const snapshot = await db.collection('zillow_imports').get();

    let totalProperties = 0;
    let sentToGHL = 0;
    let sentSuccessfully = 0;
    let sentFailed = 0;
    let hasContactInfo = 0;
    let noContactInfo = 0;
    let pendingSync = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      totalProperties++;

      // Count properties with contact info
      if (data.agentPhoneNumber || data.brokerPhoneNumber) {
        hasContactInfo++;
      } else {
        noContactInfo++;
      }

      // Count properties sent to GHL
      if (data.sentToGHL === true) {
        sentToGHL++;

        // Check success status
        if (data.ghlSendStatus === 'success') {
          sentSuccessfully++;
        } else if (data.ghlSendStatus === 'failed') {
          sentFailed++;
        }
      } else {
        // Has contact but not sent yet
        if (data.agentPhoneNumber || data.brokerPhoneNumber) {
          pendingSync++;
        }
      }
    });

    // Print results
    console.log('📊 ZILLOW SCRAPER → GHL SYNC REPORT');
    console.log('='.repeat(60));
    console.log(`\n📦 TOTAL PROPERTIES IN DATABASE: ${totalProperties}`);
    console.log(`\n📞 CONTACT INFO BREAKDOWN:`);
    console.log(`   ✅ With Agent/Broker Phone: ${hasContactInfo} (${((hasContactInfo/totalProperties)*100).toFixed(1)}%)`);
    console.log(`   ❌ No Contact Info:         ${noContactInfo} (${((noContactInfo/totalProperties)*100).toFixed(1)}%)`);
    console.log(`\n🎯 GOHIGHLEVEL SYNC STATUS:`);
    console.log(`   ✅ Successfully Sent:       ${sentSuccessfully}`);
    console.log(`   ❌ Failed to Send:          ${sentFailed}`);
    console.log(`   ⏳ Pending Sync:            ${pendingSync}`);
    console.log(`   📊 Total Sent Attempts:     ${sentToGHL}`);
    console.log(`\n💡 INSIGHTS:`);
    console.log(`   • ${sentSuccessfully} properties are now in GoHighLevel`);
    console.log(`   • ${sentFailed} properties failed to sync (need retry)`);
    console.log(`   • ${pendingSync} properties ready but not yet sent`);
    console.log(`   • ${noContactInfo} properties can't be sent (no contact info)`);

    if (sentFailed > 0) {
      console.log(`\n⚠️  WARNING: ${sentFailed} properties failed to sync to GHL`);
      console.log(`   Run retry script: npx tsx scripts/resend-all-to-ghl.ts`);
    }

    if (pendingSync > 0) {
      console.log(`\n💡 TIP: ${pendingSync} properties are ready to send`);
      console.log(`   They will sync automatically on next cron run (every 15 min)`);
      console.log(`   Or manually trigger: POST /api/admin/zillow-imports/send-to-ghl`);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Total properties in GoHighLevel: ${sentSuccessfully}\n`);

    // Show sample of failed properties if any
    if (sentFailed > 0) {
      console.log('\n❌ FAILED PROPERTIES (Sample):');
      console.log('-'.repeat(60));

      const failedDocs = snapshot.docs.filter(doc =>
        doc.data().ghlSendStatus === 'failed'
      ).slice(0, 5);

      failedDocs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n${index + 1}. ${data.fullAddress || 'Unknown Address'}`);
        console.log(`   Error: ${data.ghlSendError || 'Unknown error'}`);
        console.log(`   Firebase ID: ${doc.id}`);
      });
    }

  } catch (error) {
    console.error('❌ Error counting properties:', error);
    process.exit(1);
  }
}

// Run the count
countGHLProperties()
  .then(() => {
    console.log('\n✅ Count completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
