// Cloudflare R2 Storage for Podcast Videos
// Provides permanent public URLs for Metricool compatibility

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize R2 client
function getR2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured. Check CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Upload video to Cloudflare R2 and return public URL
 * R2 provides permanent public URLs (no expiration) - perfect for Metricool
 */
export async function uploadVideoToR2(
  videoUrl: string,
  episodeNumber?: number,
  source: 'heygen' | 'submagic' = 'submagic'
): Promise<string> {
  console.log(`📥 Downloading video from ${source}...`);
  console.log(`   URL: ${videoUrl.substring(0, 80)}...`);

  // Download video
  const response = await fetch(videoUrl);

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} - ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sizeInMB = (buffer.length / 1024 / 1024).toFixed(2);

  console.log(`✅ Downloaded video (${sizeInMB} MB)`);

  // Generate filename
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(7);
  const episodePrefix = episodeNumber ? `episode-${episodeNumber}` : 'podcast';
  const fileName = `${episodePrefix}-${source}-${timestamp}-${randomStr}.mp4`;

  console.log('☁️  Uploading to Cloudflare R2...');
  console.log(`   File: ${fileName}`);

  // Upload to R2
  const r2Client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME || 'ownerfi-podcast-videos';

  await r2Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: buffer,
    ContentType: 'video/mp4',
    Metadata: {
      'uploaded-at': new Date().toISOString(),
      'source': source,
      'episode': episodeNumber?.toString() || 'unknown',
      'auto-delete-after': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  }));

  // Construct public URL
  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL}/${fileName}`
    : `https://pub-${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.dev/${fileName}`;

  console.log(`✅ Uploaded to R2`);
  console.log(`   Public URL: ${publicUrl}`);
  console.log(`   No expiration - permanent URL for Metricool`);

  return publicUrl;
}

/**
 * Upload Submagic video specifically
 */
export async function uploadSubmagicVideoToR2(
  submagicDownloadUrl: string,
  episodeNumber?: number
): Promise<string> {
  return uploadVideoToR2(submagicDownloadUrl, episodeNumber, 'submagic');
}

/**
 * Upload HeyGen video specifically
 */
export async function uploadHeyGenVideoToR2(
  heygenVideoUrl: string,
  episodeNumber?: number
): Promise<string> {
  return uploadVideoToR2(heygenVideoUrl, episodeNumber, 'heygen');
}
