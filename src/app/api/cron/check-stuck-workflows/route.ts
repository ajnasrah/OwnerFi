/**
 * CONSOLIDATED Stuck Workflows Cron
 *
 * Consolidates 4 separate cron jobs into ONE to reduce Vercel invocations by 75%:
 * 1. start-pending-workflows (pending status)
 * 2. check-stuck-heygen (heygen_processing status)
 * 3. check-stuck-submagic (submagic_processing status)
 * 4. check-stuck-posting (posting + video_processing status)
 *
 * Checks ALL 8 brands: carz, ownerfi, vassdistro, benefit, abdullah, personal, property, property-spanish
 * Plus: podcast_workflow_queue, propertyShowcaseWorkflows
 *
 * Schedule: every 30 minutes during active hours (14-23, 0-4 CST)
 * Previously: 4 crons × 34 runs/day = 136 invocations/day
 * Now: 1 cron × 34 runs/day = 34 invocations/day
 * SAVINGS: 102 fewer cron invocations per day (75% reduction)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronLock } from '@/lib/cron-lock';

const CRON_SECRET = process.env.CRON_SECRET;
export const maxDuration = 300; // 5 minutes (max needed for SubMagic + posting operations)

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [STUCK-WORKFLOWS] Consolidated check starting...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Use cron lock to prevent concurrent runs
    return withCronLock('check-stuck-workflows', async () => {
      const results = {
        pending: { checked: 0, started: 0, failed: 0 },
        heygen: { checked: 0, advanced: 0, failed: 0 },
        submagic: { checked: 0, completed: 0, failed: 0 },
        posting: { checked: 0, retried: 0, failed: 0 }
      };

      // 1. Check pending workflows (fastest ~10-30s)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('1️⃣  CHECKING PENDING WORKFLOWS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const pendingResults = await checkPendingWorkflows();
      results.pending = pendingResults;

      // 2. Check HeyGen processing workflows (~30-60s)
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('2️⃣  CHECKING HEYGEN PROCESSING');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const heygenResults = await checkHeyGenWorkflows();
      results.heygen = heygenResults;

      // 3. Check SubMagic processing workflows (~60-120s)
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('3️⃣  CHECKING SUBMAGIC PROCESSING');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const submagicResults = await checkSubMagicWorkflows();
      results.submagic = submagicResults;

      // 4. Check posting/video_processing workflows (~30-90s)
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('4️⃣  CHECKING POSTING WORKFLOWS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const postingResults = await checkPostingWorkflows();
      results.posting = postingResults;

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ [STUCK-WORKFLOWS] Complete');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 Summary:`);
      console.log(`   Pending: ${results.pending.started}/${results.pending.checked} started`);
      console.log(`   HeyGen: ${results.heygen.advanced}/${results.heygen.checked} advanced`);
      console.log(`   SubMagic: ${results.submagic.completed}/${results.submagic.checked} completed`);
      console.log(`   Posting: ${results.posting.retried}/${results.posting.checked} retried`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        results
      });
    });

  } catch (error) {
    console.error('❌ [STUCK-WORKFLOWS] Critical error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

// ============================================================================
// 1. CHECK PENDING WORKFLOWS
// ============================================================================

async function checkPendingWorkflows() {
  const { db } = await import('@/lib/firebase');
  const { collection, getDocs, query, where, limit: firestoreLimit, orderBy } = await import('firebase/firestore');
  const { getAllBrandIds } = await import('@/lib/brand-utils');

  if (!db) {
    console.error('❌ Firebase not initialized');
    return { checked: 0, started: 0, failed: 0 };
  }

  const pendingWorkflows: Array<{
    workflowId: string;
    brand: string;
    collectionName: string;
    stuckMinutes: number;
  }> = [];

  // Check all 8 brands + podcast
  const brands = [...getAllBrandIds(), 'podcast'];

  for (const brand of brands) {
    try {
      const collectionName = `${brand}_workflow_queue`;
      console.log(`📂 Checking ${collectionName}...`);

      const q = query(
        collection(db, collectionName),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'asc'),
        firestoreLimit(5)
      );

      const snapshot = await getDocs(q);
      console.log(`   Found ${snapshot.size} pending workflows`);

      snapshot.forEach(doc => {
        const data = doc.data();
        const stuckMinutes = Math.round((Date.now() - (data.createdAt || 0)) / 60000);

        // Only start if stuck > 5 minutes
        if (stuckMinutes > 5) {
          console.log(`   📄 ${doc.id}: pending for ${stuckMinutes} min`);
          pendingWorkflows.push({
            workflowId: doc.id,
            brand,
            collectionName,
            stuckMinutes
          });
        }
      });
    } catch (err) {
      console.error(`   ❌ Error querying ${brand}:`, err);
    }
  }

  console.log(`\n📋 Total pending: ${pendingWorkflows.length}`);

  let started = 0;
  let failed = 0;
  const MAX_TO_START = 3;

  // Start workflows
  for (const workflow of pendingWorkflows.slice(0, MAX_TO_START)) {
    console.log(`\n🚀 Starting ${workflow.brand}/${workflow.workflowId}...`);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
      const response = await fetch(`${baseUrl}/api/workflow/complete-viral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: workflow.brand,
          platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
          schedule: 'optimal'
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ Started: ${result.workflow_id}`);
        started++;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`   ❌ Failed:`, error);
      failed++;
    }
  }

  return { checked: pendingWorkflows.length, started, failed };
}

// ============================================================================
// 2. CHECK HEYGEN PROCESSING WORKFLOWS
// ============================================================================

async function checkHeyGenWorkflows() {
  const { db } = await import('@/lib/firebase');
  const { collection, getDocs, query, where, limit: firestoreLimit, updateDoc, doc } = await import('firebase/firestore');
  const { getAllBrandIds } = await import('@/lib/brand-utils');
  const { downloadAndUploadToR2 } = await import('@/lib/video-storage');

  if (!db) {
    console.error('❌ Firebase not initialized');
    return { checked: 0, advanced: 0, failed: 0 };
  }

  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

  if (!HEYGEN_API_KEY || !SUBMAGIC_API_KEY) {
    console.error('❌ API keys not configured');
    return { checked: 0, advanced: 0, failed: 0 };
  }

  let checked = 0;
  let advanced = 0;
  let failed = 0;

  // Check all brands + podcast
  const brands = [...getAllBrandIds(), 'podcast'];

  for (const brand of brands) {
    try {
      const collectionName = `${brand}_workflow_queue`;
      console.log(`📂 Checking ${collectionName}...`);

      const q = query(
        collection(db, collectionName),
        where('status', '==', 'heygen_processing'),
        firestoreLimit(10)
      );

      const snapshot = await getDocs(q);
      console.log(`   Found ${snapshot.size} HeyGen processing`);
      checked += snapshot.size;

      for (const workflowDoc of snapshot.docs) {
        const data = workflowDoc.data();
        const workflowId = workflowDoc.id;
        const videoId = data.heygenVideoId;

        if (!videoId) continue;

        try {
          const heygenResponse = await fetch(
            `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
            { headers: { 'x-api-key': HEYGEN_API_KEY } }
          );

          if (!heygenResponse.ok) continue;

          const heygenData = await heygenResponse.json();
          const status = heygenData.data?.status;
          const videoUrl = heygenData.data?.video_url;

          console.log(`   📹 ${workflowId}: ${status}`);

          if (status === 'completed' && videoUrl) {
            // Upload to R2
            const publicHeygenUrl = await downloadAndUploadToR2(
              videoUrl,
              HEYGEN_API_KEY,
              `heygen-videos/${workflowId}.mp4`
            );

            // Send to SubMagic
            const webhookUrl = `${baseUrl}/api/webhooks/submagic/${brand}`;

            // Get workflow data for title
            const title = (data.articleTitle || data.title || data.topic || `Video ${workflowId}`)
              .replace(/&#8217;/g, "'")
              .replace(/&#8216;/g, "'")
              .replace(/&#8211;/g, "-")
              .replace(/&#8212;/g, "-")
              .replace(/&amp;/g, "&")
              .replace(/&quot;/g, '"')
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&nbsp;/g, " ")
              .substring(0, 50);

            // Brand-specific B-roll settings
            const shouldUseBrolls = brand !== 'property' && brand !== 'podcast';
            const brollPercentage = shouldUseBrolls ? 75 : 0;

            const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': SUBMAGIC_API_KEY
              },
              body: JSON.stringify({
                title,
                language: 'en',
                videoUrl: publicHeygenUrl,
                templateName: 'Hormozi 2',
                magicBrolls: shouldUseBrolls,
                magicBrollsPercentage: brollPercentage,
                magicZooms: true,
                webhookUrl
              })
            });

            if (submagicResponse.ok) {
              const submagicData = await submagicResponse.json();
              const projectId = submagicData.id || submagicData.project_id || submagicData.projectId;

              await updateDoc(doc(db, collectionName, workflowId), {
                status: 'submagic_processing',
                submagicVideoId: projectId,
                heygenVideoUrl: publicHeygenUrl,
                updatedAt: Date.now()
              });

              console.log(`   ✅ ${workflowId}: Advanced to SubMagic (ID: ${projectId})`);
              advanced++;
            } else {
              // CRITICAL FIX: Log SubMagic API failures
              const errorText = await submagicResponse.text().catch(() => 'Unable to read error');
              console.error(`   ❌ ${workflowId}: SubMagic API failed (${submagicResponse.status}): ${errorText}`);

              await updateDoc(doc(db, collectionName, workflowId), {
                status: 'failed',
                error: `SubMagic API error: ${submagicResponse.status} - ${errorText}`,
                heygenVideoUrl: publicHeygenUrl,
                updatedAt: Date.now()
              });
              failed++;
            }
          } else if (status === 'failed') {
            await updateDoc(doc(db, collectionName, workflowId), {
              status: 'failed',
              error: 'HeyGen failed',
              updatedAt: Date.now()
            });
            console.log(`   ❌ ${workflowId}: Failed`);
            failed++;
          }
        } catch (error) {
          console.error(`   ❌ ${workflowId}:`, error);
          failed++;
        }
      }
    } catch (err) {
      console.error(`   ❌ Error querying ${brand}:`, err);
    }
  }

  // Also check propertyShowcaseWorkflows (new unified collection)
  try {
    console.log(`\n📂 Checking propertyShowcaseWorkflows...`);
    const q = query(
      collection(db, 'propertyShowcaseWorkflows'),
      where('status', '==', 'heygen_processing'),
      firestoreLimit(10)
    );
    const snapshot = await getDocs(q);
    console.log(`   Found ${snapshot.size} property video HeyGen processing`);
    checked += snapshot.size;

    for (const workflowDoc of snapshot.docs) {
      const data = workflowDoc.data();
      const workflowId = workflowDoc.id;
      const videoId = data.heygenVideoId;

      if (!videoId) continue;

      try {
        const heygenResponse = await fetch(
          `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
          { headers: { 'x-api-key': HEYGEN_API_KEY } }
        );

        if (!heygenResponse.ok) continue;

        const heygenData = await heygenResponse.json();
        const status = heygenData.data?.status;
        const videoUrl = heygenData.data?.video_url;

        console.log(`   📹 ${workflowId}: ${status}`);

        if (status === 'completed' && videoUrl) {
          // Upload to R2
          const publicHeygenUrl = await downloadAndUploadToR2(
            videoUrl,
            HEYGEN_API_KEY,
            `heygen-videos/${workflowId}.mp4`
          );

          // Send to SubMagic
          const webhookUrl = `${baseUrl}/api/webhooks/submagic/property`;

          const title = (data.propertyAddress || data.title || `Property ${workflowId}`)
            .replace(/&#8217;/g, "'")
            .replace(/&#8216;/g, "'")
            .replace(/&#8211;/g, "-")
            .replace(/&#8212;/g, "-")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&nbsp;/g, " ")
            .substring(0, 50);

          // Property videos: NO brolls (they're real estate videos)
          const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': SUBMAGIC_API_KEY
            },
            body: JSON.stringify({
              title,
              language: 'en',
              videoUrl: publicHeygenUrl,
              templateName: 'Hormozi 2',
              magicBrolls: false,
              magicBrollsPercentage: 0,
              magicZooms: true,
              webhookUrl
            })
          });

          if (submagicResponse.ok) {
            const submagicData = await submagicResponse.json();
            const projectId = submagicData.id || submagicData.project_id || submagicData.projectId;

            await updateDoc(doc(db, 'propertyShowcaseWorkflows', workflowId), {
              status: 'submagic_processing',
              submagicVideoId: projectId,
              heygenVideoUrl: publicHeygenUrl,
              updatedAt: Date.now()
            });

            console.log(`   ✅ ${workflowId}: Advanced to SubMagic (ID: ${projectId})`);
            advanced++;
          } else {
            // CRITICAL FIX: Log SubMagic API failures for property videos
            const errorText = await submagicResponse.text().catch(() => 'Unable to read error');
            console.error(`   ❌ ${workflowId}: SubMagic API failed (${submagicResponse.status}): ${errorText}`);

            await updateDoc(doc(db, 'propertyShowcaseWorkflows', workflowId), {
              status: 'failed',
              error: `SubMagic API error: ${submagicResponse.status} - ${errorText}`,
              heygenVideoUrl: publicHeygenUrl,
              updatedAt: Date.now()
            });
            failed++;
          }
        } else if (status === 'failed') {
          await updateDoc(doc(db, 'propertyShowcaseWorkflows', workflowId), {
            status: 'failed',
            error: 'HeyGen failed',
            updatedAt: Date.now()
          });
          console.log(`   ❌ ${workflowId}: Failed`);
          failed++;
        }
      } catch (error) {
        console.error(`   ❌ ${workflowId}:`, error);
        failed++;
      }
    }
  } catch (err) {
    console.error(`   ❌ Error querying propertyShowcaseWorkflows:`, err);
  }

  return { checked, advanced, failed };
}

// ============================================================================
// 3. CHECK SUBMAGIC PROCESSING WORKFLOWS
// ============================================================================

async function checkSubMagicWorkflows() {
  const { db } = await import('@/lib/firebase');
  const { collection, getDocs, query, where, limit: firestoreLimit, updateDoc, doc } = await import('firebase/firestore');
  const { getAllBrandIds } = await import('@/lib/brand-utils');
  const { uploadSubmagicVideo } = await import('@/lib/video-storage');
  const { postToLate } = await import('@/lib/late-api');

  if (!db) {
    console.error('❌ Firebase not initialized');
    return { checked: 0, completed: 0, failed: 0 };
  }

  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
  if (!SUBMAGIC_API_KEY) {
    console.error('❌ SUBMAGIC_API_KEY not configured');
    return { checked: 0, completed: 0, failed: 0 };
  }

  let checked = 0;
  let completed = 0;
  let failed = 0;

  // Check all brands + podcast
  const brands = [...getAllBrandIds(), 'podcast'];

  for (const brand of brands) {
    try {
      const collectionName = `${brand}_workflow_queue`;
      console.log(`📂 Checking ${collectionName}...`);

      const q = query(
        collection(db, collectionName),
        where('status', '==', 'submagic_processing'),
        firestoreLimit(15)
      );

      const snapshot = await getDocs(q);
      console.log(`   Found ${snapshot.size} SubMagic processing`);
      checked += snapshot.size;

      for (const workflowDoc of snapshot.docs) {
        const data = workflowDoc.data();
        const workflowId = workflowDoc.id;
        const projectId = data.submagicVideoId;

        if (!projectId) continue;

        try {
          const submagicResponse = await fetch(
            `https://api.submagic.co/v1/projects/${projectId}`,
            { headers: { 'x-api-key': SUBMAGIC_API_KEY } }
          );

          if (!submagicResponse.ok) continue;

          const submagicData = await submagicResponse.json();
          const status = submagicData.status;
          const downloadUrl = submagicData.media_url || submagicData.video_url || submagicData.downloadUrl || submagicData.download_url;

          console.log(`   🎬 ${workflowId}: ${status}`);

          if (status === 'completed' || status === 'done' || status === 'ready') {
            // Check if download URL exists, if not trigger export
            let finalDownloadUrl = downloadUrl;

            if (!finalDownloadUrl) {
              console.log(`   ⚠️  Complete but no download URL - triggering export...`);

              try {
                const exportResponse = await fetch(`https://api.submagic.co/v1/projects/${projectId}/export`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': SUBMAGIC_API_KEY
                  }
                });

                if (exportResponse.ok) {
                  console.log(`   ✅ Export triggered - video will be ready soon`);
                  // Don't process yet, will be picked up next cron run
                  continue;
                } else {
                  const exportError = await exportResponse.text();
                  console.error(`   ❌ Export trigger failed:`, exportError);
                  continue;
                }
              } catch (exportError) {
                console.error(`   ❌ Error triggering export:`, exportError);
                continue;
              }
            }

            // Upload to R2
            const publicVideoUrl = await uploadSubmagicVideo(finalDownloadUrl);

            // Update to posting
            await updateDoc(doc(db, collectionName, workflowId), {
              status: 'posting',
              finalVideoUrl: publicVideoUrl,
              retryCount: (data.retryCount || 0) + 1,
              updatedAt: Date.now()
            });

            // Post to Late
            const postResult = await postToLate({
              videoUrl: publicVideoUrl,
              caption: data.caption || '',
              title: data.title || '',
              platforms: data.platforms || ['instagram', 'tiktok', 'youtube'],
              useQueue: true,
              brand: brand as any
            });

            if (postResult.success) {
              await updateDoc(doc(db, collectionName, workflowId), {
                status: 'completed',
                latePostId: postResult.postId,
                completedAt: Date.now(),
                updatedAt: Date.now()
              });

              console.log(`   ✅ ${workflowId}: Completed`);
              completed++;
            }
          } else if (status === 'failed' || status === 'error') {
            await updateDoc(doc(db, collectionName, workflowId), {
              status: 'failed',
              error: 'SubMagic failed',
              updatedAt: Date.now()
            });
            console.log(`   ❌ ${workflowId}: Failed`);
            failed++;
          }
        } catch (error) {
          console.error(`   ❌ ${workflowId}:`, error);
          failed++;
        }
      }
    } catch (err) {
      console.error(`   ❌ Error querying ${brand}:`, err);
    }
  }

  // CRITICAL FIX: Also check propertyShowcaseWorkflows collection
  try {
    console.log(`\n📂 Checking propertyShowcaseWorkflows...`);
    const q = query(
      collection(db, 'propertyShowcaseWorkflows'),
      where('status', '==', 'submagic_processing'),
      firestoreLimit(15)
    );

    const snapshot = await getDocs(q);
    console.log(`   Found ${snapshot.size} property video SubMagic processing`);
    checked += snapshot.size;

    for (const workflowDoc of snapshot.docs) {
      const data = workflowDoc.data();
      const workflowId = workflowDoc.id;
      const projectId = data.submagicVideoId;

      if (!projectId) continue;

      try {
        const submagicResponse = await fetch(
          `https://api.submagic.co/v1/projects/${projectId}`,
          { headers: { 'x-api-key': SUBMAGIC_API_KEY } }
        );

        if (!submagicResponse.ok) continue;

        const submagicData = await submagicResponse.json();
        const status = submagicData.status;
        const downloadUrl = submagicData.media_url || submagicData.video_url || submagicData.downloadUrl || submagicData.download_url;

        console.log(`   🎬 ${workflowId}: ${status}`);

        if (status === 'completed' || status === 'done' || status === 'ready') {
          // Check if download URL exists, if not trigger export
          let finalDownloadUrl = downloadUrl;

          if (!finalDownloadUrl) {
            console.log(`   ⚠️  Complete but no download URL - triggering export...`);

            try {
              const exportResponse = await fetch(`https://api.submagic.co/v1/projects/${projectId}/export`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': SUBMAGIC_API_KEY
                }
              });

              if (exportResponse.ok) {
                console.log(`   ✅ Export triggered - video will be ready soon`);
                continue;
              } else {
                const exportError = await exportResponse.text();
                console.error(`   ❌ Export trigger failed:`, exportError);
                continue;
              }
            } catch (exportError) {
              console.error(`   ❌ Error triggering export:`, exportError);
              continue;
            }
          }

          // Upload to R2
          const publicVideoUrl = await uploadSubmagicVideo(finalDownloadUrl);

          // Update to posting
          await updateDoc(doc(db, 'propertyShowcaseWorkflows', workflowId), {
            status: 'posting',
            finalVideoUrl: publicVideoUrl,
            retryCount: (data.retryCount || 0) + 1,
            updatedAt: Date.now()
          });

          // Post to Late
          const postResult = await postToLate({
            videoUrl: publicVideoUrl,
            caption: data.caption || 'New owner finance property for sale! 🏡',
            title: data.title || 'Property For Sale',
            platforms: data.platforms || ['instagram', 'tiktok', 'youtube'],
            useQueue: true,
            brand: 'property' as any
          });

          if (postResult.success) {
            await updateDoc(doc(db, 'propertyShowcaseWorkflows', workflowId), {
              status: 'completed',
              latePostId: postResult.postId,
              completedAt: Date.now(),
              updatedAt: Date.now()
            });

            console.log(`   ✅ ${workflowId}: Completed`);
            completed++;
          }
        } else if (status === 'failed' || status === 'error') {
          await updateDoc(doc(db, 'propertyShowcaseWorkflows', workflowId), {
            status: 'failed',
            error: 'SubMagic failed',
            updatedAt: Date.now()
          });
          console.log(`   ❌ ${workflowId}: Failed`);
          failed++;
        }
      } catch (error) {
        console.error(`   ❌ ${workflowId}:`, error);
        failed++;
      }
    }
  } catch (err) {
    console.error(`   ❌ Error querying propertyShowcaseWorkflows:`, err);
  }

  return { checked, completed, failed };
}

// ============================================================================
// 4. CHECK POSTING WORKFLOWS
// ============================================================================

async function checkPostingWorkflows() {
  const { db } = await import('@/lib/firebase');
  const { collection, getDocs, query, where, limit: firestoreLimit, updateDoc, doc } = await import('firebase/firestore');
  const { getAllBrandIds } = await import('@/lib/brand-utils');
  const { postToLate } = await import('@/lib/late-api');

  if (!db) {
    console.error('❌ Firebase not initialized');
    return { checked: 0, retried: 0, failed: 0 };
  }

  let checked = 0;
  let retried = 0;
  let failed = 0;

  // Check all brands + podcast
  const brands = [...getAllBrandIds(), 'podcast'];

  for (const brand of brands) {
    try {
      const collectionName = `${brand}_workflow_queue`;
      console.log(`📂 Checking ${collectionName}...`);

      // Check both statuses
      const qPosting = query(
        collection(db, collectionName),
        where('status', '==', 'posting'),
        firestoreLimit(10)
      );

      const qProcessing = query(
        collection(db, collectionName),
        where('status', '==', 'video_processing'),
        firestoreLimit(10)
      );

      const [postingSnapshot, processingSnapshot] = await Promise.all([
        getDocs(qPosting),
        getDocs(qProcessing)
      ]);

      const totalSize = postingSnapshot.size + processingSnapshot.size;
      console.log(`   Found ${totalSize} posting/processing`);
      checked += totalSize;

      const allWorkflows = [...postingSnapshot.docs, ...processingSnapshot.docs];

      for (const workflowDoc of allWorkflows) {
        const data = workflowDoc.data();
        const workflowId = workflowDoc.id;
        const videoUrl = data.finalVideoUrl;
        const stuckMinutes = Math.round((Date.now() - (data.updatedAt || data.createdAt || 0)) / 60000);

        // Only retry if stuck > 10 minutes
        if (stuckMinutes < 10) continue;

        console.log(`   📤 ${workflowId}: stuck ${stuckMinutes}min`);

        try {
          if (data.status === 'video_processing') {
            // CRITICAL FIX: Trigger worker endpoint (not /api/process-video which doesn't exist!)
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
            const secret = process.env.CLOUD_TASKS_SECRET || process.env.CRON_SECRET;

            const response = await fetch(`${baseUrl}/api/workers/process-video`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Cloud-Tasks-Worker': secret || ''
              },
              body: JSON.stringify({
                brand,
                workflowId,
                videoUrl: data.submagicDownloadUrl || videoUrl,
                submagicProjectId: data.submagicVideoId || data.submagicProjectId
              })
            });

            if (response.ok) {
              console.log(`   ✅ ${workflowId}: Reprocessing triggered`);
              retried++;
            } else {
              const errorText = await response.text().catch(() => 'Unable to read error');
              console.error(`   ❌ ${workflowId}: Worker failed (${response.status}): ${errorText}`);
              failed++;
            }
          } else if (videoUrl) {
            // Retry Late posting
            const postResult = await postToLate({
              videoUrl,
              caption: data.caption || '',
              title: data.title || '',
              platforms: data.platforms || ['instagram', 'tiktok', 'youtube'],
              useQueue: true,
              brand: brand as any
            });

            if (postResult.success) {
              await updateDoc(doc(db, collectionName, workflowId), {
                status: 'completed',
                latePostId: postResult.postId,
                completedAt: Date.now(),
                updatedAt: Date.now()
              });

              console.log(`   ✅ ${workflowId}: Posted`);
              retried++;
            }
          }
        } catch (error) {
          console.error(`   ❌ ${workflowId}:`, error);
          failed++;
        }
      }
    } catch (err) {
      console.error(`   ❌ Error querying ${brand}:`, err);
    }
  }

  return { checked, retried, failed };
}
