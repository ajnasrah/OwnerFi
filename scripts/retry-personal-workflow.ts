/**
 * Retry Personal Video Workflow
 * Unmarkes the file in Google Drive so it can be reprocessed
 */

import { google } from 'googleapis';

async function retry() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const fileId = '1rwNUf0Crf09DZn-izePvplDzduTS9pKy';

  console.log('🔄 Removing processed flag from file...');

  try {
    await drive.files.update({
      fileId,
      requestBody: {
        properties: {
          processed: 'false',
        },
      },
    });

    console.log('✅ File unmarked - ready to reprocess');
    console.log('\nNow triggering the cron job...\n');

    // Trigger the cron
    const response = await fetch('http://localhost:3000/api/cron/check-google-drive', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    console.log('Cron result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

retry();
