import admin from 'firebase-admin';
import { config } from 'dotenv';

config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function fixBuyerWorkflows() {
  console.log('🔧 Finding and fixing stuck buyer workflows...\n');

  // Get all buyer workflows without any ordering (no index needed)
  const snapshot = await db.collection('buyer')
    .where('status', '==', 'submagic_processing')
    .limit(20)
    .get();

  console.log(`Found ${snapshot.size} workflows in submagic_processing\n`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const created = data.createdAt?.toDate();
    const hoursAgo = created ? Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60)) : 0;

    console.log(`\n📄 ${doc.id}`);
    console.log(`   Title: ${data.title}`);
    console.log(`   Created: ${hoursAgo}h ago`);
    console.log(`   HeyGen ID: ${data.heygenVideoId}`);
    console.log(`   Submagic ID: ${data.submagicVideoId || 'MISSING'}`);

    if (!data.submagicVideoId) {
      console.log(`   ❌ Missing Submagic ID - triggering webhook manually...`);

      // Call the complete workflow endpoint
      const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.ownerfi.com'}/api/workflow/complete-viral`;

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workflowId: doc.id,
            brand: 'buyer',
            videoUrl: data.videoUrl,
            force: true
          })
        });

        if (response.ok) {
          console.log(`   ✅ Triggered recovery webhook`);
        } else {
          const text = await response.text();
          console.log(`   ⚠️ Webhook failed: ${response.status} - ${text}`);
        }
      } catch (error) {
        console.log(`   ⚠️ Error: ${error}`);
      }
    } else if (hoursAgo > 2) {
      console.log(`   🔄 Has Submagic ID but stuck for ${hoursAgo}h - checking Submagic status...`);

      // Check Submagic status
      try {
        const response = await fetch(`https://api.submagic.co/api/v1/caption/${data.submagicVideoId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.SUBMAGIC_API_KEY}`,
          }
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`   Submagic status: ${result.status}`);

          if (result.status === 'completed' || result.status === 'success') {
            console.log(`   ✅ Video is ready! Updating workflow...`);

            await doc.ref.update({
              status: 'submagic_completed',
              submagicStatus: result.status,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`   ✅ Updated to submagic_completed`);
          } else if (result.status === 'failed' || result.status === 'error') {
            console.log(`   ❌ Submagic failed - marking as failed`);

            await doc.ref.update({
              status: 'failed',
              error: `Submagic processing failed: ${result.status}`,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      } catch (error) {
        console.log(`   ⚠️ Could not check Submagic: ${error}`);
      }
    } else {
      console.log(`   ⏳ Still processing (${hoursAgo}h) - giving it more time`);
    }
  }

  console.log('\n✅ Done!');
}

fixBuyerWorkflows().catch(console.error);
