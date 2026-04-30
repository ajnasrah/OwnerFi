import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const getR2Client = () => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '';
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });
};

/**
 * Upload video from URL to R2 storage
 */
export async function uploadVideoToR2(videoUrl: string, key: string): Promise<string> {
  try {
    // Download video
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Upload to R2
    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME || '';
    const publicUrl = process.env.R2_PUBLIC_URL || '';
    
    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000', // Cache for 1 year
    }));

    // Return public URL
    return `${publicUrl}/${key}`;
  } catch (error) {
    console.error('R2 upload error:', error);
    throw error;
  }
}