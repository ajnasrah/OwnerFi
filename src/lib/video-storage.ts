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

  // Calculate deletion date (7 days from now)
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + 7);

  await file.save(buffer, {
    contentType: 'video/mp4',
    metadata: {
      cacheControl: 'public, max-age=604800', // Cache for 7 days (1 week)
      customMetadata: {
        autoDeleteAfter: deletionDate.toISOString(),
        createdAt: new Date().toISOString()
      }
    }
  });

  // Generate a signed URL (valid for 7 days) instead of making file public
  // This works with uniform bucket-level access enabled
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
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
      'auto-delete-after': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  }));

  // Construct public URL
  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL}/${fileName}`
    : `https://pub-${accountId}.r2.dev/${fileName}`;

  console.log(`✅ Uploaded to R2: ${publicUrl}`);

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

  // Download video
  const response = await fetch(submagicDownloadUrl);

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} - ${response.statusText}`);
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
      'auto-delete-after': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  }));

  // Construct public URL
  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL}/${fileName}`
    : `https://pub-${accountId}.r2.dev/${fileName}`;

  console.log(`✅ Uploaded to R2: ${publicUrl}`);

  return publicUrl;
}

/**
 * Delete expired videos (older than 7 days)
 * Should be called by a cron job or scheduled task
 */
export async function deleteExpiredVideos(): Promise<{
  deleted: number;
  errors: number;
  totalSize: number;
}> {
  console.log('🗑️  Checking for expired videos...');

  const storage = getFirebaseAdmin();
  const bucket = storage.bucket();

  // List all files in the viral-videos directory
  const [files] = await bucket.getFiles({
    prefix: 'viral-videos/'
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
