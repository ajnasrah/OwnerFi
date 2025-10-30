// Property Image Enhancement Cron Job
// Automatically upgrades low-resolution property images to high-resolution versions
// Runs daily at 4 AM via Vercel Cron

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const maxDuration = 300; // 5 minutes max

/**
 * Upgrade Zillow image URL to highest resolution
 */
function upgradeZillowImageUrl(url: string): string {
  if (!url || !url.includes('zillowstatic.com')) {
    return url;
  }

  let upgraded = url;

  // Replace all small sizes with 1536px (highest quality)
  const sizes = [
    'p_c.jpg', 'p_e.jpg', 'p_f.jpg', 'p_g.jpg', 'p_h.jpg',
    'cc_ft_192.webp', 'cc_ft_384.webp', 'cc_ft_576.webp',
    'cc_ft_768.webp', 'cc_ft_960.webp', 'cc_ft_1152.webp',
    'cc_ft_1344.webp'
  ];

  for (const size of sizes) {
    if (upgraded.includes(size)) {
      // Try uncropped full size first
      upgraded = upgraded.replace(size, 'uncropped_scaled_within_1536_1152.webp');
      return upgraded;
    }
  }

  return url;
}

/**
 * Fix Google Drive image URL to direct high-res link
 */
function fixGoogleDriveUrl(url: string): string {
  if (!url || !url.includes('drive.google.com')) {
    return url;
  }

  // Extract file ID from various Google Drive URL formats
  let fileId = null;

  // Format 1: https://drive.google.com/file/d/FILE_ID/view
  const match1 = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) {
    fileId = match1[1];
  }

  // Format 2: https://drive.google.com/open?id=FILE_ID
  const match2 = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (match2) {
    fileId = match2[1];
  }

  // Format 3: Already a direct link
  if (url.includes('googleusercontent.com')) {
    return url;
  }

  if (fileId) {
    // Use high-resolution direct link (w=2000 for 2000px width)
    return `https://lh3.googleusercontent.com/d/${fileId}=w2000`;
  }

  return url;
}

/**
 * Determine image source type
 */
function getImageSource(url: string): string {
  if (!url) return 'none';
  if (url.includes('zillowstatic.com')) return 'zillow';
  if (url.includes('drive.google.com') || url.includes('googleusercontent.com')) return 'google-drive';
  if (url.includes('maps.googleapis.com/maps/api/streetview')) return 'street-view';
  return 'other';
}

/**
 * Get image resolution from Zillow URL
 */
function getZillowResolution(url: string): string {
  if (!url || !url.includes('zillowstatic.com')) return 'unknown';

  if (url.includes('p_c.jpg') || url.includes('p_e.jpg')) return 'thumbnail';
  if (url.includes('cc_ft_384')) return '384px';
  if (url.includes('cc_ft_576')) return '576px';
  if (url.includes('cc_ft_768')) return '768px';
  if (url.includes('cc_ft_960')) return '960px';
  if (url.includes('cc_ft_1152')) return '1152px';
  if (url.includes('cc_ft_1344')) return '1344px';
  if (url.includes('cc_ft_1536')) return '1536px';
  if (url.includes('uncropped_scaled_within_1536_1152')) return 'full-size';

  return 'unknown';
}

