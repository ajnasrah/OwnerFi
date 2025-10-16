# Late API Integration Status

## ✅ Working Platforms

Successfully posting to these platforms:
- ✅ **Instagram** - Reels (default)
- ✅ **TikTok** - Public posts
- ✅ **LinkedIn** - Standard posts
- ✅ **Threads** - Standard posts
- ✅ **Twitter/X** - Standard posts
- ✅ **Bluesky** - OwnerFi only

## ❌ Skipped Platforms (Temporarily Disabled)

### Facebook
**Error**: `Unable to get page access token. Page not found or user does not have admin access to this page.`

**Issue**: Need admin access to Facebook page
**Fix Required**:
1. Go to https://getlate.dev/dashboard
2. Reconnect Facebook account
3. Ensure you have admin access to the page

### YouTube
**Error**: `YouTube quota exceeded. Please try again later.`

**Issue**: Daily YouTube API upload quota reached
**Fix**:
- Quota resets at midnight Pacific Time
- Consider requesting quota increase from Google
- Or post YouTube manually until quota increases

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
| Instagram | Reel (default) | Public | Working ✅ |
| TikTok | Video | Public | Working ✅ |
| LinkedIn | Video | Public | Working ✅ |
| Threads | Video | Public | Working ✅ |
| Twitter/X | Video | Public | Working ✅ |
| Bluesky | Video | Public | OwnerFi only ✅ |
| Facebook | Disabled | - | Token error ❌ |
| YouTube | Disabled | - | Quota exceeded ❌ |

## Stories (Disabled)
Instagram and Facebook stories have been disabled per user request.
Focus is on main platform posts only.

## Next Steps

### To Enable Facebook:
1. Visit Late dashboard
2. Reconnect Facebook account with admin access
3. Verify page permissions
4. Test with manual post first
5. Re-enable in code: Add `'facebook'` back to `allPlatforms` array

### To Enable YouTube:
1. Wait for quota reset (midnight PT)
2. OR request quota increase from Google Cloud Console
3. Test with manual post first
4. Re-enable in code: Add `'youtube'` back to `allPlatforms` array

## Code Location

Main posting logic:
- `/src/app/api/webhooks/submagic/route.ts` - Webhook handler
- `/src/lib/late-api.ts` - Late API client
- `/src/lib/feed-store-firestore.ts` - Scheduling logic

Platform configuration:
- Line 166 (Podcast): `const allPlatforms = ['instagram', 'tiktok', 'linkedin', 'threads', 'twitter']`
- Line 234 (Social Media): `const allPlatforms = ['instagram', 'tiktok', 'linkedin', 'threads', 'twitter']` + Bluesky for OwnerFi

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
