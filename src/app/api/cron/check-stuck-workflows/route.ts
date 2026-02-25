/**
 * CONSOLIDATED Stuck Workflows Cron
 *
 * Consolidates 4 separate cron jobs into ONE to reduce Vercel invocations by 75%:
 * 1. start-pending-workflows (pending status)
 * 2. check-stuck-heygen (heygen_processing status)
 * 3. check-stuck-submagic (submagic_processing status)
 * 4. check-stuck-posting (posting + video_processing status)
 *
 * Checks ALL 7 brands: carz, ownerfi, benefit, abdullah, personal, gaza, realtors
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

// Performance: Brand-level timeout to prevent one slow brand from blocking others
const BRAND_PROCESSING_TIMEOUT_MS = 45_000; // 45 seconds per brand (conservative)
const PARALLEL_QUERY_BATCH_SIZE = 7; // Process all 7 brands in parallel

// ============================================================================
// WORKFLOW TIMEOUT CONFIGURATION
// Auto-fail workflows stuck longer than these durations (in minutes)
// ============================================================================
const MAX_STAGE_DURATION_MINUTES = {
  pending: 15,              // 15 min - should start quickly or fail
  heygen_processing: 15,    // 15 min - HeyGen completes in 5-10 min
  synthesia_processing: 15, // 15 min - Synthesia completes in 5-10 min
  submagic_processing: 15,  // 15 min - Submagic completes in 5-10 min
  video_processing: 10,     // 10 min - R2 upload + posting
  posting: 10,              // 10 min - posting to Late
  exporting: 15,            // 15 min - Submagic export phase
  export_failed: 15,        // 15 min - stuck in export_failed (should be retried or fail)
} as const;

// Max retry attempts before permanent failure
const MAX_RETRY_ATTEMPTS = 3;

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
        scriptGeneration: { checked: 0, deleted: 0, failed: 0 },
        pending: { checked: 0, started: 0, failed: 0 },
        heygen: { checked: 0, advanced: 0, failed: 0 },
        submagic: { checked: 0, completed: 0, failed: 0 },
        posting: { checked: 0, retried: 0, failed: 0 }
      };

      // 1. Check pending workflows (fastest ~10-30s)
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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

      // 2b. Check Synthesia processing workflows
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('2️⃣b CHECKING SYNTHESIA PROCESSING');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const synthesiaResults = await checkSynthesiaWorkflows();
      (results as any).synthesia = synthesiaResults;

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

      // 5. AUTO-FAIL timed out workflows (new reliability feature)
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('5️⃣  AUTO-FAILING TIMED OUT WORKFLOWS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const timeoutResults = await autoFailTimedOutWorkflows();
      (results as any).timedOut = timeoutResults;

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ [STUCK-WORKFLOWS] Complete');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 Summary:`);
      console.log(`   Pending: ${results.pending.started}/${results.pending.checked} started`);
      console.log(`   HeyGen: ${results.heygen.advanced}/${results.heygen.checked} advanced`);
      console.log(`   Synthesia: ${(results as any).synthesia?.advanced || 0}/${(results as any).synthesia?.checked || 0} advanced`);
      console.log(`   SubMagic: ${results.submagic.completed}/${results.submagic.checked} completed`);
      console.log(`   Posting: ${results.posting.retried}/${results.posting.checked} retried`);
      console.log(`   Timed Out: ${timeoutResults.failed}/${timeoutResults.checked} auto-failed`);
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

export async function POST(_request: NextRequest) {
  return GET(_request);
}

// ============================================================================
// HELPER: Timeout wrapper for brand processing
// ============================================================================

/**
 * Wraps a brand processing function with a timeout to prevent blocking
 * If timeout occurs, logs warning and returns null (continues to next brand)
 */
