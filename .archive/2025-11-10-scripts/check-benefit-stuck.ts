/**
 * Check benefit workflows stuck at submagic_processing
 */

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

async function checkBenefitStuckWorkflows() {
  console.log('🔍 Checking benefit workflows stuck at submagic_processing...\n');

  if (!SUBMAGIC_API_KEY) {
    console.error('❌ SUBMAGIC_API_KEY not set');
    return;
  }

  try {
    // Query benefit workflows in submagic_processing status
    const q = query(
      collection(db, 'benefit_workflow_queue'),
      where('status', '==', 'submagic_processing'),
      orderBy('createdAt', 'desc'),
      firestoreLimit(20)
    );

    const snapshot = await getDocs(q);
    console.log(`📦 Found ${snapshot.size} benefit workflows in submagic_processing\n`);

    if (snapshot.size === 0) {
      console.log('✅ No workflows stuck!');
      return;
    }

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const submagicId = data.submagicVideoId || data.submagicProjectId;
      const timestamp = data.statusChangedAt || data.updatedAt || 0;
      const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);
      const stuckHours = Math.floor(stuckMinutes / 60);

      console.log('━'.repeat(80));
      console.log(`Workflow ID: ${doc.id}`);
      console.log(`  Audience: ${data.audience || 'N/A'} (${data.audience === 'buyer' ? '🏡 Buyer' : '💰 Seller'})`);
      console.log(`  Benefit: ${data.benefitTitle || 'N/A'}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Stuck for: ${stuckHours}h ${stuckMinutes % 60}m (${stuckMinutes} minutes)`);
      console.log(`  Submagic ID: ${submagicId || 'MISSING ❌'}`);
      console.log(`  Created: ${new Date(data.createdAt || 0).toLocaleString()}`);
      console.log(`  Updated: ${new Date(timestamp).toLocaleString()}`);

      if (submagicId) {
        // Check Submagic API status
        try {
          console.log(`\n  🔍 Checking Submagic API for project ${submagicId}...`);
          const response = await fetch(`https://api.submagic.co/v1/projects/${submagicId}`, {
            headers: { 'x-api-key': SUBMAGIC_API_KEY }
          });

          if (response.ok) {
            const submagicData = await response.json();
            console.log(`  📊 Submagic Status: ${submagicData.status}`);
            console.log(`  📈 Progress: ${submagicData.progress || 'N/A'}%`);

            const downloadUrl = submagicData.media_url || submagicData.video_url || submagicData.downloadUrl;
            if (downloadUrl) {
              console.log(`  ✅ Download URL: Available`);
              console.log(`  🎬 ${downloadUrl.substring(0, 80)}...`);
            } else {
              console.log(`  ⚠️  Download URL: Not ready`);
            }

            if (submagicData.status === 'completed' || submagicData.status === 'done' || submagicData.status === 'ready') {
              if (downloadUrl) {
                console.log(`\n  ✅✅✅ READY FOR COMPLETION! Can be recovered immediately.`);
              } else {
                console.log(`\n  ⚠️  Status is complete but no download URL - needs export trigger`);
              }
            } else {
              console.log(`\n  ⏳ Still processing on Submagic's end (${submagicData.status})`);
            }
          } else {
            console.log(`  ❌ Submagic API error: ${response.status}`);
            if (response.status === 404) {
              console.log(`  🚨 Project not found on Submagic - may need to be marked as failed`);
            }
            const text = await response.text();
            console.log(`  Error details: ${text.substring(0, 200)}`);
          }
        } catch (apiError) {
          console.log(`  ❌ Error calling Submagic API:`, apiError instanceof Error ? apiError.message : apiError);
        }
      } else {
        console.log(`\n  🚨 NO SUBMAGIC ID - API call likely failed, should be marked as failed`);
      }

      console.log('');
    }

    console.log('━'.repeat(80));
    console.log('\n📊 SUMMARY');
    console.log(`Total stuck: ${snapshot.size}`);

    const withSubmagicId = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.submagicVideoId || data.submagicProjectId;
    }).length;

    console.log(`With Submagic ID: ${withSubmagicId}`);
    console.log(`Missing Submagic ID: ${snapshot.size - withSubmagicId}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkBenefitStuckWorkflows().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
