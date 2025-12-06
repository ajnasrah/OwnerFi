/**
 * Deep analysis of top performing videos across all brands
 * Provides recommendations for ChatGPT prompt optimization
 */

import { google } from 'googleapis';

const brands = [
  { name: 'ABDULLAH', key: 'abdullah' },
  { name: 'CARZ', key: 'carz' },
  { name: 'OWNERFI', key: 'ownerfi' }
];

interface VideoData {
  brand: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  engagement: number;
  publishedAt: string;
}

async function analyzeAllBrands() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  const allVideos: VideoData[] = [];

  console.log('Fetching video data from all brands...\n');

  for (const brand of brands) {
    const refreshToken = process.env[`YOUTUBE_${brand.name}_REFRESH_TOKEN`];
    if (!refreshToken) {
      console.log(`Skipping ${brand.name} - no refresh token`);
      continue;
    }

    console.log(`Fetching ${brand.name}...`);

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const youtube = google.youtube('v3');

    // Get channel
    const channelRes = await youtube.channels.list({
      auth: oauth2Client,
      part: ['contentDetails'],
      mine: true,
    });

    const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) continue;

    // Get videos
    const playlistRes = await youtube.playlistItems.list({
      auth: oauth2Client,
      part: ['contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
    });

    const videoIds = playlistRes.data.items
      ?.map(item => item.contentDetails?.videoId)
      .filter((id): id is string => !!id) || [];

    const videosRes = await youtube.videos.list({
      auth: oauth2Client,
      part: ['snippet', 'statistics', 'contentDetails'],
      id: videoIds,
    });

    for (const video of videosRes.data.items || []) {
      const views = parseInt(video.statistics?.viewCount || '0');
      const likes = parseInt(video.statistics?.likeCount || '0');
      const comments = parseInt(video.statistics?.commentCount || '0');
      const title = video.snippet?.title || '';

      allVideos.push({
        brand: brand.key,
        title,
        views,
        likes,
        comments,
        engagement: views > 0 ? ((likes + comments) / views) * 100 : 0,
        publishedAt: video.snippet?.publishedAt || '',
      });
    }
  }

  // Sort by views
  allVideos.sort((a, b) => b.views - a.views);

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║           TOP 25 PERFORMING VIDEOS ACROSS ALL BRANDS                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  const top25 = allVideos.slice(0, 25);
  top25.forEach((v, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. [${v.brand.toUpperCase().padEnd(8)}] ${v.views.toLocaleString().padStart(6)} views | ${v.title.substring(0, 60)}`);
  });

  // Deep Pattern Analysis
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      PATTERN ANALYSIS                                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Emoji analysis
  const withEmoji = top25.filter(v => /[\u{1F300}-\u{1F9FF}]/u.test(v.title));
  console.log(`📊 EMOJIS: ${withEmoji.length}/25 (${(withEmoji.length / 25 * 100).toFixed(0)}%) have emojis`);

  const emojiCounts: Record<string, number> = {};
  for (const v of top25) {
    const emojis = v.title.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];
    for (const e of emojis) {
      emojiCounts[e] = (emojiCounts[e] || 0) + 1;
    }
  }
  const sortedEmojis = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1]);
  console.log(`   Top emojis: ${sortedEmojis.slice(0, 8).map(([e, c]) => `${e}(${c})`).join(' ')}`);

  // #Shorts tag
  const withShorts = top25.filter(v => v.title.includes('#Shorts'));
  console.log(`\n📊 #SHORTS TAG: ${withShorts.length}/25 (${(withShorts.length / 25 * 100).toFixed(0)}%) include #Shorts`);

  // Question marks
  const withQuestion = top25.filter(v => v.title.includes('?'));
  console.log(`\n📊 QUESTIONS: ${withQuestion.length}/25 (${(withQuestion.length / 25 * 100).toFixed(0)}%) are questions`);
  if (withQuestion.length > 0) {
    console.log('   Examples:');
    withQuestion.slice(0, 3).forEach(v => console.log(`   - "${v.title.substring(0, 60)}..."`));
  }

  // Title length
  const avgLength = top25.reduce((sum, v) => sum + v.title.length, 0) / top25.length;
  const minLength = Math.min(...top25.map(v => v.title.length));
  const maxLength = Math.max(...top25.map(v => v.title.length));
  console.log(`\n📊 TITLE LENGTH:`);
  console.log(`   Average: ${avgLength.toFixed(0)} chars`);
  console.log(`   Range: ${minLength} - ${maxLength} chars`);

  // Action words
  const actionWords = ['unlock', 'discover', 'learn', 'watch', 'see', 'get', 'find', 'save', 'buy', 'new', 'breaking', 'exposed', 'revealed'];
  const withAction = top25.filter(v => actionWords.some(w => v.title.toLowerCase().includes(w)));
  console.log(`\n📊 ACTION WORDS: ${withAction.length}/25 (${(withAction.length / 25 * 100).toFixed(0)}%)`);
  const actionHits: Record<string, number> = {};
  for (const v of top25) {
    for (const w of actionWords) {
      if (v.title.toLowerCase().includes(w)) {
        actionHits[w] = (actionHits[w] || 0) + 1;
      }
    }
  }
  const sortedActions = Object.entries(actionHits).sort((a, b) => b[1] - a[1]);
  console.log(`   Top action words: ${sortedActions.slice(0, 5).map(([w, c]) => `"${w}"(${c})`).join(', ')}`);

  // Urgency/FOMO words
  const urgencyWords = ['now', 'today', 'must', 'breaking', 'urgent', 'alert', 'update', 'latest', 'just'];
  const withUrgency = top25.filter(v => urgencyWords.some(w => v.title.toLowerCase().includes(w)));
  console.log(`\n📊 URGENCY/FOMO: ${withUrgency.length}/25 (${(withUrgency.length / 25 * 100).toFixed(0)}%)`);

  // Numbers
  const withNumbers = top25.filter(v => /\d/.test(v.title));
  console.log(`\n📊 NUMBERS: ${withNumbers.length}/25 (${(withNumbers.length / 25 * 100).toFixed(0)}%) contain numbers`);

  // Word frequency
  console.log('\n📊 TOP KEYWORDS IN HIGH-PERFORMING TITLES:');
  const wordCounts: Record<string, number> = {};
  const stopWords = ['the', 'a', 'an', 'is', 'in', 'to', 'of', 'for', 'and', 'or', 'your', 'you', 'this', 'that', 'it', 'on', 'with', 'shorts'];
  for (const v of top25) {
    const words = v.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
    for (const w of words) {
      if (w.length > 2 && !stopWords.includes(w)) {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      }
    }
  }
  const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);
  console.log(`   ${sortedWords.slice(0, 15).map(([w, c]) => `"${w}"(${c})`).join(', ')}`);

  // First word/hook analysis
  console.log('\n📊 OPENING HOOKS (first words after emoji):');
  const firstWords: Record<string, number> = {};
  for (const v of top25) {
    const clean = v.title.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace('#Shorts', '').trim();
    const first = clean.split(' ')[0];
    if (first && first.length > 1) {
      firstWords[first] = (firstWords[first] || 0) + 1;
    }
  }
  const sortedFirst = Object.entries(firstWords).sort((a, b) => b[1] - a[1]);
  console.log(`   ${sortedFirst.slice(0, 10).map(([w, c]) => `"${w}"(${c})`).join(', ')}`);

  // Brand distribution in top performers
  console.log('\n📊 BRAND DISTRIBUTION IN TOP 25:');
  const brandCounts: Record<string, number> = {};
  for (const v of top25) {
    brandCounts[v.brand] = (brandCounts[v.brand] || 0) + 1;
  }
  for (const [brand, count] of Object.entries(brandCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${brand.toUpperCase()}: ${count} videos (${(count / 25 * 100).toFixed(0)}%)`);
  }

  // RECOMMENDATIONS
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    CHATGPT PROMPT RECOMMENDATIONS                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('Based on analysis of your top 25 performing videos:\n');

  console.log('1️⃣  EMOJI PLACEMENT');
  console.log('   • Start titles with a relevant emoji (⚡️🚗🏡📈)');
  console.log('   • Top emojis: ' + sortedEmojis.slice(0, 5).map(([e]) => e).join(' '));
  console.log('');

  console.log('2️⃣  TITLE STRUCTURE');
  console.log(`   • Keep titles ${Math.round(avgLength - 10)}-${Math.round(avgLength + 10)} characters`);
  console.log('   • DON\'T include #Shorts in title (YouTube auto-detects)');
  console.log('   • Use question format for ~' + (withQuestion.length / 25 * 100).toFixed(0) + '% of videos');
  console.log('');

  console.log('3️⃣  POWER WORDS TO USE');
  console.log('   • Action: ' + sortedActions.slice(0, 4).map(([w]) => w).join(', '));
  console.log('   • Keywords: ' + sortedWords.slice(0, 6).map(([w]) => w).join(', '));
  console.log('');

  console.log('4️⃣  HOOK FORMULA');
  console.log('   • [Emoji] + [Action/Curiosity Word] + [Benefit/Topic]');
  console.log('   • Examples from top performers:');
  top25.slice(0, 3).forEach(v => {
    console.log(`     "${v.title.substring(0, 55)}..."`);
  });
  console.log('');

  console.log('5️⃣  ENGAGEMENT BOOSTERS');
  if (withQuestion.length > 5) {
    console.log('   • Questions work well - they create curiosity');
  }
  if (withNumbers.length > 5) {
    console.log('   • Include numbers when relevant (stats, prices, counts)');
  }
  console.log('   • Create urgency with words like: new, update, breaking, now');
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUGGESTED PROMPT UPDATE:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`
Generate a YouTube Shorts title that:
1. Starts with ONE relevant emoji (${sortedEmojis.slice(0, 4).map(([e]) => e).join(' ')})
2. Uses ${Math.round(avgLength - 10)}-${Math.round(avgLength + 10)} characters total
3. Does NOT include #Shorts
4. Includes one of these power words: ${sortedActions.slice(0, 4).map(([w]) => w).join(', ')}
5. Creates curiosity or urgency
6. ${withQuestion.length > 5 ? 'Occasionally uses question format' : 'Uses statement format'}

Formula: [Emoji] [Power Word] [Benefit/Hook]!

Examples of high-performing titles:
${top25.slice(0, 3).map(v => `- "${v.title}"`).join('\n')}
`);
}

analyzeAllBrands().then(() => process.exit(0)).catch(console.error);
