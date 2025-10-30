// Video Storage Utilities
// Download videos from authenticated endpoints and upload to public storage

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
 * Download video from authenticated endpoint and upload to Firebase Storage
 * Returns a publicly accessible URL
 */
export async function downloadAndUploadVideo(
  videoUrl: string,
  apiKey: string,
  fileName?: string
): Promise<string> {
  console.log('📥 Downloading video from authenticated endpoint...');
  console.log(`   URL: ${videoUrl.substring(0, 80)}...`);

  // Download video with authentication
  const response = await fetch(videoUrl, {
    headers: {
      'x-api-key': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} - ${response.statusText}`);
  }

  // SECURITY FIX: Validate file size before downloading to prevent OOM crashes
  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const sizeInMB = parseInt(contentLength) / 1024 / 1024;
    const MAX_VIDEO_SIZE_MB = 500; // 500 MB limit

    if (sizeInMB > MAX_VIDEO_SIZE_MB) {
      throw new Error(`Video too large: ${sizeInMB.toFixed(2)} MB exceeds ${MAX_VIDEO_SIZE_MB} MB limit`);
    }

    console.log(`   Video size: ${sizeInMB.toFixed(2)} MB (within limit)`);
  } else {
    console.warn('   ⚠️  Content-Length header missing - cannot validate size before download');
  }

  // Get video data as buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sizeInMB = (buffer.length / 1024 / 1024).toFixed(2);

  console.log(`✅ Downloaded video (${sizeInMB} MB)`);

  // Generate filename if not provided
  if (!fileName) {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    fileName = `viral-videos/${timestamp}-${randomStr}.mp4`;
  }

  console.log('☁️ Uploading to Firebase Storage...');

  // Upload to Firebase Storage
  const storage = getFirebaseAdmin();
  const bucket = storage.bucket();
  const file = bucket.file(fileName);

  // Calculate deletion date (72 hours from now)
  const deletionDate = new Date();
  deletionDate.setHours(deletionDate.getHours() + 72);

  await file.save(buffer, {
    contentType: 'video/mp4',
    metadata: {
      cacheControl: 'public, max-age=259200', // Cache for 72 hours (3 days)
      customMetadata: {
        autoDeleteAfter: deletionDate.toISOString(),
        createdAt: new Date().toISOString()
      }
    }
  });

  // Generate a signed URL (valid for 72 hours) instead of making file public
  // This works with uniform bucket-level access enabled
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 72 * 60 * 60 * 1000, // 72 hours (3 days)
  });

  console.log(`✅ Uploaded to Firebase Storage with signed URL`);

  return signedUrl;
}

/**
 * Download video from authenticated endpoint and upload directly to Cloudflare R2
 * Returns a permanent public URL - more efficient than Firebase Storage
 */
export async function downloadAndUploadToR2(
  videoUrl: string,
  apiKey: string,
  fileName?: string
): Promise<string> {
  console.log('📥 Downloading video from authenticated endpoint...');
  console.log(`   URL: ${videoUrl.substring(0, 80)}...`);

  // Download video with authentication
  const response = await fetch(videoUrl, {
    headers: {
      'x-api-key': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} - ${response.statusText}`);
  }

  // SECURITY FIX: Validate file size before downloading to prevent OOM crashes
  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const sizeInMB = parseInt(contentLength) / 1024 / 1024;
    const MAX_VIDEO_SIZE_MB = 500; // 500 MB limit

    if (sizeInMB > MAX_VIDEO_SIZE_MB) {
      throw new Error(`Video too large: ${sizeInMB.toFixed(2)} MB exceeds ${MAX_VIDEO_SIZE_MB} MB limit`);
    }

    console.log(`   Video size: ${sizeInMB.toFixed(2)} MB (within limit)`);
  } else {
    console.warn('   ⚠️  Content-Length header missing - cannot validate size before download');
  }

  // Get video data as buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sizeInMB = (buffer.length / 1024 / 1024).toFixed(2);

  console.log(`✅ Downloaded video (${sizeInMB} MB)`);

  // Generate filename if not provided
  if (!fileName) {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    fileName = `heygen-videos/${timestamp}-${randomStr}.mp4`;
  }

  console.log('☁️  Uploading to Cloudflare R2...');

  // Upload to R2
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured');
  }

  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const bucketName = process.env.R2_BUCKET_NAME || 'ownerfi-podcast-videos';

  await r2Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: buffer,
    ContentType: 'video/mp4',
    Metadata: {
      'uploaded-at': new Date().toISOString(),
      'source': 'heygen',
      'auto-delete-after': new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
    },
  }));

  // Construct public URL
  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL}/${fileName}`
    : `https://pub-${accountId}.r2.dev/${fileName}`;

  console.log(`✅ Uploaded to R2: ${publicUrl}`);

  // Track R2 storage cost
  try {
    const { trackCost, calculateR2Cost } = await import('@/lib/cost-tracker');
    const fileSizeGB = parseFloat(sizeInMB) / 1024; // Convert MB to GB

    // Determine brand from fileName (format: heygen-videos/timestamp-random.mp4)
    // For now, track under 'ownerfi' as default - can be improved to parse brand from path
    await trackCost(
      'ownerfi',
      'r2',
      'video_upload',
      fileSizeGB,
      calculateR2Cost(fileSizeGB),
      undefined
    );
    console.log(`💰 [R2] Tracked storage cost: $${calculateR2Cost(fileSizeGB).toFixed(6)} (${sizeInMB} MB)`);
  } catch (costError) {
    console.error(`⚠️  Failed to track R2 cost:`, costError);
  }

  return publicUrl;
}

