// Podcast Video Storage - Download from HeyGen and upload to Firebase
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin if not already initialized
function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Firebase Admin credentials not configured');
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: `${projectId}.firebasestorage.app`
    });
  }

  return getStorage();
}

/**
 * Download video from HeyGen (public URL) and upload to Firebase Storage
 * Returns a publicly accessible URL that's valid for 7 days
 */
export async function uploadHeyGenVideoToFirebase(
  heygenVideoUrl: string,
  episodeNumber?: number
): Promise<string> {
  console.log('📥 Downloading video from HeyGen...');
  console.log(`   URL: ${heygenVideoUrl.substring(0, 80)}...`);

  // Download video from HeyGen (no auth needed - it's a signed URL)
  const response = await fetch(heygenVideoUrl);

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} - ${response.statusText}`);
  }

  // Get video data as buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sizeInMB = (buffer.length / 1024 / 1024).toFixed(2);

  console.log(`✅ Downloaded video (${sizeInMB} MB)`);

  // Generate filename
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(7);
  const episodePrefix = episodeNumber ? `episode-${episodeNumber}` : 'podcast';
  const fileName = `podcast-videos/${episodePrefix}-${timestamp}-${randomStr}.mp4`;

  console.log('☁️  Uploading to Firebase Storage...');
  console.log(`   Path: ${fileName}`);

  // Upload to Firebase Storage
  const storage = getFirebaseAdmin();
  const bucket = storage.bucket();
  const file = bucket.file(fileName);

  // Calculate deletion date (7 days from now)
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + 7);

  await file.save(buffer, {
    contentType: 'video/mp4',
    metadata: {
      cacheControl: 'public, max-age=604800', // Cache for 7 days
      customMetadata: {
        autoDeleteAfter: deletionDate.toISOString(),
        createdAt: new Date().toISOString(),
        source: 'heygen',
        ...(episodeNumber && { episodeNumber: episodeNumber.toString() })
      }
    }
  });

  // Generate a signed URL (valid for 7 days)
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  console.log(`✅ Uploaded to Firebase Storage`);
  console.log(`   Signed URL valid until: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString()}`);
  console.log(`   Auto-delete after: ${deletionDate.toLocaleString()}`);

  return signedUrl;
}

/**
 * Download video from Submagic and upload to Cloudflare R2
 * Returns a permanent public URL (no expiration) for Metricool compatibility
 */
export async function uploadSubmagicVideoToFirebase(
  submagicDownloadUrl: string,
  episodeNumber?: number
): Promise<string> {
  // Forward to R2 implementation for better Metricool compatibility
  const { uploadSubmagicVideoToR2 } = await import('./r2-storage.js');
  return uploadSubmagicVideoToR2(submagicDownloadUrl, episodeNumber);
}

/**
 * Delete expired podcast videos (older than 7 days)
 * Should be called by a cron job or scheduled task
 */
export async function deleteExpiredPodcastVideos(): Promise<{
  deleted: number;
  errors: number;
  totalSize: number;
}> {
  console.log('🗑️  Checking for expired podcast videos...');

  const storage = getFirebaseAdmin();
  const bucket = storage.bucket();

  // List all files in the podcast-videos directory
  const [files] = await bucket.getFiles({
    prefix: 'podcast-videos/'
  });

  let deleted = 0;
  let errors = 0;
  let totalSize = 0;
  const now = new Date();

  for (const file of files) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      const autoDeleteAfter = metadata.metadata?.autoDeleteAfter;

      if (!autoDeleteAfter) {
        // Skip files without autoDeleteAfter metadata
        continue;
      }

      const deleteDate = new Date(autoDeleteAfter as string);

      // Check if file is expired
      if (now >= deleteDate) {
        const size = parseInt(String(metadata.size || '0'));
        totalSize += size;

        console.log(`  Deleting expired video: ${file.name} (${(size / 1024 / 1024).toFixed(2)} MB)`);
        await file.delete();
        deleted++;
      }
    } catch (error) {
      console.error(`  Error processing ${file.name}:`, error);
      errors++;
    }
  }

  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
  console.log(`✅ Cleanup complete: ${deleted} videos deleted (${totalSizeMB} MB freed), ${errors} errors`);

  return { deleted, errors, totalSize };
}