async function withBrandTimeout<T>(
  brand: string,
  fn: () => Promise<T>,
  timeoutMs: number = BRAND_PROCESSING_TIMEOUT_MS
): Promise<T | null> {
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Brand ${brand} processing timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      )
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      console.error(`⏱️  ${brand}: TIMEOUT after ${timeoutMs}ms - skipping to prevent blocking other brands`);
      return null;
    }
    console.error(`❌ ${brand}: Error during processing:`, error);
    return null;
  }
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

  // Check all 7 brands
  const brands = [...getAllBrandIds()];

  // PARALLEL: Query all brands simultaneously (2-3x faster!)
  const brandResults = await Promise.all(
    brands.map(brand =>
      withBrandTimeout(brand, async () => {
        try {
          const collectionName = `${brand}_workflow_queue`;
          console.log(`📂 Checking ${collectionName}...`);

          const q = query(
            collection(db!, collectionName),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'asc'),
            firestoreLimit(5)
          );

          const snapshot = await getDocs(q);
          console.log(`   Found ${snapshot.size} pending workflows`);

          const workflows: Array<{
            workflowId: string;
            brand: string;
            collectionName: string;
            stuckMinutes: number;
          }> = [];

          snapshot.forEach(doc => {
            const data = doc.data();
            const pendingTimestamp = data.statusChangedAt || data.updatedAt || data.createdAt || 0;
            const stuckMinutes = Math.round((Date.now() - pendingTimestamp) / 60000);

            // Only start if stuck > 5 minutes
            if (stuckMinutes > 5) {
              console.log(`   📄 ${doc.id}: pending for ${stuckMinutes} min`);
              workflows.push({
                workflowId: doc.id,
                brand,
                collectionName,
                stuckMinutes
              });
            }
          });

          return workflows;
        } catch (err) {
          console.error(`   ❌ Error querying ${brand}:`, err);
          return [];
        }
      })
    )
  );

  // Aggregate results from all brands
  const pendingWorkflows = brandResults
    .filter(result => result !== null)
    .flat();

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
          workflowId: workflow.workflowId,  // Pass workflowId to resume existing workflow
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

  // Check all 7 brands
  const brands = [...getAllBrandIds()];

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

            // B-roll settings (enabled for all brands)
            const shouldUseBrolls = true;
            const brollPercentage = 75;

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
                statusChangedAt: Date.now(),
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
                statusChangedAt: Date.now(),
                updatedAt: Date.now()
              });
              failed++;
            }
          } else if (status === 'failed') {
            await updateDoc(doc(db, collectionName, workflowId), {
              status: 'failed',
              error: 'HeyGen failed',
              statusChangedAt: Date.now(),
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

  // CRITICAL FIX: Also check video_processing_failed workflows that have heygenVideoUrl
  // These can be recovered by advancing them to Submagic!
  console.log('\n🔥 CHECKING video_processing_failed WORKFLOWS WITH HEYGEN URL (RECOVERY)...');
  for (const brand of brands) {
    try {
      const collectionName = `${brand}_workflow_queue`;
      const q = query(
        collection(db, collectionName),
        where('status', '==', 'video_processing_failed'),
        firestoreLimit(20)
      );

      const snapshot = await getDocs(q);
      console.log(`📂 ${collectionName}: ${snapshot.size} failed workflows`);

      for (const workflowDoc of snapshot.docs) {
        const data = workflowDoc.data();
        const workflowId = workflowDoc.id;

        // Check if it has heygenVideoUrl - if yes, we can recover it!
        if (data.heygenVideoUrl) {
          console.log(`   🔥 RECOVERY: ${workflowId} has videoUrl, advancing to Submagic...`);

          // Send to SubMagic
          const webhookUrl = `${baseUrl}/api/webhooks/submagic/${brand}`;
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

          const shouldUseBrolls = true;
          const brollPercentage = 75;

          const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': SUBMAGIC_API_KEY
            },
            body: JSON.stringify({
              title,
              language: 'en',
              videoUrl: data.heygenVideoUrl,
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
              recoveredAt: Date.now(),
              statusChangedAt: Date.now(),
              updatedAt: Date.now()
            });

            console.log(`   ✅ RECOVERED ${workflowId}: Advanced to SubMagic (ID: ${projectId})`);
            advanced++;
          } else {
            const errorText = await submagicResponse.text().catch(() => 'Unable to read error');
            console.error(`   ❌ ${workflowId}: SubMagic API failed (${submagicResponse.status}): ${errorText}`);
            failed++;
          }
        }
      }
    } catch (err) {
      console.error(`   ❌ Error recovering ${brand}:`, err);
    }
  }

  return { checked, advanced, failed };
}

