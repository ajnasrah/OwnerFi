/**
 * Fix Property Image Quality Script
 *
 * Upgrades low-resolution Zillow images to high-resolution versions
 * Fixes Google Drive links to direct high-res URLs
 * Reports on image quality issues
 *
 * Usage: node scripts/fix-image-quality.js [--dry-run]
 */

const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin SDK
const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    })
  });
}

const db = admin.firestore();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

/**
 * Upgrade Zillow image URL to highest resolution
 *
 * Zillow image sizes:
 * - p_c.jpg = compressed thumbnail (worst)
 * - cc_ft_384.webp = 384px
 * - cc_ft_576.webp = 576px
 * - cc_ft_768.webp = 768px
 * - cc_ft_960.webp = 960px
 * - cc_ft_1152.webp = 1152px
 * - cc_ft_1344.webp = 1344px
 * - cc_ft_1536.webp = 1536px (best)
 * - uncropped_scaled_within_1536_1152.webp = full size
 */
function upgradeZillowImageUrl(url) {
  if (!url || !url.includes('zillowstatic.com')) {
    return url;
  }

  // Replace low-res with high-res
  let upgraded = url;

  // Replace all small sizes with 1536px (highest quality)
  const sizes = ['p_c.jpg', 'p_e.jpg', 'p_f.jpg', 'p_g.jpg', 'p_h.jpg',
                 'cc_ft_192.webp', 'cc_ft_384.webp', 'cc_ft_576.webp',
                 'cc_ft_768.webp', 'cc_ft_960.webp', 'cc_ft_1152.webp',
                 'cc_ft_1344.webp'];

  for (const size of sizes) {
    if (upgraded.includes(size)) {
      // Try uncropped full size first
      upgraded = upgraded.replace(size, 'uncropped_scaled_within_1536_1152.webp');
      return upgraded;
    }
  }

  // Already high-res or unknown format
  return url;
}

/**
 * Fix Google Drive image URL to direct high-res link
 */
function fixGoogleDriveUrl(url) {
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
function getImageSource(url) {
  if (!url) return 'none';
  if (url.includes('zillowstatic.com')) return 'zillow';
  if (url.includes('drive.google.com') || url.includes('googleusercontent.com')) return 'google-drive';
  if (url.includes('maps.googleapis.com/maps/api/streetview')) return 'street-view';
  return 'other';
}

/**
 * Get image resolution from Zillow URL
 */
function getZillowResolution(url) {
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

/**
 * Main execution
 */
async function main() {
  console.log('📸 Property Image Quality Upgrade Script');
  console.log('=========================================\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  try {
    // Fetch all properties
    const propertiesRef = db.collection('properties');
    const snapshot = await propertiesRef.get();

    console.log(`📊 Total properties: ${snapshot.size}\n`);

    let processedCount = 0;
    let upgradedCount = 0;
    let errorCount = 0;
    const updates = [];
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
      const updates_data = {};

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

              console.log(`\n📸 Property ${processedCount}/${snapshot.size}: ${property.address}`);
              console.log(`   Field: ${field}`);
              console.log(`   Source: Zillow (${resolution})`);
              console.log(`   Before: ${value.substring(0, 80)}...`);
              console.log(`   After:  ${upgraded.substring(0, 80)}...`);
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

            console.log(`\n📸 Property ${processedCount}/${snapshot.size}: ${property.address}`);
            console.log(`   Field: ${field}`);
            console.log(`   Source: Google Drive`);
            console.log(`   Before: ${value.substring(0, 80)}...`);
            console.log(`   After:  ${fixed.substring(0, 80)}...`);
          }
        } else if (source === 'street-view') {
          stats.streetView.total++;
        } else if (source === 'other') {
          stats.other.total++;
        }
      }

      if (needsUpdate) {
        upgradedCount++;

        if (!isDryRun) {
          updates.push({
            id: doc.id,
            data: updates_data
          });
        }
      }
    }

    // Perform batch updates if not dry run
    if (!isDryRun && updates.length > 0) {
      console.log(`\n\n📝 Updating ${updates.length} properties...\n`);

      for (const update of updates) {
        try {
          await propertiesRef.doc(update.id).update({
            ...update.data,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`✅ Updated: ${update.id}`);
        } catch (error) {
          console.error(`❌ Error updating ${update.id}:`, error.message);
          errorCount++;
        }
      }
    }

    // Summary
    console.log('\n\n=========================================');
    console.log('📊 SUMMARY');
    console.log('=========================================');
    console.log(`Total properties processed: ${processedCount}`);
    console.log(`\n📸 Image Sources:`);
    console.log(`   Zillow images: ${stats.zillow.total}`);
    console.log(`   - Low resolution: ${stats.zillow.lowRes}`);
    console.log(`   - Upgraded: ${stats.zillow.upgraded}`);
    console.log(`   Google Drive: ${stats.googleDrive.total}`);
    console.log(`   - Fixed: ${stats.googleDrive.upgraded}`);
    console.log(`   Google Street View: ${stats.streetView.total}`);
    console.log(`   Other sources: ${stats.other.total}`);
    console.log(`\n✏️  Properties upgraded: ${upgradedCount}`);
    console.log(`   Successfully updated: ${isDryRun ? 0 : updates.length - errorCount}`);
    console.log(`   Errors: ${errorCount}`);

    if (isDryRun && upgradedCount > 0) {
      console.log('\n💡 Run without --dry-run to apply changes');
    }

    if (stats.streetView.total > 0) {
      console.log(`\n⚠️  Warning: ${stats.streetView.total} properties using Google Street View`);
      console.log('   Consider replacing these with Zillow images for better quality');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
