/**
 * CONSOLIDATED Daily Maintenance Cron
 *
 * Consolidates maintenance tasks into ONE cron:
 * 1. cleanup-videos (daily - deletes expired videos from R2)
 * 2. enhance-property-images (daily - upgrades low-res images)
 * 3. cleanup-queue-items (daily - deletes completed queue items older than 24 hours)
 * 4. cleanup-articles (Mon/Wed/Fri - keeps top 20 articles per brand)
 * 5. cleanup-workflows (Mon/Wed/Fri - deletes old completed workflows)
 * 6. sync-youtube-analytics (daily - syncs YT stats for all brands)
 *
 * Note: Property status is managed by refresh-zillow-status cron
 *
 * Schedule: 0 3 * * * (3am daily CST)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronLock } from '@/lib/cron-lock';

const CRON_SECRET = process.env.CRON_SECRET;
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧹 [DAILY-MAINTENANCE] Starting consolidated maintenance...');
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Use cron lock to prevent concurrent runs
    return withCronLock('daily-maintenance', async () => {
      const results = {
        videoCleanup: null as any,
        imageEnhancement: null as any,
        queueCleanup: null as any,
        articleCleanup: null as any,
        workflowCleanup: null as any,
        youtubeSync: null as any
      };

      // 1. Clean up expired videos
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('1️⃣  VIDEO CLEANUP');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const videoResult = await cleanupVideos();
      results.videoCleanup = videoResult;

      // 2. Enhance property images
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('2️⃣  IMAGE ENHANCEMENT');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const imageResult = await enhancePropertyImages();
      results.imageEnhancement = imageResult;

      // 3. Clean up completed queue items (daily)
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('3️⃣  QUEUE CLEANUP');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const queueResult = await cleanupQueueItems();
      results.queueCleanup = queueResult;

      // 4 & 5. Article + Workflow cleanup (Mon/Wed/Fri only)
      const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
      const isCleanupDay = [1, 3, 5].includes(dayOfWeek); // Mon, Wed, Fri

      if (isCleanupDay) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('4️⃣  ARTICLE CLEANUP (Mon/Wed/Fri)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        const articleResult = await cleanupArticles();
        results.articleCleanup = articleResult;

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('5️⃣  WORKFLOW CLEANUP (Mon/Wed/Fri)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        const workflowResult = await cleanupWorkflows();
        results.workflowCleanup = workflowResult;
      } else {
        console.log('\n⏭️  Skipping article/workflow cleanup (only runs Mon/Wed/Fri)');
        results.articleCleanup = { skipped: true, day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek] };
        results.workflowCleanup = { skipped: true, day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek] };
      }

      // 6. YouTube Analytics Sync (daily)
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('6️⃣  YOUTUBE ANALYTICS SYNC');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const youtubeResult = await syncYouTubeAnalytics();
      results.youtubeSync = youtubeResult;

      const duration = Date.now() - startTime;

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ [DAILY-MAINTENANCE] Complete');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 Summary:`);
      console.log(`   Videos deleted: ${results.videoCleanup?.deleted || 0}`);
      console.log(`   Images enhanced: ${results.imageEnhancement?.upgraded || 0}`);
      console.log(`   Queue items deleted: ${results.queueCleanup?.ownerFinance?.deleted || 0} owner finance, ${results.queueCleanup?.cashDeals?.deleted || 0} cash deals`);
      console.log(`   Articles cleaned: ${results.articleCleanup?.skipped ? 'N/A' : (results.articleCleanup?.totalDeleted || 0)}`);
      console.log(`   Workflows cleaned: ${results.workflowCleanup?.skipped ? 'N/A' : (results.workflowCleanup?.deleted || 0)}`);
      console.log(`   YouTube brands synced: ${results.youtubeSync?.brandsSynced || 0}`);
      console.log(`   Duration: ${duration}ms`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        results
      });
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ [DAILY-MAINTENANCE] Critical error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`
    }, { status: 500 });
  }
}

// ============================================================================
// 1. CLEANUP EXPIRED VIDEOS
// ============================================================================

async function cleanupVideos() {
  try {
    console.log('🗑️  Deleting expired videos (older than 7 days)...');

    const { deleteExpiredVideos } = await import('@/lib/video-storage');
    const result = await deleteExpiredVideos();

    console.log(`   ✅ Deleted: ${result.deleted} videos`);
    console.log(`   ❌ Errors: ${result.errors} videos`);
    console.log(`   💾 Freed: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB`);

    if (result.errors > 5) {
      console.error(`   ⚠️  High error rate: ${result.errors} videos failed`);
      const { alertSystemError } = await import('@/lib/error-monitoring');
      await alertSystemError(
        'Video Cleanup',
        `High error rate: ${result.errors} videos failed to delete`,
        { deleted: result.deleted, errors: result.errors }
      ).catch((err) => console.warn('Failed to send alert:', err));
    }

    return {
      success: true,
      deleted: result.deleted,
      errors: result.errors,
      bytesFreed: result.totalSize
    };

  } catch (error) {
    console.error('   ❌ Video cleanup error:', error);
    const { alertSystemError } = await import('@/lib/error-monitoring');
    await alertSystemError(
      'Video Cleanup',
      error instanceof Error ? error.message : 'Unknown error',
      { error: String(error) }
    ).catch((err) => console.warn('Failed to send alert:', err));

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// 2. ENHANCE PROPERTY IMAGES
// ============================================================================

async function enhancePropertyImages() {
  try {
    console.log('📸 Upgrading low-resolution property images...');

    const { getAdminDb } = await import('@/lib/firebase-admin');
    const db = await getAdminDb();

    if (!db) {
      throw new Error('Firebase not initialized');
    }

    const BATCH_SIZE = 1000; // Process more per run
    const stats: { properties: { total: number; upgraded: number } } = {
      properties: { total: 0, upgraded: 0 }
    };
    let totalErrors = 0;

    // Helper to process a collection
    async function processCollection(
      collectionName: string,
      imageFields: string[]
    ): Promise<{ total: number; upgraded: number; errors: number }> {
      const collRef = db.collection(collectionName);
      const allDocs = await collRef.get();

      // Filter to unprocessed docs - check ALL image fields for low-res patterns
      const lowResPatterns = [
        'p_a.jpg', 'p_b.jpg', 'p_c.jpg', 'p_d.jpg', 'p_e.jpg', 'p_f.jpg', 'p_g.jpg', 'p_h.jpg',
        'cc_ft_192', 'cc_ft_384', 'cc_ft_576', 'cc_ft_768', 'cc_ft_960', 'cc_ft_1344', 'cc_ft_1536'
      ];
      const unprocessed = allDocs.docs.filter(doc => {
        const data = doc.data();

        // Collect all image URLs from all fields
        const allImageUrls: string[] = [];

        // Single fields
        for (const field of [...imageFields, 'firstPropertyImage']) {
          if (data[field] && typeof data[field] === 'string') {
            allImageUrls.push(data[field]);
          }
        }

        // Array fields
        for (const field of ['propertyImages', 'imageUrls', 'images']) {
          if (data[field] && Array.isArray(data[field])) {
            for (const url of data[field]) {
              if (typeof url === 'string') allImageUrls.push(url);
            }
          }
        }

        // Check if ANY image is still low-res
        const hasAnyLowRes = allImageUrls.some(url =>
          url.includes('zillowstatic.com') && lowResPatterns.some(p => url.includes(p))
        );

        // Needs processing if: never enhanced, OR any low-res image exists
        return data.imageEnhanced !== true || hasAnyLowRes;
      });
      const toProcess = unprocessed.slice(0, BATCH_SIZE);

      console.log(`   📊 ${collectionName}: ${toProcess.length} to process (${unprocessed.length} total unprocessed)`);

      let upgraded = 0;
      let errors = 0;

      // Process in batches of 500 for Firestore limits
      const WRITE_BATCH_SIZE = 500;
      for (let i = 0; i < toProcess.length; i += WRITE_BATCH_SIZE) {
        const batch = db.batch();
        const chunk = toProcess.slice(i, i + WRITE_BATCH_SIZE);

        for (const doc of chunk) {
          const data = doc.data();
          const updateData: Record<string, any> = {
            imageEnhanced: true,
            imageEnhancedAt: new Date().toISOString()
          };
          let wasUpgraded = false;

          // Process single image fields (including firstPropertyImage)
          const allSingleFields = [...imageFields, 'firstPropertyImage'];
          for (const field of allSingleFields) {
            if (data[field] && typeof data[field] === 'string' && data[field].includes('zillowstatic.com')) {
              const newUrl = upgradeZillowImageUrl(data[field]);
              if (newUrl !== data[field]) {
                updateData[field] = newUrl;
                wasUpgraded = true;
              }
            }
          }

          // Process array fields
          const arrayFields = ['imageUrls', 'propertyImages', 'images'];
          for (const field of arrayFields) {
            if (data[field] && Array.isArray(data[field])) {
              const upgradedUrls = data[field].map((url: string) =>
                typeof url === 'string' && url.includes('zillowstatic.com')
                  ? upgradeZillowImageUrl(url)
                  : url
              );
              if (JSON.stringify(upgradedUrls) !== JSON.stringify(data[field])) {
                updateData[field] = upgradedUrls;
                wasUpgraded = true;
              }
            }
          }

          // If imgSrc is missing but propertyImages exists, set imgSrc from first image
          if (!data.imgSrc && data.propertyImages && Array.isArray(data.propertyImages) && data.propertyImages.length > 0) {
            const firstImage = data.propertyImages[0];
            if (typeof firstImage === 'string') {
              updateData.imgSrc = upgradeZillowImageUrl(firstImage);
              wasUpgraded = true;
            }
          }

          // Same for imageUrls array
          if (!data.imgSrc && !updateData.imgSrc && data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
            const firstImage = data.imageUrls[0];
            if (typeof firstImage === 'string') {
              updateData.imgSrc = upgradeZillowImageUrl(firstImage);
              wasUpgraded = true;
            }
          }

          batch.update(doc.ref, updateData);
          if (wasUpgraded) upgraded++;
        }

        try {
          await batch.commit();
        } catch (e) {
          errors += chunk.length;
        }
      }

      return { total: toProcess.length, upgraded, errors };
    }

    // ============================================
    // 1. Process unified properties collection
    // ============================================
    console.log('\n   🏠 Processing properties (unified collection)...');
    const propertiesResult = await processCollection('properties', ['imgSrc', 'imageUrl', 'firstPropertyImage', 'image', 'thumbnail']);
    stats.properties = { total: propertiesResult.total, upgraded: propertiesResult.upgraded };
    totalErrors += propertiesResult.errors;
    console.log(`   ✅ properties: ${propertiesResult.upgraded}/${propertiesResult.total} upgraded`);

    // Summary
    const totalUpgraded = stats.properties.upgraded;
    const totalProcessed = stats.properties.total;

    console.log(`\n   📊 Total: ${totalUpgraded} images upgraded, ${totalProcessed} processed`);

    if (totalErrors > 5) {
      const { alertSystemError } = await import('@/lib/error-monitoring');
      await alertSystemError(
        'Image Enhancement',
        `High error rate: ${totalErrors} properties failed`,
        { totalUpgraded, totalErrors }
      ).catch((err) => console.warn('Failed to send alert:', err));
    }

    return {
      success: true,
      upgraded: totalUpgraded,
      processed: totalProcessed,
      errors: totalErrors,
      stats
    };

  } catch (error) {
    console.error('   ❌ Image enhancement error:', error);
    const { alertSystemError } = await import('@/lib/error-monitoring');
    await alertSystemError(
      'Image Enhancement',
      error instanceof Error ? error.message : 'Unknown error',
      { error: String(error) }
    ).catch((err) => console.warn('Failed to send alert:', err));

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// 3. CLEANUP QUEUE ITEMS
// ============================================================================

async function cleanupQueueItems() {
  try {
    console.log('🗑️  Deleting completed queue items (older than 24 hours)...');

    const { getAdminDb } = await import('@/lib/firebase-admin');
    const db = await getAdminDb();

    if (!db) {
      throw new Error('Firebase not initialized');
    }

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    console.log(`   📅 Cutoff: ${twentyFourHoursAgo.toLocaleString()}`);

    // Clean up owner finance queue (scraper_queue)
    console.log('\n   🔍 Cleaning owner finance queue (scraper_queue)...');
    const ownerFinanceSnapshot = await db
      .collection('scraper_queue')
      .where('status', '==', 'completed')
      .get();

    console.log(`   📊 Found ${ownerFinanceSnapshot.size} completed items`);

    const ownerFinanceToDelete = ownerFinanceSnapshot.docs.filter(doc => {
      const data = doc.data();
      const completedAt = data.completedAt;
      if (!completedAt) return true; // Delete if no timestamp (shouldn't happen but cleanup anyway)

      const completedDate = completedAt.toDate ? completedAt.toDate() : new Date(completedAt);
      return completedDate < twentyFourHoursAgo;
    });

    console.log(`   📊 ${ownerFinanceToDelete.length} items older than 24 hours`);

    let ownerFinanceDeleted = 0;
    let ownerFinanceErrors = 0;

    for (const doc of ownerFinanceToDelete) {
      try {
        await doc.ref.delete();
        ownerFinanceDeleted++;
      } catch (error) {
        ownerFinanceErrors++;
      }
    }

    console.log(`   ✅ Deleted: ${ownerFinanceDeleted} owner finance queue items`);
    if (ownerFinanceErrors > 0) {
      console.log(`   ❌ Errors: ${ownerFinanceErrors} items`);
    }

    // Clean up cash deals queue (cash_deals_queue)
    console.log('\n   🔍 Cleaning cash deals queue (cash_deals_queue)...');
    const cashDealsSnapshot = await db
      .collection('cash_deals_queue')
      .where('status', '==', 'completed')
      .get();

    console.log(`   📊 Found ${cashDealsSnapshot.size} completed items`);

    const cashDealsToDelete = cashDealsSnapshot.docs.filter(doc => {
      const data = doc.data();
      const completedAt = data.completedAt;
      if (!completedAt) return true;

      const completedDate = completedAt.toDate ? completedAt.toDate() : new Date(completedAt);
      return completedDate < twentyFourHoursAgo;
    });

    console.log(`   📊 ${cashDealsToDelete.length} items older than 24 hours`);

    let cashDealsDeleted = 0;
    let cashDealsErrors = 0;

    for (const doc of cashDealsToDelete) {
      try {
        await doc.ref.delete();
        cashDealsDeleted++;
      } catch (error) {
        cashDealsErrors++;
      }
    }

    console.log(`   ✅ Deleted: ${cashDealsDeleted} cash deals queue items`);
    if (cashDealsErrors > 0) {
      console.log(`   ❌ Errors: ${cashDealsErrors} items`);
    }

    const totalDeleted = ownerFinanceDeleted + cashDealsDeleted;
    const totalErrors = ownerFinanceErrors + cashDealsErrors;

    console.log(`\n   📊 Total: ${totalDeleted} queue items deleted`);

    if (totalErrors > 5) {
      const { alertSystemError } = await import('@/lib/error-monitoring');
      await alertSystemError(
        'Queue Cleanup',
        `High error rate: ${totalErrors} items failed to delete`,
        { deleted: totalDeleted, errors: totalErrors }
      ).catch((err) => console.warn('Failed to send alert:', err));
    }

    return {
      success: true,
      ownerFinance: {
        total: ownerFinanceSnapshot.size,
        deleted: ownerFinanceDeleted,
        errors: ownerFinanceErrors
      },
      cashDeals: {
        total: cashDealsSnapshot.size,
        deleted: cashDealsDeleted,
        errors: cashDealsErrors
      },
      totalDeleted,
      totalErrors
    };

  } catch (error) {
    console.error('   ❌ Queue cleanup error:', error);
    const { alertSystemError } = await import('@/lib/error-monitoring');
    await alertSystemError(
      'Queue Cleanup',
      error instanceof Error ? error.message : 'Unknown error',
      { error: String(error) }
    ).catch((err) => console.warn('Failed to send alert:', err));

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function upgradeZillowImageUrl(url: string): string {
  if (!url || !url.includes('zillowstatic.com')) return url;

  const lowResSizes = [
    'p_a.jpg', 'p_b.jpg', 'p_c.jpg', 'p_d.jpg', 'p_e.jpg', 'p_f.jpg', 'p_g.jpg', 'p_h.jpg',
    'cc_ft_192.webp', 'cc_ft_384.webp', 'cc_ft_576.webp', 'cc_ft_768.webp', 'cc_ft_960.webp', 'cc_ft_1344.webp', 'cc_ft_1536.webp',
    'cc_ft_192.jpg', 'cc_ft_384.jpg', 'cc_ft_576.jpg', 'cc_ft_768.jpg', 'cc_ft_960.jpg', 'cc_ft_1344.jpg', 'cc_ft_1536.jpg'
  ];

  for (const size of lowResSizes) {
    if (url.includes(size)) {
      return url.replace(size, 'uncropped_scaled_within_1536_1152.webp');
    }
  }

  return url;
}

function fixGoogleDriveUrl(url: string): string {
  if (!url || !url.includes('drive.google.com')) return url;

  let fileId = null;
  const match1 = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  const match2 = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);

  if (match1) fileId = match1[1];
  else if (match2) fileId = match2[1];

  if (url.includes('googleusercontent.com')) return url;

  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}=w2000`;
  }

  return url;
}

// ============================================================================
// 5. CLEANUP ARTICLES (Mon/Wed/Fri - from weekly-maintenance)
// ============================================================================

async function cleanupArticles() {
  try {
    console.log('📰 Cleaning up articles - keeping top 20 per brand...');

    const {
      cleanupLowQualityArticles,
      cleanupProcessedArticles
    } = await import('@/lib/feed-store-firestore');

    // Step 1: Keep only top 20 unprocessed articles per brand (by recency)
    const articleCleanup = await cleanupLowQualityArticles(20);

    console.log(`   Carz: ${articleCleanup.carz} articles deleted`);
    console.log(`   OwnerFi: ${articleCleanup.ownerfi} articles deleted`);

    // Step 2: Delete processed articles older than 30 days
    console.log('\n   🧹 Cleaning up old processed articles (>30 days)...');
    const processedCleanup = await cleanupProcessedArticles(30);

    console.log(`   Carz: ${processedCleanup.carz} processed articles deleted`);
    console.log(`   OwnerFi: ${processedCleanup.ownerfi} processed articles deleted`);

    const totalDeleted =
      (articleCleanup.carz || 0) +
      (articleCleanup.ownerfi || 0) +
      (processedCleanup.carz || 0) +
      (processedCleanup.ownerfi || 0);

    return {
      success: true,
      articlesDeleted: articleCleanup,
      processedDeleted: processedCleanup,
      totalDeleted
    };

  } catch (error) {
    console.error('   ❌ Article cleanup error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// 6. CLEANUP WORKFLOWS (Mon/Wed/Fri - from weekly-maintenance)
// ============================================================================

async function cleanupWorkflows() {
  try {
    console.log('🔄 Cleaning up completed workflows (>7 days)...');

    const { cleanupCompletedWorkflows } = await import('@/lib/feed-store-firestore');

    // Delete completed workflows older than 7 days
    const deleted = await cleanupCompletedWorkflows(24 * 7); // 7 days in hours

    console.log(`   ✅ ${deleted} completed workflows deleted`);

    return {
      success: true,
      deleted
    };

  } catch (error) {
    console.error('   ❌ Workflow cleanup error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// 7. SYNC YOUTUBE ANALYTICS (daily - from sync-youtube-analytics)
// ============================================================================

async function syncYouTubeAnalytics() {
  const YOUTUBE_BRANDS = ['abdullah', 'ownerfi', 'carz'];

  try {
    console.log('📺 Syncing YouTube analytics for all brands...');

    const {
      syncYouTubeAnalytics: syncAnalytics,
      analyzeContentPatterns
    } = await import('@/lib/youtube-analytics');
    const { getAdminDb } = await import('@/lib/firebase-admin');

    const adminDb = await getAdminDb();
    let brandsSynced = 0;
    const results: Record<string, any> = {};

    for (const brand of YOUTUBE_BRANDS) {
      try {
        const summary = await syncAnalytics(brand);

        if (summary) {
          const patterns = analyzeContentPatterns(summary.recentVideos);

          results[brand] = {
            success: true,
            subscribers: summary.totalSubscribers,
            totalViews: summary.totalViews,
            videosAnalyzed: summary.recentVideos.length,
            avgViewsPerVideo: Math.round(summary.avgViewsPerVideo)
          };

          // Save to Firestore
          if (adminDb) {
            await (adminDb as any).collection('youtube_analytics_summary').doc(brand).set({
              ...results[brand],
              patterns,
              lastSyncedAt: Date.now()
            }, { merge: true });
          }

          brandsSynced++;
          console.log(`   ✅ ${brand}: ${summary.recentVideos.length} videos, ${summary.avgViewsPerVideo.toFixed(0)} avg views`);
        } else {
          results[brand] = { success: false, error: 'Failed to fetch' };
          console.log(`   ❌ ${brand}: Failed to fetch`);
        }
      } catch (error) {
        results[brand] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        console.error(`   ❌ ${brand}:`, error instanceof Error ? error.message : error);
      }
    }

    console.log(`\n   📊 Synced ${brandsSynced}/${YOUTUBE_BRANDS.length} brands`);

    return {
      success: true,
      brandsSynced,
      totalBrands: YOUTUBE_BRANDS.length,
      results
    };

  } catch (error) {
    console.error('   ❌ YouTube sync error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
