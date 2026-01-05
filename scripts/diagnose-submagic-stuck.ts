#!/usr/bin/env tsx
/**
 * Diagnose SubMagic stuck workflows
 * Check all brands for stuck submagic_processing videos
 */

import { getAdminDb } from '../src/lib/firebase-admin';

const brands = ['carz', 'ownerfi', 'benefit', 'abdullah', 'personal', 'gaza'];

async function checkSubMagicStatus(projectId: string, SUBMAGIC_API_KEY: string) {
  try {
    const response = await fetch(
      `https://api.submagic.co/v1/projects/${projectId}`,
      { headers: { 'x-api-key': SUBMAGIC_API_KEY } }
    );

    if (!response.ok) {
      return { error: `HTTP ${response.status}`, raw: await response.text() };
    }

    const data = await response.json();
    console.log(`\n   📋 Raw SubMagic API Response:`);
    console.log(JSON.stringify(data, null, 2));

    return data;
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function main() {
  const db = await getAdminDb();

  if (!db) {
    console.error('❌ Failed to initialize Firebase Admin');
    process.exit(1);
  }

  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY!;

  if (!SUBMAGIC_API_KEY) {
    console.error('❌ SUBMAGIC_API_KEY not set');
    process.exit(1);
  }

  console.log('🔍 Checking all brands for stuck SubMagic workflows...\n');

  for (const brand of brands) {
    const collectionName = brand === 'property' ? 'property_videos' : `${brand}_workflow_queue`;

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📂 ${brand.toUpperCase()} - ${collectionName}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const snapshot = await db.collection(collectionName)
      .where('status', '==', 'submagic_processing')
      .limit(5)
      .get();

    if (snapshot.empty) {
      console.log('   ✅ No stuck workflows');
      continue;
    }

    console.log(`   ⚠️  Found ${snapshot.size} stuck in submagic_processing\n`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const workflowId = doc.id;
      const projectId = data.submagicVideoId || data.submagicProjectId;
      const stuckHours = Math.round((Date.now() - (data.updatedAt || data.createdAt || 0)) / 3600000);

      console.log(`   📄 Workflow: ${workflowId}`);
      console.log(`      Stuck for: ${stuckHours} hours`);
      console.log(`      SubMagic Project ID: ${projectId || 'MISSING!!!'}`);
      console.log(`      Status in DB: ${data.status}`);

      if (projectId) {
        console.log(`\n      🔍 Checking SubMagic API...`);
        const apiStatus = await checkSubMagicStatus(projectId, SUBMAGIC_API_KEY);

        if (apiStatus.error) {
          console.log(`      ❌ API Error: ${apiStatus.error}`);
        } else {
          console.log(`      📊 SubMagic Status: ${apiStatus.status || 'MISSING'}`);
          console.log(`      📹 Has media_url: ${!!apiStatus.media_url}`);
          console.log(`      📹 Has video_url: ${!!apiStatus.video_url}`);
          console.log(`      📹 Has download_url: ${!!apiStatus.download_url}`);
          console.log(`      📹 Has export_url: ${!!apiStatus.export_url}`);

          // Check if the workflow should have been completed
          if (apiStatus.status === 'completed' || apiStatus.status === 'done' || apiStatus.status === 'ready') {
            const downloadUrl = apiStatus.media_url || apiStatus.video_url || apiStatus.download_url || apiStatus.export_url;

            if (downloadUrl) {
              console.log(`      ✅ VIDEO IS READY! URL exists: ${downloadUrl.substring(0, 60)}...`);
              console.log(`      🚨 CRON SHOULD HAVE PROCESSED THIS!`);
            } else {
              console.log(`      ⚠️  Status is complete but NO download URL`);
              console.log(`      🔧 Need to call /export endpoint`);
            }
          }
        }
      }

      console.log('');
    }
  }

  // Also check property_videos separately
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📂 PROPERTY_VIDEOS (separate collection)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const propSnapshot = await db.collection('property_videos')
    .where('status', '==', 'submagic_processing')
    .limit(5)
    .get();

  if (propSnapshot.empty) {
    console.log('   ✅ No stuck workflows');
  } else {
    console.log(`   ⚠️  Found ${propSnapshot.size} stuck in submagic_processing`);
  }

  console.log('\n✅ Diagnosis complete\n');
}

main().catch(console.error);
