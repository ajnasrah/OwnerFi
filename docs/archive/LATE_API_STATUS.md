# Late API Integration Status

## ✅ Working Platforms

Successfully posting to these platforms:
- ✅ **Facebook** - Reels & Feed posts
- ✅ **Instagram** - Reels (default)
- ✅ **TikTok** - Public posts
- ✅ **YouTube** - Shorts
- ✅ **LinkedIn** - Standard posts
- ✅ **Threads** - Standard posts
- ✅ **Twitter/X** - Standard posts
- ✅ **Bluesky** - OwnerFi only

## Current Configuration

### Posting Schedule
- **Time Slots**: 9 AM, 11 AM, 2 PM, 6 PM, 8 PM (Eastern Time)
- **Logic**: Auto-selects next available slot per brand
- **Brands**: OwnerFi, Carz, Podcast

### Workflow
```
RSS Article → HeyGen Video → Submagic Enhancement
→ R2 Upload → Late API Scheduling → Auto-Post to All Platforms
```

### Platform Settings
| Platform | Content Type | Privacy | Notes |
|----------|-------------|---------|-------|
| Facebook | Reel/Feed | Public | Enabled ✅ |
| Instagram | Reel (default) | Public | Enabled ✅ |
| TikTok | Video | Public | Enabled ✅ |
| YouTube | Shorts | Public | Enabled ✅ |
| LinkedIn | Video | Public | Enabled ✅ |
| Threads | Video | Public | Enabled ✅ |
| Twitter/X | Video | Public | Enabled ✅ |
| Bluesky | Video | Public | OwnerFi only ✅ |

## Stories (Disabled)
Instagram and Facebook stories have been disabled per user request.
Focus is on main platform posts only.

## All Platforms Enabled ✅

All platforms are now active and posting:
- Facebook, Instagram, TikTok, YouTube, LinkedIn, Threads, Twitter/X
- Bluesky (OwnerFi brand only)

If you encounter errors:
- **Facebook**: Reconnect in Late dashboard with admin access
- **YouTube**: Quota resets at midnight PT; request increase if needed

## Code Location

Main posting logic:
- `/src/app/api/webhooks/submagic/route.ts` - Webhook handler
- `/src/lib/late-api.ts` - Late API client
- `/src/lib/feed-store-firestore.ts` - Scheduling logic

Platform configuration:
- Line 165 (Podcast): `const allPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads', 'twitter']`
- Line 227 (Social Media): `const allPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads', 'twitter']` + Bluesky for OwnerFi

## Testing

Test scripts available:
- `node test-late-r2.js <R2_VIDEO_URL>` - Test R2 video posting
- `node list-r2-videos.js` - List available R2 videos
- `node debug-late-accounts.js` - Debug account configuration

Last successful test: 10/15/2025 - Posted to 6 platforms successfully

## Environment Variables

Required:
```bash
LATE_API_KEY=sk_8b3848b528de...
LATE_OWNERFI_PROFILE_ID=68f02bc0b9cd4f90fdb3ec86
LATE_CARZ_PROFILE_ID=68f02c51a024412721e3cf95
LATE_PODCAST_PROFILE_ID=68f02fc6a36fc81959f5d178
```

All configured ✅
