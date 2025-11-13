/**
 * Google Drive OAuth Setup Script
 *
 * This script helps you obtain the OAuth refresh token needed for Google Drive integration.
 * Run: npm run setup:google-drive
 */

import { google } from 'googleapis';
import * as readline from 'readline';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 Google Drive OAuth Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check for required environment variables
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ Missing required environment variables!\n');
    console.log('Please add these to your .env.local file:');
    console.log('  GOOGLE_DRIVE_CLIENT_ID="your-client-id.apps.googleusercontent.com"');
    console.log('  GOOGLE_DRIVE_CLIENT_SECRET="your-client-secret"\n');
    console.log('To get these credentials:');
    console.log('  1. Go to https://console.cloud.google.com/');
    console.log('  2. Create a project or select existing one');
    console.log('  3. Enable Google Drive API');
    console.log('  4. Create OAuth 2.0 credentials (Desktop app)');
    console.log('  5. Download the credentials JSON\n');
    process.exit(1);
  }

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob' // For installed apps
  );

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent screen to get refresh token
  });

  console.log('📋 Step 1: Authorize this app');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Open this URL in your browser:\n');
  console.log(`\x1b[36m${authUrl}\x1b[0m\n`);
  console.log('This will open a Google consent screen where you can:');
  console.log('  1. Select your Google account');
  console.log('  2. Review the permissions');
  console.log('  3. Click "Allow"');
  console.log('  4. Copy the authorization code\n');

  // Prompt for auth code
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise<string>((resolve) => {
    rl.question('📋 Step 2: Enter the authorization code: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!code) {
    console.error('\n❌ No authorization code provided. Exiting.\n');
    process.exit(1);
  }

  console.log('\n🔄 Exchanging authorization code for tokens...\n');

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.error('❌ No refresh token received!');
      console.log('\nThis can happen if you\'ve already authorized this app before.');
      console.log('To fix this:');
      console.log('  1. Go to https://myaccount.google.com/permissions');
      console.log('  2. Remove the app');
      console.log('  3. Run this script again\n');
      process.exit(1);
    }

    console.log('✅ Successfully obtained tokens!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Add this to your .env.local file:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN="${tokens.refresh_token}"\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test the token
    console.log('🧪 Testing token...\n');
    oauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.list({
      pageSize: 1,
      fields: 'files(id, name)',
    });

    console.log('✅ Token is valid! Successfully connected to Google Drive.');
    console.log(`   Found ${response.data.files?.length || 0} file(s) in your drive.\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Next Steps:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('1. Add the refresh token to your .env.local file');
    console.log('2. Create a Google Drive folder for video uploads');
    console.log('3. Get the folder ID from the URL:');
    console.log('   https://drive.google.com/drive/folders/[FOLDER_ID]');
    console.log('4. Add GOOGLE_DRIVE_FOLDER_ID to .env.local');
    console.log('5. Add LATE_PERSONAL_PROFILE_ID to .env.local');
    console.log('6. Deploy to Vercel and add environment variables');
    console.log('7. Set up the cron job in vercel.json\n');
    console.log('See docs/GOOGLE_DRIVE_SETUP.md for full instructions.\n');
  } catch (error) {
    console.error('❌ Error obtaining tokens:', error);
    console.log('\nPlease check:');
    console.log('  - Authorization code is correct');
    console.log('  - Client ID and Secret are correct');
    console.log('  - Google Drive API is enabled\n');
    process.exit(1);
  }
}

main().catch(console.error);
