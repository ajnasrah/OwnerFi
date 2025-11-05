import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function checkAllAbdullahStatus() {
  console.log('🔍 Checking ALL Abdullah daily content statuses...\n');

  try {
    // Get all abdullah_queue items ordered by creation
    const abdullahSnapshot = await db.collection('abdullah_queue')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    console.log(`📹 Abdullah Queue - Last 20 workflows:\n`);

    const statusCounts: Record<string, number> = {};

    abdullahSnapshot.forEach((doc, index) => {
      const data = doc.data();
      const status = data.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      const createdDate = data.createdAt ? new Date(data.createdAt).toLocaleString() : 'Unknown';
      const updatedDate = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'Unknown';
      const hoursSinceCreated = data.createdAt ? ((Date.now() - data.createdAt) / (1000 * 60 * 60)).toFixed(1) : 'Unknown';
      const hoursSinceUpdated = data.updatedAt ? ((Date.now() - data.updatedAt) / (1000 * 60 * 60)).toFixed(1) : 'Unknown';

      const statusEmoji = status === 'completed' ? '✅' :
                          status === 'posted' ? '📤' :
                          status === 'heygen_processing' ? '🎥' :
                          status === 'submagic_processing' ? '✨' :
                          status === 'failed' ? '❌' :
                          status === 'pending' ? '⏳' : '❓';

      console.log(`${index + 1}. ${statusEmoji} ${doc.id}`);
      console.log(`   Status: ${status}`);
      console.log(`   Created: ${createdDate} (${hoursSinceCreated}h ago)`);
      console.log(`   Updated: ${updatedDate} (${hoursSinceUpdated}h ago)`);
      console.log(`   HeyGen ID: ${data.heygenVideoId || 'None'}`);
      console.log(`   Submagic ID: ${data.submagicProjectId || 'None'}`);
      console.log(`   Title: ${(data.title || 'No title').substring(0, 60)}...`);

      if (data.error) {
        console.log(`   ❌ Error: ${data.error}`);
      }
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('📊 STATUS BREAKDOWN');
    console.log('='.repeat(80));
    Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`${status}: ${count}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('💡 TROUBLESHOOTING');
    console.log('='.repeat(80));

    if (statusCounts['heygen_processing'] > 0) {
      console.log(`⚠️  ${statusCounts['heygen_processing']} workflows stuck in HeyGen processing`);
      console.log('   → Run: npx tsx scripts/unstick-workflows.ts');
    }

    if (statusCounts['submagic_processing'] > 0) {
      console.log(`⚠️  ${statusCounts['submagic_processing']} workflows stuck in Submagic processing`);
      console.log('   → Check Submagic API status or run unstick script');
    }

    if (statusCounts['failed'] > 0) {
      console.log(`❌ ${statusCounts['failed']} failed workflows`);
      console.log('   → Check error messages above');
    }

    if (statusCounts['pending'] > 0) {
      console.log(`⏳ ${statusCounts['pending']} pending workflows`);
      console.log('   → These are waiting to be processed');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllAbdullahStatus()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
