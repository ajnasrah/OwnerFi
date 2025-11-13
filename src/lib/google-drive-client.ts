/**
 * Google Drive API Client
 *
 * Handles authentication and operations with Google Drive
 * Used for monitoring a folder for new raw video uploads
 */

import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

// Initialize Google Drive client with OAuth credentials
export function getGoogleDriveClient(): drive_v3.Drive {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob' // For installed apps
  );

  // Set credentials using refresh token
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * List video files in a specific folder
 * Returns only unprocessed video files
 */
export async function listVideoFiles(
  folderId: string,
  pageSize: number = 10
): Promise<drive_v3.Schema$File[]> {
  const drive = getGoogleDriveClient();

  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType contains 'video/' or name contains '.mp4' or name contains '.mov' or name contains '.avi') and trashed = false`,
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, properties)',
      pageSize,
      orderBy: 'createdTime desc',
    });

    return response.data.files || [];
  } catch (error) {
    console.error('Error listing Google Drive files:', error);
    throw new Error(`Failed to list Google Drive files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a file has been processed
 * Uses file properties to track processing status
 */
export async function isFileProcessed(fileId: string): Promise<boolean> {
  const drive = getGoogleDriveClient();

  try {
    const response = await drive.files.get({
      fileId,
      fields: 'properties',
    });

    return response.data.properties?.processed === 'true';
  } catch (error) {
    console.error(`Error checking if file ${fileId} is processed:`, error);
    return false;
  }
}

/**
 * Mark a file as processed
 */
export async function markFileAsProcessed(
  fileId: string,
  workflowId: string
): Promise<void> {
  const drive = getGoogleDriveClient();

  try {
    await drive.files.update({
      fileId,
      requestBody: {
        properties: {
          processed: 'true',
          workflowId,
          processedAt: new Date().toISOString(),
        },
      },
    });

    console.log(`✅ Marked file ${fileId} as processed (workflow: ${workflowId})`);
  } catch (error) {
    console.error(`Error marking file ${fileId} as processed:`, error);
    throw error;
  }
}

/**
 * Download a file from Google Drive
 * Returns a readable stream
 */
export async function downloadFile(fileId: string): Promise<Readable> {
  const drive = getGoogleDriveClient();

  try {
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      { responseType: 'stream' }
    );

    return response.data as unknown as Readable;
  } catch (error) {
    console.error(`Error downloading file ${fileId}:`, error);
    throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a file from Google Drive
 */
export async function deleteFile(fileId: string): Promise<void> {
  const drive = getGoogleDriveClient();

  try {
    await drive.files.delete({
      fileId,
    });

    console.log(`🗑️  Deleted file ${fileId} from Google Drive`);
  } catch (error) {
    console.error(`Error deleting file ${fileId}:`, error);
    throw error;
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(fileId: string): Promise<drive_v3.Schema$File> {
  const drive = getGoogleDriveClient();

  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink',
    });

    return response.data;
  } catch (error) {
    console.error(`Error getting metadata for file ${fileId}:`, error);
    throw error;
  }
}

/**
 * Upload a file to temporary storage and return a public URL
 * This is a helper for uploading to a temporary location that Submagic can access
 */
export async function uploadToTempStorage(
  fileStream: Readable,
  fileName: string
): Promise<string> {
  // Convert stream to buffer
  const chunks: any[] = [];
  for await (const chunk of fileStream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  // Upload to R2 temporary storage using S3 SDK
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
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

  const tempPath = `temp/personal-uploads/${Date.now()}-${fileName}`;

  await r2Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: tempPath,
    Body: buffer,
    ContentType: 'video/mp4',
  }));

  const url = `${publicUrl}/${tempPath}`;
  console.log(`📤 Uploaded ${fileName} to temporary storage: ${url}`);
  return url;
}

/**
 * Get unprocessed video files from the configured folder
 */
export async function getUnprocessedVideos(): Promise<drive_v3.Schema$File[]> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID not configured');
  }

  const allFiles = await listVideoFiles(folderId);

  // Filter out already processed files
  const unprocessedFiles: drive_v3.Schema$File[] = [];

  for (const file of allFiles) {
    if (file.id) {
      const processed = await isFileProcessed(file.id);
      if (!processed) {
        unprocessedFiles.push(file);
      }
    }
  }

  return unprocessedFiles;
}

/**
 * Validate Google Drive credentials
 */
export async function validateCredentials(): Promise<boolean> {
  try {
    const drive = getGoogleDriveClient();
    await drive.files.list({ pageSize: 1 });
    return true;
  } catch (error) {
    console.error('Google Drive credentials validation failed:', error);
    return false;
  }
}