/**
 * Download video from Submagic and upload to Cloudflare R2
 * Returns a permanent public URL (no expiration) for Metricool/Late compatibility
 *
 * @param submagicDownloadUrl - URL to download video from Submagic
 * @param fileName - Optional custom filename/path (supports brand-specific paths)
 */
export async function uploadSubmagicVideo(
  submagicDownloadUrl: string,
  fileName?: string
): Promise<string> {
  console.log('📥 Downloading video from Submagic...');
  console.log(`   URL: ${submagicDownloadUrl.substring(0, 80)}...`);

  // Download video with timeout and retry
  let response: Response;
  let lastError: Error | undefined;

  // Retry up to 3 times with exponential backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`   Attempt ${attempt}/3...`);

      // Use AbortController for timeout (5 minutes for large video downloads)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

      response = await fetch(submagicDownloadUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OwnerFi/1.0)',
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // SECURITY FIX: Validate file size before downloading
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const sizeInMB = parseInt(contentLength) / 1024 / 1024;
        const MAX_VIDEO_SIZE_MB = 500; // 500 MB limit

        if (sizeInMB > MAX_VIDEO_SIZE_MB) {
          throw new Error(`Video too large: ${sizeInMB.toFixed(2)} MB exceeds ${MAX_VIDEO_SIZE_MB} MB limit`);
        }

        console.log(`   Video size: ${sizeInMB.toFixed(2)} MB (within limit)`);
      } else {
        console.warn('   ⚠️  Content-Length header missing - cannot validate size before download');
      }

      // Success - break out of retry loop
      console.log(`   ✅ Connected successfully`);
      break;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`   ❌ Attempt ${attempt} failed:`, lastError.message);

      // If this is the last attempt, throw the error
      if (attempt === 3) {
        throw new Error(`Failed to download video from Submagic after 3 attempts: ${lastError.message}`);
      }

      // Wait before retrying (exponential backoff: 2s, 4s)
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.log(`   ⏳ Retrying in ${backoffMs / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  // response! is safe here because we either have it or threw an error above
  if (!response!) {
    throw new Error('Failed to download video - no response received');
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sizeInMB = (buffer.length / 1024 / 1024).toFixed(2);

  console.log(`✅ Downloaded video (${sizeInMB} MB)`);

  // Generate filename if not provided (with brand-specific path support)
  if (!fileName) {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    fileName = `viral-videos/submagic-${timestamp}-${randomStr}.mp4`;
  }

  console.log('☁️  Uploading to Cloudflare R2...');

  // Upload to R2
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured');
  }

  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const bucketName = process.env.R2_BUCKET_NAME || 'ownerfi-podcast-videos';

  await r2Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: buffer,
    ContentType: 'video/mp4',
    Metadata: {
      'uploaded-at': new Date().toISOString(),
      'source': 'submagic',
      'auto-delete-after': new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
    },
  }));

  // Construct public URL
  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL}/${fileName}`
    : `https://pub-${accountId}.r2.dev/${fileName}`;

  console.log(`✅ Uploaded to R2: ${publicUrl}`);

  // Track R2 storage cost
  try {
    const { trackCost, calculateR2Cost } = await import('@/lib/cost-tracker');
    const fileSizeGB = parseFloat(sizeInMB) / 1024; // Convert MB to GB

    // Parse brand from fileName path (format: viral-videos/carz-timestamp-random.mp4)
    let brand: string = 'ownerfi'; // default
    if (fileName.includes('carz-')) brand = 'carz';
    else if (fileName.includes('vassdistro-')) brand = 'vassdistro';
    else if (fileName.includes('podcast-')) brand = 'podcast';

    await trackCost(
      brand,
      'r2',
      'video_upload',
      fileSizeGB,
      calculateR2Cost(fileSizeGB),
      undefined
    );
    console.log(`💰 [R2] Tracked storage cost: $${calculateR2Cost(fileSizeGB).toFixed(6)} (${sizeInMB} MB)`);
  } catch (costError) {
    console.error(`⚠️  Failed to track R2 cost:`, costError);
  }

  return publicUrl;
}

