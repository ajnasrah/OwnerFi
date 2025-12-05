/**
 * Check YouTube API credentials and test connection
 */

import { google } from 'googleapis';

async function checkYouTube() {
  console.log('=== Testing YouTube API Credentials ===\n');

  // Check credentials
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  console.log('Shared credentials:');
  console.log('  CLIENT_ID:', clientId ? 'SET' : 'MISSING');
  console.log('  CLIENT_SECRET:', clientSecret ? 'SET' : 'MISSING');
  console.log('');

  // Check each brand
  const brands = ['ABDULLAH', 'CARZ', 'OWNERFI'];

  for (const brand of brands) {
    const refreshToken = process.env[`YOUTUBE_${brand}_REFRESH_TOKEN`];
    console.log(`${brand}:`);
    console.log(`  REFRESH_TOKEN: ${refreshToken ? 'SET' : 'MISSING'}`);

    if (clientId && clientSecret && refreshToken) {
      try {
        const oauth2Client = new google.auth.OAuth2(
          clientId,
          clientSecret,
          'https://developers.google.com/oauthplayground'
        );

        oauth2Client.setCredentials({
          refresh_token: refreshToken,
        });

        // Try to get access token
        const { credentials } = await oauth2Client.refreshAccessToken();
        console.log('  ✅ Token refresh: SUCCESS');

        // Get channel info
        const youtube = google.youtube('v3');
        const response = await youtube.channels.list({
          auth: oauth2Client,
          part: ['snippet'],
          mine: true,
        });

        const channel = response.data.items?.[0];
        if (channel) {
          console.log(`  ✅ Channel: ${channel.snippet?.title}`);
        } else {
          console.log('  ⚠️  No channel found');
        }
      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`);
        if (error.message.includes('invalid_grant')) {
          console.log('     → Refresh token expired - needs regeneration');
        }
      }
    }
    console.log('');
  }
}

checkYouTube().then(() => process.exit(0)).catch(console.error);