// ============================================================================
// 2b. CHECK SYNTHESIA PROCESSING WORKFLOWS
// ============================================================================

async function checkSynthesiaWorkflows() {
  const { db } = await import('@/lib/firebase');
  const { collection, getDocs, query, where, limit: firestoreLimit, updateDoc, doc } = await import('firebase/firestore');
  const { getAllBrandIds } = await import('@/lib/brand-utils');
  const { getSynthesiaVideoStatus } = await import('@/lib/synthesia-client');
  const { downloadAndUploadToR2 } = await import('@/lib/video-storage');

  if (!db) {
    console.error('❌ Firebase not initialized');
    return { checked: 0, advanced: 0, failed: 0 };
  }

  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

  if (!SUBMAGIC_API_KEY) {
    console.error('❌ SUBMAGIC_API_KEY not configured');
    return { checked: 0, advanced: 0, failed: 0 };
  }

  let checked = 0;
  let advanced = 0;
  let failed = 0;

  const brands = [...getAllBrandIds()];

  for (const brand of brands) {
    try {
      const collectionName = `${brand}_workflow_queue`;
      console.log(`📂 Checking ${collectionName} for Synthesia...`);

      const q = query(
        collection(db, collectionName),
        where('status', '==', 'synthesia_processing'),
        firestoreLimit(10)
      );

      const snapshot = await getDocs(q);
      console.log(`   Found ${snapshot.size} Synthesia processing`);
      checked += snapshot.size;

      for (const workflowDoc of snapshot.docs) {
        const data = workflowDoc.data();
        const workflowId = workflowDoc.id;
        const videoId = data.synthesiaVideoId;

        if (!videoId) continue;

        try {
          const statusResult = await getSynthesiaVideoStatus(videoId);
          console.log(`   🎬 ${workflowId}: ${statusResult.status}`);

          if (statusResult.status === 'complete' && statusResult.download) {
            // Download presigned URL to R2 immediately (URLs expire!)
            const r2VideoUrl = await downloadAndUploadToR2(
              statusResult.download,
              '', // No auth header needed for presigned URLs
              `synthesia-videos/${videoId}.mp4`
            );

            // Send to SubMagic
            const webhookUrl = `${baseUrl}/api/webhooks/submagic/${brand}`;
            const title = (data.articleTitle || data.title || data.topic || `Video ${workflowId}`)
              .replace(/&#8217;/g, "'")
              .replace(/&#8216;/g, "'")
              .replace(/&#8211;/g, "-")
              .replace(/&#8212;/g, "-")
              .replace(/&amp;/g, "&")
              .replace(/&quot;/g, '"')
              .substring(0, 50);

            const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': SUBMAGIC_API_KEY
              },
              body: JSON.stringify({
                title,
                language: 'en',
                videoUrl: r2VideoUrl,
                templateName: 'Hormozi 2',
                magicBrolls: true,
                magicBrollsPercentage: 75,
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
                synthesiaVideoUrl: r2VideoUrl,
                statusChangedAt: Date.now(),
                updatedAt: Date.now()
              });

              console.log(`   ✅ ${workflowId}: Advanced to SubMagic (ID: ${projectId})`);
              advanced++;
            } else {
              const errorText = await submagicResponse.text().catch(() => 'Unable to read error');
              console.error(`   ❌ ${workflowId}: SubMagic API failed (${submagicResponse.status}): ${errorText}`);

              await updateDoc(doc(db, collectionName, workflowId), {
                status: 'failed',
                error: `SubMagic API error: ${submagicResponse.status} - ${errorText}`,
                synthesiaVideoUrl: r2VideoUrl,
                statusChangedAt: Date.now(),
                updatedAt: Date.now()
              });
              failed++;
            }
          } else if (statusResult.status === 'failed') {
            await updateDoc(doc(db, collectionName, workflowId), {
              status: 'failed',
              error: 'Synthesia video generation failed',
              statusChangedAt: Date.now(),
              updatedAt: Date.now()
            });
            console.log(`   ❌ ${workflowId}: Synthesia failed`);
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

  // RECOVERY: Check failed + video_processing_failed workflows with synthesiaVideoUrl
  // Mirrors the HeyGen recovery path — checks both statuses for consistency
  console.log('\n🔥 CHECKING FAILED WORKFLOWS WITH SYNTHESIA URL (RECOVERY)...');
  for (const brand of brands) {
    try {
      const collectionName = `${brand}_workflow_queue`;

      // Query both 'failed' and 'video_processing_failed' statuses
      const qFailed = query(
        collection(db, collectionName),
        where('status', '==', 'failed'),
        firestoreLimit(20)
      );
      const qVpf = query(
        collection(db, collectionName),
        where('status', '==', 'video_processing_failed'),
        firestoreLimit(20)
      );

      const [failedSnap, vpfSnap] = await Promise.all([getDocs(qFailed), getDocs(qVpf)]);
      const allDocs = [...failedSnap.docs, ...vpfSnap.docs];
      const snapshot = { docs: allDocs, size: allDocs.length } as any;
      let recoverable = 0;

      for (const workflowDoc of snapshot.docs) {
        const data = workflowDoc.data();
        const workflowId = workflowDoc.id;

        // Only recover workflows that have a Synthesia video URL but never reached Submagic
        if (data.synthesiaVideoUrl && !data.submagicVideoId && data.retryable !== false) {
          console.log(`   🔥 RECOVERY: ${workflowId} has synthesiaVideoUrl, advancing to Submagic...`);

          const webhookUrl = `${baseUrl}/api/webhooks/submagic/${brand}`;
          const title = (data.articleTitle || data.title || data.topic || `Video ${workflowId}`)
            .replace(/&#8217;/g, "'")
            .replace(/&#8216;/g, "'")
            .replace(/&#8211;/g, "-")
            .replace(/&#8212;/g, "-")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .substring(0, 50);

          const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': SUBMAGIC_API_KEY
            },
            body: JSON.stringify({
              title,
              language: 'en',
              videoUrl: data.synthesiaVideoUrl,
              templateName: 'Hormozi 2',
              magicBrolls: true,
              magicBrollsPercentage: 75,
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
              recoveredAt: Date.now(),
              statusChangedAt: Date.now(),
              updatedAt: Date.now()
            });

            console.log(`   ✅ RECOVERED ${workflowId}: Advanced to SubMagic (ID: ${projectId})`);
            advanced++;
            recoverable++;
          } else {
            const errorText = await submagicResponse.text().catch(() => 'Unable to read error');
            console.error(`   ❌ ${workflowId}: SubMagic API failed (${submagicResponse.status}): ${errorText}`);
            failed++;
          }
        }
      }

      if (recoverable > 0) {
        console.log(`   📂 ${collectionName}: recovered ${recoverable} Synthesia workflows`);
      }
    } catch (err) {
      console.error(`   ❌ Error recovering ${brand}:`, err);
    }
  }

  return { checked, advanced, failed };
}

// ============================================================================
// 3. CHECK SUBMAGIC PROCESSING WORKFLOWS
// ============================================================================

async function checkSubMagicWorkflows() {
  const { db } = await import('@/lib/firebase');
  const { collection, getDocs, query, where, limit: firestoreLimit, updateDoc, doc } = await import('firebase/firestore');
  const { getAllBrandIds, getBrandPlatforms } = await import('@/lib/brand-utils');
  const { getBrandConfig } = await import('@/config/brand-configs');
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

  // Check all 7 brands
  const brands = [...getAllBrandIds()];

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

          if (!submagicResponse.ok) {
            const errorText = await submagicResponse.text().catch(() => 'Unable to read error');
            console.error(`   ❌ ${workflowId}: Submagic API error (${submagicResponse.status}): ${errorText}`);
            continue;
          }

          const submagicData = await submagicResponse.json();
          const status = submagicData.status;
          const downloadUrl = submagicData.media_url || submagicData.video_url || submagicData.downloadUrl || submagicData.download_url;

          console.log(`   🎬 ${workflowId}: ${status}`);

          if (status === 'completed' || status === 'done' || status === 'ready') {
            // Check if download URL exists, if not trigger export
            const finalDownloadUrl = downloadUrl;

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
              statusChangedAt: Date.now(),
              updatedAt: Date.now()
            });

            // Post to Late - use brand's configured platforms (excluding youtube which uses direct API)
            const brandPlatforms = getBrandPlatforms(brand as any, false).filter(p => p !== 'youtube');
            const postResult = await postToLate({
              videoUrl: publicVideoUrl,
              caption: data.caption || '',
              title: data.title || '',
              platforms: (data.platforms || brandPlatforms) as any[],
              useQueue: true,
              brand: brand as any
            });

            if (postResult.success) {
              await updateDoc(doc(db, collectionName, workflowId), {
                status: 'completed',
                latePostId: postResult.postId,
                completedAt: Date.now(),
                statusChangedAt: Date.now(),
                updatedAt: Date.now()
              });

              console.log(`   ✅ ${workflowId}: Completed`);
              completed++;
            }
          } else if (status === 'failed' || status === 'error') {
            await updateDoc(doc(db, collectionName, workflowId), {
              status: 'failed',
              error: 'SubMagic failed',
              statusChangedAt: Date.now(),
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

  // Also check 'exporting' workflows — poll Submagic for download URL
  console.log('\n📤 CHECKING EXPORTING WORKFLOWS...');
  for (const brand of brands) {
    try {
      const collectionName = `${brand}_workflow_queue`;
      const qExporting = query(
        collection(db, collectionName),
        where('status', '==', 'exporting'),
        firestoreLimit(10)
      );

      const exportingSnapshot = await getDocs(qExporting);
      if (exportingSnapshot.size > 0) {
        console.log(`   📂 ${collectionName}: ${exportingSnapshot.size} exporting`);
      }
      checked += exportingSnapshot.size;

      for (const workflowDoc of exportingSnapshot.docs) {
        const data = workflowDoc.data();
        const workflowId = workflowDoc.id;
        const projectId = data.submagicVideoId || data.submagicProjectId;

        if (!projectId) continue;

        try {
          const pollController = new AbortController();
          const pollTimeout = setTimeout(() => pollController.abort(), 15_000);

          const submagicResponse = await fetch(
            `https://api.submagic.co/v1/projects/${projectId}`,
            { headers: { 'x-api-key': SUBMAGIC_API_KEY }, signal: pollController.signal }
          );

          clearTimeout(pollTimeout);

          if (!submagicResponse.ok) continue;

          const submagicData = await submagicResponse.json();
          const downloadUrl = submagicData.media_url || submagicData.video_url || submagicData.downloadUrl || submagicData.download_url;

          if (downloadUrl) {
            console.log(`   ✅ ${workflowId}: Export complete — has download URL`);

            // Upload to R2 and advance to posting
            const publicVideoUrl = await uploadSubmagicVideo(downloadUrl);

            await updateDoc(doc(db, collectionName, workflowId), {
              status: 'video_processing',
              submagicDownloadUrl: downloadUrl,
              finalVideoUrl: publicVideoUrl,
              statusChangedAt: Date.now(),
              updatedAt: Date.now()
            });

            completed++;
          }
          // else: still exporting, will be picked up next cron run or timeout
        } catch (error) {
          console.error(`   ❌ ${workflowId} export poll:`, error);
        }
      }
    } catch (err) {
      console.error(`   ❌ Error checking exporting for ${brand}:`, err);
    }
  }

  // Also check 'export_failed' workflows — retry the export
  console.log('\n🔄 CHECKING EXPORT_FAILED WORKFLOWS (RETRY)...');
  for (const brand of brands) {
    try {
      const collectionName = `${brand}_workflow_queue`;
      const qExportFailed = query(
        collection(db, collectionName),
        where('status', '==', 'export_failed'),
        firestoreLimit(10)
      );

      const failedSnapshot = await getDocs(qExportFailed);
      if (failedSnapshot.size > 0) {
        console.log(`   📂 ${collectionName}: ${failedSnapshot.size} export_failed`);
      }

      for (const workflowDoc of failedSnapshot.docs) {
        const data = workflowDoc.data();
        const workflowId = workflowDoc.id;
        const projectId = data.submagicVideoId || data.submagicProjectId;
        const retryCount = data.exportRetries || 0;

        if (!projectId || retryCount >= 3) {
          if (retryCount >= 3) {
            // Permanently fail after 3 export retries
            await updateDoc(doc(db, collectionName, workflowId), {
              status: 'failed',
              error: `Export permanently failed after ${retryCount} retries`,
              failedAt: Date.now(),
              statusChangedAt: Date.now(),
              updatedAt: Date.now()
            });
            console.log(`   ❌ ${workflowId}: Permanently failed (${retryCount} export retries)`);
            failed++;
          }
          continue;
        }

        try {
          const brandConfig = getBrandConfig(brand as any);
          const retryController = new AbortController();
          const retryTimeout = setTimeout(() => retryController.abort(), 15_000);

          const exportResponse = await fetch(`https://api.submagic.co/v1/projects/${projectId}/export`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': SUBMAGIC_API_KEY
            },
            body: JSON.stringify({
              webhookUrl: brandConfig.webhooks.submagic
            }),
            signal: retryController.signal,
          });

          clearTimeout(retryTimeout);

          if (exportResponse.ok) {
            await updateDoc(doc(db, collectionName, workflowId), {
              status: 'exporting',
              exportRetries: retryCount + 1,
              exportTriggeredAt: Date.now(),
              statusChangedAt: Date.now(),
              updatedAt: Date.now()
            });
            console.log(`   🔄 ${workflowId}: Export retried (attempt ${retryCount + 1})`);
            completed++;
          } else {
            const errorText = await exportResponse.text().catch(() => '');
            console.error(`   ❌ ${workflowId}: Export retry failed (${exportResponse.status}): ${errorText}`);
            failed++;
          }
        } catch (error) {
          console.error(`   ❌ ${workflowId} export retry:`, error);
          failed++;
        }
      }
    } catch (err) {
      console.error(`   ❌ Error checking export_failed for ${brand}:`, err);
    }
  }

  return { checked, completed, failed };
}

// ============================================================================
// 4. CHECK POSTING WORKFLOWS
// ============================================================================

async function checkPostingWorkflows() {
  const { db } = await import('@/lib/firebase');
  const { collection, getDocs, query, where, limit: firestoreLimit, updateDoc, doc } = await import('firebase/firestore');
  const { getAllBrandIds, getBrandPlatforms } = await import('@/lib/brand-utils');
  const { postToLate } = await import('@/lib/late-api');

  if (!db) {
    console.error('❌ Firebase not initialized');
    return { checked: 0, retried: 0, failed: 0 };
  }

  let checked = 0;
  let retried = 0;
  let failed = 0;

  // Check all 7 brands
  const brands = [...getAllBrandIds()];

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

        // CRITICAL FIX: Skip workflows with no valid timestamp to avoid false positives
        const timestamp = data.statusChangedAt || data.updatedAt || data.createdAt;
        if (!timestamp || timestamp <= 0) {
          console.log(`   ⚠️  ${workflowId}: No valid timestamp - skipping`);
          continue;
        }
        const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

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
            // Retry Late posting - use brand's configured platforms (excluding youtube which uses direct API)
            const brandPlatforms = getBrandPlatforms(brand as any, false).filter(p => p !== 'youtube');
            const postResult = await postToLate({
              videoUrl,
              caption: data.caption || '',
              title: data.title || '',
              platforms: (data.platforms || brandPlatforms) as any[],
              useQueue: true,
              brand: brand as any
            });

            if (postResult.success) {
              await updateDoc(doc(db, collectionName, workflowId), {
                status: 'completed',
                latePostId: postResult.postId,
                completedAt: Date.now(),
                statusChangedAt: Date.now(),
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

// ============================================================================
// 5. AUTO-FAIL TIMED OUT WORKFLOWS
// Workflows stuck beyond MAX_STAGE_DURATION_MINUTES get auto-failed
// This prevents workflows from being stuck indefinitely
// ============================================================================

async function autoFailTimedOutWorkflows() {
  const { db } = await import('@/lib/firebase');
  const { collection, getDocs, query, where, limit: firestoreLimit, updateDoc, doc } = await import('firebase/firestore');
  const { getAllBrandIds } = await import('@/lib/brand-utils');

  if (!db) {
    console.error('❌ Firebase not initialized');
    return { checked: 0, failed: 0, requeued: 0 };
  }

  let checked = 0;
  let failed = 0;
  let requeued = 0;

  // Check all brands
  const brands = [...getAllBrandIds()];
  const statuses = ['pending', 'heygen_processing', 'synthesia_processing', 'submagic_processing', 'video_processing', 'posting', 'exporting', 'export_failed'] as const;

  for (const brand of brands) {
    const collectionName = `${brand}_workflow_queue`;

    for (const status of statuses) {
      try {
        const maxMinutes = MAX_STAGE_DURATION_MINUTES[status as keyof typeof MAX_STAGE_DURATION_MINUTES];
        if (!maxMinutes) continue;

        const q = query(
          collection(db, collectionName),
          where('status', '==', status),
          firestoreLimit(20)
        );

        const snapshot = await getDocs(q);

        for (const workflowDoc of snapshot.docs) {
          const data = workflowDoc.data();
          const workflowId = workflowDoc.id;

          // Use statusChangedAt if available, otherwise fall back to updatedAt or createdAt
          const timestamp = data.statusChangedAt || data.updatedAt || data.createdAt;
          if (!timestamp || timestamp <= 0) continue;

          const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);
          checked++;

          // Check if exceeded max duration
          if (stuckMinutes > maxMinutes) {
            const retryCount = data.retryCount || 0;

            console.log(`   ⏰ ${brand}/${workflowId}: ${status} for ${stuckMinutes}min (max: ${maxMinutes}min)`);
            console.log(`      Retry count: ${retryCount}/${MAX_RETRY_ATTEMPTS}`);

            if (retryCount >= MAX_RETRY_ATTEMPTS) {
              // Permanently fail - exceeded max retries
              await updateDoc(doc(db, collectionName, workflowId), {
                status: 'failed',
                error: `Timed out in ${status} after ${stuckMinutes} minutes. Max retries (${MAX_RETRY_ATTEMPTS}) exceeded.`,
                failedAt: Date.now(),
                updatedAt: Date.now()
              });

              console.log(`      ❌ PERMANENTLY FAILED (max retries exceeded)`);
              failed++;
            } else {
              // Stay in current stage so the stage-specific checker
              // (HeyGen/Synthesia/Submagic) re-polls the external API.
              // DO NOT reset statusChangedAt — that would restart the timeout
              // clock and create an infinite loop. Only update retryCount so
              // we eventually hit MAX_RETRY_ATTEMPTS and permanently fail.
              await updateDoc(doc(db, collectionName, workflowId), {
                error: `Auto-retry: Timed out in ${status} after ${stuckMinutes} minutes (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`,
                retryCount: retryCount + 1,
                lastRetryAt: Date.now(),
                updatedAt: Date.now()
              });

              console.log(`      🔄 RETRY ${retryCount + 1}/${MAX_RETRY_ATTEMPTS} — staying in ${status} for stage checker to re-poll`);
              requeued++;
            }
          }
        }
      } catch (err) {
        console.error(`   ❌ Error checking ${brand}/${status}:`, err);
      }
    }
  }

  console.log(`\n📊 Timeout check complete:`);
  console.log(`   Checked: ${checked} workflows`);
  console.log(`   Requeued: ${requeued} for retry`);
  console.log(`   Failed: ${failed} permanently`);

  return { checked, failed, requeued };
}