/**
 * Delete expired videos (older than 72 hours)
 * Called daily at 3 AM by cleanup-videos cron
 */
export async function deleteExpiredVideos(): Promise<{
  deleted: number;
  errors: number;
  totalSize: number;
}> {
  console.log('🗑️  Checking for expired videos in R2 and Firebase...');

  let deleted = 0;
  let errors = 0;
  let totalSize = 0;
  const now = Date.now();
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  // ===== CLOUDFLARE R2 CLEANUP =====
  console.log('☁️  Cleaning up R2...');
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME || 'ownerfi-podcast-videos';

    if (accountId && accessKeyId && secretAccessKey) {
      const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      const r2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });

      const listResponse = await r2Client.send(new ListObjectsV2Command({ Bucket: bucketName }));
      const objects = listResponse.Contents || [];

      console.log(`  Found ${objects.length} objects in R2`);

      for (const obj of objects) {
        try {
          if (!obj.Key || !obj.LastModified) continue;

          const ageMs = now - obj.LastModified.getTime();

          if (ageMs > THREE_DAYS_MS) {
            console.log(`  Deleting R2: ${obj.Key} (${((obj.Size || 0) / 1024 / 1024).toFixed(2)} MB, ${(ageMs / 1000 / 60 / 60).toFixed(1)}h old)`);
            await r2Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: obj.Key }));
            deleted++;
            totalSize += (obj.Size || 0);
          }
        } catch (error) {
          console.error(`  Error deleting R2 ${obj.Key}:`, error);
          errors++;
        }
      }
    } else {
      console.warn('⚠️  R2 credentials not configured');
    }
  } catch (error) {
    console.error('❌ R2 cleanup error:', error);
    errors++;
  }

  // ===== FIREBASE CLEANUP (legacy) =====
  console.log('🔥 Cleaning up Firebase...');
  try {
    const storage = getFirebaseAdmin();
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({ prefix: 'viral-videos/' });

    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        const autoDeleteAfter = metadata.metadata?.autoDeleteAfter;
        if (!autoDeleteAfter) continue;

        if (now >= new Date(autoDeleteAfter as string).getTime()) {
          const size = parseInt(String(metadata.size || '0'));
          console.log(`  Deleting Firebase: ${file.name} (${(size / 1024 / 1024).toFixed(2)} MB)`);
          await file.delete();
          deleted++;
          totalSize += size;
        }
      } catch (error) {
        console.error(`  Error deleting Firebase ${file.name}:`, error);
        errors++;
      }
    }
  } catch (error) {
    console.error('❌ Firebase cleanup error:', error);
  }

  console.log(`✅ Cleanup: ${deleted} deleted, ${(totalSize / 1024 / 1024).toFixed(2)} MB freed, ${errors} errors`);
  return { deleted, errors, totalSize };
}
