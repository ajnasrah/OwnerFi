/**
 * Diagnose TikTok Posting Issue
 * Checks exactly what's happening with Late.dev accounts and TikTok
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const LATE_API_KEY = process.env.LATE_API_KEY?.trim();

const BRANDS = [
  { id: 'carz', profileId: process.env.LATE_CARZ_PROFILE_ID?.trim() },
  { id: 'ownerfi', profileId: process.env.LATE_OWNERFI_PROFILE_ID?.trim() },
  { id: 'abdullah', profileId: process.env.LATE_ABDULLAH_PROFILE_ID?.trim() },
  { id: 'gaza', profileId: process.env.LATE_GAZA_PROFILE_ID?.trim() },
];

interface Account {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  status?: string;
  error?: string;
}

async function getAccounts(profileId: string): Promise<Account[]> {
  const response = await fetch(
    `${LATE_BASE_URL}/accounts?profileId=${profileId}`,
    {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Late API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.accounts || data.data || [];
}

async function getRecentPosts(profileId: string, limit: number = 10): Promise<any[]> {
  const response = await fetch(
    `${LATE_BASE_URL}/posts?profileId=${profileId}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) return [];

  const data = await response.json();
  return data.posts || data.data || data || [];
}

async function diagnoseTikTok() {
  console.log('\n' + '='.repeat(70));
  console.log('  TIKTOK POSTING DIAGNOSIS');
  console.log('='.repeat(70));
  console.log(`  Time: ${new Date().toLocaleString()}`);
  console.log();

  if (!LATE_API_KEY) {
    console.error('ERROR: LATE_API_KEY not set');
    process.exit(1);
  }

  for (const brand of BRANDS) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${brand.id.toUpperCase()}`);
    console.log(`${'─'.repeat(60)}`);

    if (!brand.profileId) {
      console.log('  ❌ No profile ID configured');
      continue;
    }

    console.log(`  Profile ID: ${brand.profileId}`);

    // Get accounts
    try {
      const accounts = await getAccounts(brand.profileId);

      console.log(`\n  CONNECTED ACCOUNTS:`);

      const tiktokAccount = accounts.find(a => a.platform?.toLowerCase() === 'tiktok');
      const youtubeAccount = accounts.find(a => a.platform?.toLowerCase() === 'youtube');

      accounts.forEach(acc => {
        const isTikTok = acc.platform?.toLowerCase() === 'tiktok';
        const isYouTube = acc.platform?.toLowerCase() === 'youtube';
        const highlight = isTikTok || isYouTube ? '>>> ' : '    ';
        const status = acc.status ? ` (${acc.status})` : '';
        const error = acc.error ? ` ERROR: ${acc.error}` : '';
        console.log(`  ${highlight}${acc.platform}: ${acc.username || acc.displayName || acc._id}${status}${error}`);
      });

      if (!tiktokAccount) {
        console.log(`\n  ⚠️  TIKTOK NOT CONNECTED for ${brand.id}!`);
      } else {
        console.log(`\n  ✅ TikTok connected: ${tiktokAccount.username || tiktokAccount._id}`);
      }

      if (!youtubeAccount) {
        console.log(`  ⚠️  YOUTUBE NOT CONNECTED for ${brand.id}!`);
      } else {
        console.log(`  ✅ YouTube connected: ${youtubeAccount.username || youtubeAccount._id}`);
      }

      // Get recent posts to see what platforms were actually used
      console.log(`\n  RECENT POSTS:`);
      const posts = await getRecentPosts(brand.profileId, 5);

      if (posts.length === 0) {
        console.log('    No recent posts found');
      } else {
        for (const post of posts) {
          const createdAt = post.createdAt ? new Date(post.createdAt).toLocaleString() : 'Unknown';
          const status = post.status || 'unknown';
          const platforms = post.platforms || [];

          console.log(`\n    Post at ${createdAt} (${status}):`);

          const platformNames = platforms.map((p: any) => p.platform).sort();
          console.log(`      Requested platforms: ${platformNames.join(', ') || 'none'}`);

          // Check each platform status
          const hasTikTok = platforms.some((p: any) => p.platform?.toLowerCase() === 'tiktok');
          const tikTokStatus = platforms.find((p: any) => p.platform?.toLowerCase() === 'tiktok');

          if (hasTikTok) {
            console.log(`      TikTok: ${tikTokStatus?.status || 'pending'} ${tikTokStatus?.error || ''}`);
          } else {
            console.log(`      TikTok: NOT INCLUDED IN POST`);
          }

          // Check for any failed platforms
          const failedPlatforms = platforms.filter((p: any) =>
            p.status === 'failed' || p.status === 'error'
          );

          if (failedPlatforms.length > 0) {
            console.log(`      ⚠️  FAILED platforms:`);
            failedPlatforms.forEach((fp: any) => {
              console.log(`        - ${fp.platform}: ${fp.errorMessage || fp.error || 'Unknown error'}`);
            });
          }
        }
      }

    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  // Check YouTube Direct API credentials
  console.log(`\n${'='.repeat(70)}`);
  console.log('  YOUTUBE DIRECT API CREDENTIALS');
  console.log(`${'='.repeat(70)}`);

  const youtubeClientId = process.env.YOUTUBE_CLIENT_ID;
  const youtubeClientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  console.log(`  Shared CLIENT_ID: ${youtubeClientId ? 'SET' : 'MISSING'}`);
  console.log(`  Shared CLIENT_SECRET: ${youtubeClientSecret ? 'SET' : 'MISSING'}`);

  // Check brand-specific refresh tokens
  const brandTokens = [
    { brand: 'carz', key: 'YOUTUBE_CARZ_REFRESH_TOKEN' },
    { brand: 'ownerfi', key: 'YOUTUBE_OWNERFI_REFRESH_TOKEN' },
    { brand: 'abdullah', key: 'YOUTUBE_ABDULLAH_REFRESH_TOKEN' },
    { brand: 'gaza', key: 'YOUTUBE_GAZA_REFRESH_TOKEN' },
  ];

  console.log(`\n  Brand-specific REFRESH_TOKENS:`);
  for (const { brand, key } of brandTokens) {
    const token = process.env[key];
    if (token) {
      console.log(`    ✅ ${brand}: SET (${token.substring(0, 20)}...)`);
    } else {
      console.log(`    ❌ ${brand}: MISSING (${key})`);
    }
  }

  console.log('\n' + '='.repeat(70));
}

diagnoseTikTok()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
