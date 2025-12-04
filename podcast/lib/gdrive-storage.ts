// Google Drive Storage for Podcast Videos
// Provides permanent public URLs for Metricool compatibility

import { google } from 'googleapis';
import { Readable } from 'stream';

// Initialize Google Drive client
function getGoogleDriveClient() {
  const credentials = {
    client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Google Drive credentials not configured. Check GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY');
  }

  const auth = new google.auth.JWT(
    credentials.client_email,
    undefined,
    credentials.private_key,
    ['https://www.googleapis.com/auth/drive.file']
  );

  return google.drive({ version: 'v3', auth });
}

/**
 * Upload video to Google Drive and return public URL
 * Google Drive provides permanent public URLs (no expiration) - perfect for Metricool
 */
export async function uploadVideoToGoogleDrive(
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

  console.log('☁️  Uploading to Google Drive...');
  console.log(`   File: ${fileName}`);

  // Upload to Google Drive
  const drive = getGoogleDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID; // Optional: specify a folder

  // Convert buffer to readable stream
  const stream = Readable.from(buffer);

  const fileMetadata: any = {
    name: fileName,
    mimeType: 'video/mp4',
  };

  if (folderId) {
    fileMetadata.parents = [folderId];
  }

  const media = {
    mimeType: 'video/mp4',
    body: stream,
  };

  // Create file
  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink, webContentLink',
  });

  const fileId = file.data.id!;

  // Make file publicly accessible (anyone with link can view)
  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  // Get the direct download URL
  // Format: https://drive.google.com/uc?export=download&id=FILE_ID
  const publicUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  console.log(`✅ Uploaded to Google Drive`);
  console.log(`   File ID: ${fileId}`);
  console.log(`   Public URL: ${publicUrl}`);
  console.log(`   No expiration - permanent URL for Metricool`);

  // Add custom properties for 48-hour auto-delete
  const deleteAfter = new Date();
  deleteAfter.setHours(deleteAfter.getHours() + 48); // Delete after 48 hours

  await drive.files.update({
    fileId: fileId,
    requestBody: {
      description: JSON.stringify({
        uploadedAt: new Date().toISOString(),
        deleteAfter: deleteAfter.toISOString(),
        source: source,
        episodeNumber: episodeNumber || null,
        autoDelete: true
      })
    }
  });

  console.log(`   📝 Metadata:`);
  console.log(`      - Uploaded: ${new Date().toISOString()}`);
  console.log(`      - Source: ${source}`);
  console.log(`      - Episode: ${episodeNumber || 'N/A'}`);
  console.log(`      - Auto-delete after: ${deleteAfter.toLocaleString()} (48 hours)`);

  return publicUrl;
}

/**
 * Upload Submagic video specifically
 */
export async function uploadSubmagicVideoToGoogleDrive(
  submagicDownloadUrl: string,
  episodeNumber?: number
): Promise<string> {
  return uploadVideoToGoogleDrive(submagicDownloadUrl, episodeNumber, 'submagic');
}

/**
 * Upload HeyGen video specifically
 */
export async function uploadHeyGenVideoToGoogleDrive(
  heygenVideoUrl: string,
  episodeNumber?: number
): Promise<string> {
  return uploadVideoToGoogleDrive(heygenVideoUrl, episodeNumber, 'heygen');
}

/**
 * Delete expired videos from Google Drive (videos older than 48 hours)
 * Should be called by a cron job every few hours
 */
export async function deleteExpiredGoogleDriveVideos(): Promise<{
  deleted: number;
  errors: number;
  totalSize: number;
}> {
  console.log(`🗑️  Checking for expired Google Drive videos (>48 hours old)...`);

  const drive = getGoogleDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  // Get all video files
  let query = `mimeType='video/mp4' and trashed=false`;
  if (folderId) {
    query += ` and '${folderId}' in parents`;
  }

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name, description, createdTime, size)',
  });

  const files = response.data.files || [];
  let deleted = 0;
  let errors = 0;
  let totalSize = 0;
  const now = new Date();

  for (const file of files) {
    try {
      // Parse metadata from description
      let shouldDelete = false;

      if (file.description) {
        try {
          const metadata = JSON.parse(file.description);
          const deleteAfter = new Date(metadata.deleteAfter);

          // Check if file should be deleted
          if (metadata.autoDelete && now >= deleteAfter) {
            shouldDelete = true;
          }
        } catch {
          // If metadata can't be parsed, check creation time (fallback)
          const createdTime = new Date(file.createdTime!);
          const hoursSinceCreation = (now.getTime() - createdTime.getTime()) / (1000 * 60 * 60);

          if (hoursSinceCreation >= 48) {
            shouldDelete = true;
          }
        }
      } else {
        // No description - use creation time
        const createdTime = new Date(file.createdTime!);
        const hoursSinceCreation = (now.getTime() - createdTime.getTime()) / (1000 * 60 * 60);

        if (hoursSinceCreation >= 48) {
          shouldDelete = true;
        }
      }

      if (shouldDelete) {
        const size = parseInt(file.size || '0');
        totalSize += size;

        console.log(`  Deleting expired: ${file.name} (${(size / 1024 / 1024).toFixed(2)} MB)`);
        await drive.files.delete({ fileId: file.id! });
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
