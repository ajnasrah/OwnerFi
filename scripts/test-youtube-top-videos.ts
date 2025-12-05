/**
 * Test YouTube Analytics - Fetch top performing videos for all brands
 */

import { google } from 'googleapis';

const brands = [
  { name: 'ABDULLAH', key: 'abdullah' },
  { name: 'CARZ', key: 'carz' },
  { name: 'OWNERFI', key: 'ownerfi' },
  { name: 'GAZA', key: 'gaza' }
];

interface VideoStats {
  title: string;
  videoId: string;
  views: number;
  likes: number;
  comments: number;
  engagement: number;
  publishedAt: string;
  isShort: boolean;
}

async function testTopVideos() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║              YOUTUBE TOP PERFORMING VIDEOS - ALL BRANDS                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  for (const brand of brands) {
    console.log('━'.repeat(78));
    console.log(`📺 ${brand.name}`);
    console.log('━'.repeat(78));

    const refreshToken = process.env[`YOUTUBE_${brand.name}_REFRESH_TOKEN`];
    if (!refreshToken) {
      console.log('  ❌ No refresh token configured');
      continue;
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground'
      );
      oauth2Client.setCredentials({ refresh_token: refreshToken });

      const youtube = google.youtube('v3');

      // Get channel info
      const channelRes = await youtube.channels.list({
        auth: oauth2Client,
        part: ['snippet', 'statistics', 'contentDetails'],
        mine: true,
      });

      const channel = channelRes.data.items?.[0];
      if (!channel) {
        console.log('  ❌ No channel found');
        continue;
      }

      console.log(`  Channel: ${channel.snippet?.title}`);
      console.log(`  Subscribers: ${parseInt(channel.statistics?.subscriberCount || '0').toLocaleString()}`);
      console.log(`  Total Videos: ${channel.statistics?.videoCount}`);
      console.log('');

      // Get uploads playlist
      const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylistId) {
        console.log('  ❌ No uploads playlist found');
        continue;
      }

      // Get recent videos
      const playlistRes = await youtube.playlistItems.list({
        auth: oauth2Client,
        part: ['snippet', 'contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults: 50,
      });

      const videoIds = playlistRes.data.items
        ?.map(item => item.contentDetails?.videoId)
        .filter((id): id is string => !!id) || [];

      if (videoIds.length === 0) {
        console.log('  No videos found');
        continue;
      }

      // Get video stats
      const videosRes = await youtube.videos.list({
        auth: oauth2Client,
        part: ['snippet', 'statistics', 'contentDetails'],
        id: videoIds,
      });

      const videos: VideoStats[] = [];

      for (const video of videosRes.data.items || []) {
        const views = parseInt(video.statistics?.viewCount || '0');
        const likes = parseInt(video.statistics?.likeCount || '0');
        const comments = parseInt(video.statistics?.commentCount || '0');
        const duration = video.contentDetails?.duration || 'PT0S';

        // Parse duration to seconds
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const seconds = match
          ? (parseInt(match[1] || '0') * 3600) + (parseInt(match[2] || '0') * 60) + parseInt(match[3] || '0')
          : 0;

        videos.push({
          title: video.snippet?.title || '',
          videoId: video.id || '',
          views,
          likes,
          comments,
          engagement: views > 0 ? ((likes + comments) / views) * 100 : 0,
          publishedAt: video.snippet?.publishedAt || '',
          isShort: seconds <= 60,
        });
      }

      // Sort by views
      videos.sort((a, b) => b.views - a.views);

      // Show top 5
      console.log('  🏆 TOP 5 PERFORMING VIDEOS:');
      console.log('  ' + '-'.repeat(74));

      const top5 = videos.slice(0, 5);
      for (let i = 0; i < top5.length; i++) {
        const v = top5[i];
        const shortLabel = v.isShort ? ' [SHORT]' : '';
        console.log(`  ${i + 1}. ${v.title.substring(0, 50)}...${shortLabel}`);
        console.log(`     👁️  ${v.views.toLocaleString()} views | 👍 ${v.likes.toLocaleString()} | 💬 ${v.comments}`);
        console.log(`     📈 Engagement: ${v.engagement.toFixed(2)}%`);
        console.log(`     🔗 https://youtube.com/${v.isShort ? 'shorts/' : 'watch?v='}${v.videoId}`);
        console.log('');
      }

      // Summary stats
      const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
      const avgViews = videos.length > 0 ? totalViews / videos.length : 0;
      const avgEngagement = videos.length > 0
        ? videos.reduce((sum, v) => sum + v.engagement, 0) / videos.length
        : 0;
      const shorts = videos.filter(v => v.isShort);

      console.log('  📊 SUMMARY:');
      console.log(`     Videos analyzed: ${videos.length}`);
      console.log(`     Total views: ${totalViews.toLocaleString()}`);
      console.log(`     Avg views/video: ${avgViews.toFixed(0)}`);
      console.log(`     Avg engagement: ${avgEngagement.toFixed(2)}%`);
      console.log(`     Shorts: ${shorts.length} (${((shorts.length/videos.length)*100).toFixed(0)}%)`);

    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }

    console.log('');
  }

  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    ✅ TOP VIDEOS ANALYSIS COMPLETE                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
}

testTopVideos().then(() => process.exit(0)).catch(console.error);