export async function GET(request: NextRequest) {
  console.log('📸 Starting property image enhancement cron job...');

  try {
    // Verify Vercel Cron authentication
    const authHeader = request.headers.get('authorization');
    const CRON_SECRET = process.env.CRON_SECRET;

    // Check if request is from Vercel Cron (has x-vercel-cron header)
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getAdminDb();
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase not initialized' },
        { status: 500 }
      );
    }
    const propertiesRef = db.collection('properties');
    const snapshot = await propertiesRef.get();

    console.log(`📊 Processing ${snapshot.size} properties...`);

    let processedCount = 0;
    let upgradedCount = 0;
    let errorCount = 0;
    const updates: Array<{ id: string; data: any }> = [];

    const stats = {
      zillow: { total: 0, lowRes: 0, upgraded: 0 },
      googleDrive: { total: 0, upgraded: 0 },
      streetView: { total: 0 },
      other: { total: 0 }
    };

    for (const doc of snapshot.docs) {
      processedCount++;
      const property = doc.data();

      let needsUpdate = false;
      const updates_data: any = {};

      // Check all image fields
      const imageFields = [
        { field: 'imageUrl', value: property.imageUrl },
        { field: 'imageUrls[0]', value: property.imageUrls?.[0] },
        { field: 'zillowImageUrl', value: property.zillowImageUrl }
      ];

      for (const { field, value } of imageFields) {
        if (!value) continue;

        const source = getImageSource(value);

        if (source === 'zillow') {
          stats.zillow.total++;
          const resolution = getZillowResolution(value);

          // Check if low-res
          if (['thumbnail', '384px', '576px', '768px'].includes(resolution)) {
            stats.zillow.lowRes++;
            const upgraded = upgradeZillowImageUrl(value);

            if (upgraded !== value) {
              needsUpdate = true;
              stats.zillow.upgraded++;

              if (field === 'imageUrl') {
                updates_data.imageUrl = upgraded;
              } else if (field === 'imageUrls[0]') {
                updates_data.imageUrls = [upgraded, ...(property.imageUrls?.slice(1) || [])];
              } else if (field === 'zillowImageUrl') {
                updates_data.zillowImageUrl = upgraded;
              }

              console.log(`📸 Upgrading ${property.address} (${resolution} -> full-size)`);
            }
          }
        } else if (source === 'google-drive') {
          stats.googleDrive.total++;
          const fixed = fixGoogleDriveUrl(value);

          if (fixed !== value) {
            needsUpdate = true;
            stats.googleDrive.upgraded++;

            if (field === 'imageUrl') {
              updates_data.imageUrl = fixed;
            } else if (field === 'imageUrls[0]') {
              updates_data.imageUrls = [fixed, ...(property.imageUrls?.slice(1) || [])];
            }

            console.log(`📸 Fixing Google Drive URL for ${property.address}`);
          }
        } else if (source === 'street-view') {
          stats.streetView.total++;
        } else if (source === 'other') {
          stats.other.total++;
        }
      }

      if (needsUpdate) {
        upgradedCount++;
        updates.push({
          id: doc.id,
          data: updates_data
        });
      }
    }

    // Perform batch updates
    if (updates.length > 0) {
      console.log(`📝 Updating ${updates.length} properties...`);

      for (const update of updates) {
        try {
          await propertiesRef.doc(update.id).update({
            ...update.data,
            updatedAt: new Date()
          });
        } catch (error) {
          console.error(`❌ Error updating ${update.id}:`, error);
          errorCount++;
        }
      }
    }

    console.log('✅ Image enhancement completed!');
    console.log(`   Properties processed: ${processedCount}`);
    console.log(`   Zillow images upgraded: ${stats.zillow.upgraded}`);
    console.log(`   Google Drive links fixed: ${stats.googleDrive.upgraded}`);
    console.log(`   Total properties updated: ${updates.length - errorCount}`);
    console.log(`   Errors: ${errorCount}`);

    // Send alert if there were many errors
    if (errorCount > 5) {
      console.error(`⚠️  High error rate: ${errorCount} properties failed to update`);

      const { alertSystemError } = await import('@/lib/error-monitoring');
      await alertSystemError(
        'Image Enhancement',
        `High error rate during image enhancement: ${errorCount} properties failed to update`,
        { upgradedCount, errorCount }
      ).catch(err => {
        console.warn('Failed to send alert:', err.message);
      });
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      upgraded: upgradedCount - errorCount,
      errors: errorCount,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Image enhancement cron error:', error);

    const { alertSystemError } = await import('@/lib/error-monitoring');
    await alertSystemError(
      'Image Enhancement Cron',
      error instanceof Error ? error.message : 'Unknown error during image enhancement',
      { error: String(error) }
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
