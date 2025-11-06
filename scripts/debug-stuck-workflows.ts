/**
 * Debug stuck workflows - check their Submagic status directly
 */

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

// Workflow IDs from the screenshot
const STUCK_WORKFLOWS = [
  { id: '0ccf44a83d32...', brand: 'ownerfi' },
  { id: 'aa14f55d09c6...', brand: 'ownerfi' },
  { id: 'a15febd9e717...', brand: 'ownerfi' },
  { id: '34d2f0e3e9b3...', brand: 'ownerfi' },
  { id: '24775fb43c65...', brand: 'ownerfi' },
  { id: 'bac8b549a4de...', brand: 'ownerfi' }
];

async function debugStuckWorkflows() {
  console.log('🔍 Debugging stuck Submagic workflows...\n');

  if (!SUBMAGIC_API_KEY) {
    console.error('❌ SUBMAGIC_API_KEY not set');
    return;
  }

  // First, query all buyer workflows in submagic_processing
  const collectionName = 'ownerfi_workflow_queue';

  try {
    const q = query(
      collection(db, collectionName),
      where('status', '==', 'submagic_processing')
    );

    const snapshot = await getDocs(q);
    console.log(`📦 Found ${snapshot.size} workflows in submagic_processing\n`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const submagicId = data.submagicVideoId || data.submagicProjectId;
      const timestamp = data.statusChangedAt || data.updatedAt || 0;
      const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

      console.log('━'.repeat(80));
      console.log(`Workflow: ${doc.id}`);
      console.log(`  Target: ${data.target || 'N/A'}`);
      console.log(`  Title: ${data.title || 'N/A'}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Stuck for: ${stuckMinutes} minutes (${Math.floor(stuckMinutes / 60)}h ${stuckMinutes % 60}m)`);
      console.log(`  Submagic ID: ${submagicId || 'MISSING'}`);
      console.log(`  Created: ${new Date(data.createdAt || 0).toLocaleString()}`);
      console.log(`  Updated: ${new Date(timestamp).toLocaleString()}`);

      if (submagicId) {
        // Check Submagic API status
        try {
          console.log(`\n  🔍 Checking Submagic API...`);
          const response = await fetch(`https://api.submagic.co/v1/projects/${submagicId}`, {
            headers: { 'x-api-key': SUBMAGIC_API_KEY }
          });

          if (response.ok) {
            const submagicData = await response.json();
            console.log(`  Submagic Status: ${submagicData.status}`);
            console.log(`  Progress: ${submagicData.progress || 'N/A'}%`);
            console.log(`  Media URL: ${submagicData.media_url ? 'Available ✅' : 'Not ready'}`);
            console.log(`  Video URL: ${submagicData.video_url ? 'Available ✅' : 'Not ready'}`);
            console.log(`  Download URL: ${submagicData.downloadUrl ? 'Available ✅' : 'Not ready'}`);

            if (submagicData.status === 'completed' || submagicData.status === 'done' || submagicData.status === 'ready') {
              const downloadUrl = submagicData.media_url || submagicData.video_url || submagicData.downloadUrl;
              if (downloadUrl) {
                console.log(`  ✅ READY FOR COMPLETION! Download URL available.`);
              } else {
                console.log(`  ⚠️  Status is complete but no download URL - needs export trigger`);
              }
            }
          } else {
            console.log(`  ❌ Submagic API error: ${response.status}`);
            const text = await response.text();
            console.log(`  Error: ${text.substring(0, 200)}`);
          }
        } catch (apiError) {
          console.log(`  ❌ Error calling Submagic API:`, apiError instanceof Error ? apiError.message : apiError);
        }
      } else {
        console.log(`  ⚠️  NO SUBMAGIC ID - API call likely failed`);
      }

      console.log('');
    }

    console.log('━'.repeat(80));
    console.log('\n📊 SUMMARY');
    console.log(`Total stuck: ${snapshot.size}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugStuckWorkflows().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
