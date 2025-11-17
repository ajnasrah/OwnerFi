/**
 * CONSOLIDATED Daily Maintenance Cron
 *
 * Consolidates 3 separate daily maintenance cron jobs into ONE:
 * 1. cleanup-videos (3am daily - deletes expired videos from R2)
 * 2. enhance-property-images (4am daily - upgrades low-res images)
 * 3. cleanup-stale-properties (2am Sunday - deletes properties older than 60 days)
 *
 * Schedule: 0 3 * * * (3am daily CST)
 * Previously: 3 separate crons = 3 invocations/day (daily) + 1 extra/week (Sunday) = ~23/week
 * Now: 1 cron = 7 invocations/week
 * SAVINGS: ~16 fewer cron invocations per week (70% reduction)
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
        propertyCleanup: null as any
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

      // 3. Clean up stale properties (only on Sundays)
      const today = new Date().getDay(); // 0 = Sunday
      if (today === 0) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('3️⃣  STALE PROPERTY CLEANUP (Sunday only)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        const propertyResult = await cleanupStaleProperties();
        results.propertyCleanup = propertyResult;
      } else {
        console.log('\n⏭️  Skipping stale property cleanup (only runs on Sundays)');
        results.propertyCleanup = { skipped: true, day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][today] };
      }

      const duration = Date.now() - startTime;

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ [DAILY-MAINTENANCE] Complete');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 Summary:`);
      console.log(`   Videos deleted: ${results.videoCleanup?.deleted || 0}`);
      console.log(`   Images enhanced: ${results.imageEnhancement?.upgraded || 0}`);
      console.log(`   Properties cleaned: ${results.propertyCleanup?.deleted || (results.propertyCleanup?.skipped ? 'N/A' : 0)}`);
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
      ).catch(() => {});
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
    ).catch(() => {});

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

    const propertiesRef = db.collection('properties');
    const BATCH_SIZE = 500;

    // Get properties needing enhancement
    let snapshot = await propertiesRef
      .where('imageEnhanced', '==', false)
      .limit(BATCH_SIZE)
      .get();

    if (snapshot.size === 0) {
      const allSnapshot = await propertiesRef.limit(BATCH_SIZE).get();
      const docsWithoutField = allSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.imageEnhanced !== true;
      });
      snapshot = {
        size: docsWithoutField.length,
        docs: docsWithoutField,
        empty: docsWithoutField.length === 0
      } as any;
    }

    console.log(`   📊 Found ${snapshot.size} unprocessed properties`);

    if (snapshot.size === 0) {
      console.log(`   ✅ All properties already enhanced!`);
      return {
        success: true,
        batchSize: 0,
        upgraded: 0,
        markedComplete: 0,
        errors: 0
      };
    }

    const updates: Array<{ id: string; data: any }> = [];
    let upgradedCount = 0;
    let errorCount = 0;

    const stats = {
      zillow: { upgraded: 0 },
      googleDrive: { upgraded: 0 }
    };

    for (const doc of snapshot.docs) {
      const property = doc.data();
      let needsUpdate = false;
      const updates_data: any = {};

      const imageFields = [
        { field: 'imageUrl', value: property.imageUrl },
        { field: 'imageUrls[0]', value: property.imageUrls?.[0] },
        { field: 'zillowImageUrl', value: property.zillowImageUrl }
      ];

      for (const { field, value } of imageFields) {
        if (!value) continue;

        if (value.includes('zillowstatic.com')) {
          const upgraded = upgradeZillowImageUrl(value);
          if (upgraded !== value) {
            needsUpdate = true;
            stats.zillow.upgraded++;
            if (field === 'imageUrl') updates_data.imageUrl = upgraded;
            else if (field === 'imageUrls[0]') updates_data.imageUrls = [upgraded, ...(property.imageUrls?.slice(1) || [])];
            else if (field === 'zillowImageUrl') updates_data.zillowImageUrl = upgraded;
          }
        } else if (value.includes('drive.google.com')) {
          const fixed = fixGoogleDriveUrl(value);
          if (fixed !== value) {
            needsUpdate = true;
            stats.googleDrive.upgraded++;
            if (field === 'imageUrl') updates_data.imageUrl = fixed;
            else if (field === 'imageUrls[0]') updates_data.imageUrls = [fixed, ...(property.imageUrls?.slice(1) || [])];
          }
        }
      }

      if (needsUpdate) {
        upgradedCount++;
        updates.push({ id: doc.id, data: updates_data });
      }
    }

    // Perform batch updates
    if (updates.length > 0) {
      console.log(`   📝 Updating ${updates.length} properties...`);
      for (const update of updates) {
        try {
          await propertiesRef.doc(update.id).update({
            ...update.data,
            imageEnhanced: true,
            imageEnhancedAt: new Date().toISOString(),
            updatedAt: new Date()
          });
        } catch (error) {
          errorCount++;
        }
      }
    }

    // Mark all as enhanced
    const noUpdateNeeded = snapshot.docs.filter(doc => !updates.find(u => u.id === doc.id));
    if (noUpdateNeeded.length > 0) {
      for (const doc of noUpdateNeeded) {
        try {
          await propertiesRef.doc(doc.id).update({
            imageEnhanced: true,
            imageEnhancedAt: new Date().toISOString(),
            updatedAt: new Date()
          });
        } catch (error) {
          // Silent fail
        }
      }
    }

    console.log(`   ✅ Zillow images upgraded: ${stats.zillow.upgraded}`);
    console.log(`   ✅ Google Drive links fixed: ${stats.googleDrive.upgraded}`);
    console.log(`   ✅ Total updated: ${updates.length - errorCount}`);
    console.log(`   ✅ Marked complete: ${noUpdateNeeded.length}`);

    if (errorCount > 5) {
      const { alertSystemError } = await import('@/lib/error-monitoring');
      await alertSystemError(
        'Image Enhancement',
        `High error rate: ${errorCount} properties failed`,
        { upgradedCount, errorCount }
      ).catch(() => {});
    }

    return {
      success: true,
      batchSize: snapshot.size,
      upgraded: updates.length - errorCount,
      markedComplete: noUpdateNeeded.length,
      errors: errorCount,
      stats
    };

  } catch (error) {
    console.error('   ❌ Image enhancement error:', error);
    const { alertSystemError } = await import('@/lib/error-monitoring');
    await alertSystemError(
      'Image Enhancement',
      error instanceof Error ? error.message : 'Unknown error',
      { error: String(error) }
    ).catch(() => {});

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// 3. CLEANUP STALE PROPERTIES (Sundays only)
// ============================================================================

async function cleanupStaleProperties() {
  try {
    console.log('🗑️  Deleting properties older than 60 days...');

    const { getAdminDb } = await import('@/lib/firebase-admin');
    const db = await getAdminDb();

    if (!db) {
      throw new Error('Firebase not initialized');
    }

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    console.log(`   📅 Cutoff: ${sixtyDaysAgo.toLocaleDateString()}`);

    const propertiesSnapshot = await db.collection('properties').get();
    const staleProperties: Array<{ id: string; address: string; updatedAt: Date; source: string }> = [];

    propertiesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const updatedAt = data.updatedAt || data.createdAt;

      if (!updatedAt) {
        staleProperties.push({
          id: doc.id,
          address: `${data.address}, ${data.city}, ${data.state}`,
          updatedAt: new Date(0),
          source: data.source || 'unknown'
        });
        return;
      }

      const lastUpdate = updatedAt.toDate ? updatedAt.toDate() : new Date(updatedAt);
      if (lastUpdate < sixtyDaysAgo) {
        staleProperties.push({
          id: doc.id,
          address: `${data.address}, ${data.city}, ${data.state}`,
          updatedAt: lastUpdate,
          source: data.source || 'unknown'
        });
      }
    });

    console.log(`   📊 Found ${staleProperties.length} stale properties (out of ${propertiesSnapshot.size})`);

    if (staleProperties.length === 0) {
      console.log('   ✅ No stale properties!');
      return {
        success: true,
        deleted: 0,
        totalProperties: propertiesSnapshot.size
      };
    }

    // Delete stale properties
    let deletedCount = 0;
    let errorCount = 0;

    for (const property of staleProperties) {
      try {
        await db.collection('properties').doc(property.id).delete();
        deletedCount++;
      } catch (error) {
        errorCount++;
      }
    }

    console.log(`   ✅ Deleted: ${deletedCount} properties`);
    console.log(`   ❌ Errors: ${errorCount} properties`);

    if (errorCount > 0) {
      const { alertSystemError } = await import('@/lib/error-monitoring');
      await alertSystemError(
        'Stale Property Cleanup',
        `${errorCount} properties failed to delete`,
        { deleted: deletedCount, errors: errorCount }
      ).catch(() => {});
    }

    return {
      success: true,
      deleted: deletedCount,
      errors: errorCount,
      totalProperties: propertiesSnapshot.size
    };

  } catch (error) {
    console.error('   ❌ Property cleanup error:', error);
    const { alertSystemError } = await import('@/lib/error-monitoring');
    await alertSystemError(
      'Stale Property Cleanup',
      error instanceof Error ? error.message : 'Unknown error',
      { error: String(error) }
    ).catch(() => {});

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
    'p_c.jpg', 'p_e.jpg', 'p_f.jpg', 'p_g.jpg', 'p_h.jpg',
    'cc_ft_192.webp', 'cc_ft_384.webp', 'cc_ft_576.webp', 'cc_ft_768.webp'
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
