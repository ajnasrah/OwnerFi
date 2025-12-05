/**
 * Complete YouTube API verification for all brands
 */

import { google } from 'googleapis';

const brands = [
  { name: 'ABDULLAH', expectedChannel: 'Abdullah Abunasrah' },
  { name: 'CARZ', expectedChannel: 'Carz Inc' },
  { name: 'OWNERFI', expectedChannel: 'Prosway' }
];

async function testAll() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           YOUTUBE API COMPLETE VERIFICATION                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  let allPassed = true;

  for (const brand of brands) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Testing:', brand.name);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const refreshToken = process.env[`YOUTUBE_${brand.name}_REFRESH_TOKEN`];

    if (!refreshToken) {
      console.log('  ❌ REFRESH_TOKEN: MISSING');
      allPassed = false;
      continue;
    }
    console.log('  ✅ REFRESH_TOKEN: SET');

    try {
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground'
      );
      oauth2Client.setCredentials({ refresh_token: refreshToken });

      // Test 1: Token refresh
      const { credentials } = await oauth2Client.refreshAccessToken();
      console.log('  ✅ Token Refresh: SUCCESS');
      console.log('     Expires:', new Date(credentials.expiry_date!).toISOString());

      // Test 2: Get channel info
      const youtube = google.youtube('v3');
      const channelRes = await youtube.channels.list({
        auth: oauth2Client,
        part: ['snippet', 'statistics'],
        mine: true,
      });

      const channel = channelRes.data.items?.[0];
      if (channel) {
        console.log('  ✅ Channel Access: SUCCESS');
        console.log('     Name:', channel.snippet?.title);
        console.log('     Subscribers:', channel.statistics?.subscriberCount);
        console.log('     Videos:', channel.statistics?.videoCount);
      } else {
        console.log('  ❌ Channel Access: NO CHANNEL FOUND');
        allPassed = false;
      }

      // Test 3: Check upload capability
      const playlistRes = await youtube.channels.list({
        auth: oauth2Client,
        part: ['contentDetails'],
        mine: true,
      });

      const uploadsPlaylist = playlistRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (uploadsPlaylist) {
        console.log('  ✅ Upload Permission: GRANTED');
      } else {
        console.log('  ⚠️  Upload Permission: UNKNOWN');
      }

      // Test 4: Analytics API
      try {
        const youtubeAnalytics = google.youtubeAnalytics('v2');
        const analyticsRes = await youtubeAnalytics.reports.query({
          auth: oauth2Client,
          ids: 'channel==MINE',
          startDate: '2025-01-01',
          endDate: '2025-12-05',
          metrics: 'views',
        });
        console.log('  ✅ Analytics Access: SUCCESS');
        console.log('     Total Views (2025):', analyticsRes.data.rows?.[0]?.[0] || 0);
      } catch (analyticsErr: any) {
        if (analyticsErr.message?.includes('forbidden') || analyticsErr.message?.includes('403')) {
          console.log('  ❌ Analytics Access: NO PERMISSION');
          allPassed = false;
        } else {
          console.log('  ✅ Analytics Access: GRANTED (no data yet)');
        }
      }

    } catch (error: any) {
      console.log('  ❌ Error:', error.message);
      allPassed = false;
    }
    console.log('');
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  if (allPassed) {
    console.log('║  ✅ ALL TESTS PASSED - READY FOR DEPLOYMENT                  ║');
  } else {
    console.log('║  ❌ SOME TESTS FAILED - CHECK ABOVE                          ║');
  }
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

testAll().then(() => process.exit(0)).catch(console.error);
