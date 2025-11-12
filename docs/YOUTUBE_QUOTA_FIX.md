# YouTube Quota Exhaustion Fix

## Problem

All brands were experiencing **"YouTube quota exceeded"** errors when posting videos. This was causing workflow failures across the entire platform.

## Root Cause Analysis

### 1. YouTube API Quota Limits (Per-Project)

**Update:** GetLate has confirmed that each brand has separate YouTube channels connected. However, the quota exhaustion is occurring at the **Google Cloud Project level**, not per-channel.

YouTube Data API v3 quotas are applied **per Google Cloud Project** (the API key), not per YouTube channel:

| Brand | Late Profile ID | YouTube Channel |
|-------|----------------|-----------------|
| OwnerFi | `68f02bc0b9cd4f90fdb3ec86` | Separate ✓ |
| Abdullah | `68f02bc0b9cd4f90fdb3ec86` | Separate ✓ |
| Property | Uses OwnerFi profile | Separate ✓ |
| Benefit | Uses OwnerFi profile | Separate ✓ |
| Carz | `68f02c51a024412721e3cf95` | Separate ✓ |
| Podcast | `68f02fc6a36fc81959f5d178` | Separate ✓ |
| VassDistro | `68fd3d20a7d7885fbdf225a3` | Separate ✓ |

**But all using the SAME Google Cloud API Project = Shared 10,000 unit quota**

### 2. YouTube API Quota Limits
- **Daily Quota:** 10,000 units/day
- **Video Upload Cost:** 1,600 units per upload
- **Max Uploads/Day:** ~6 videos

### 3. The Math
Even though channels are separate, they share the **same Google Cloud API quota**:

- OwnerFi: 15 posts/day × includes YouTube = 15 uploads × 1,600 units = 24,000 units
- Property: 5 posts/day × includes YouTube = 5 uploads × 1,600 units = 8,000 units
- Benefit: 5 posts/day × includes YouTube = 5 uploads × 1,600 units = 8,000 units
- Abdullah: 5 posts/day × includes YouTube = 5 uploads × 1,600 units = 8,000 units
- Carz: 5 posts/day × includes YouTube = 5 uploads × 1,600 units = 8,000 units
- Podcast: 5 posts/day × includes YouTube = 5 uploads × 1,600 units = 8,000 units
- VassDistro: 5 posts/day × includes YouTube = 5 uploads × 1,600 units = 8,000 units

**Total: 45+ uploads/day = 72,000 units needed**
**Available: 10,000 units/day**

**QUOTA EXHAUSTED after ~6 uploads (9,600 units)**

## Solution Implemented

### Temporary Fix: Disable YouTube for All Brands

Updated `src/config/brand-configs.ts` to remove YouTube from default platforms:

```typescript
// Before:
platforms: {
  default: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
}

// After:
platforms: {
  default: ['instagram', 'tiktok', 'facebook', 'linkedin', 'threads'],
  all: ['instagram', 'tiktok', 'youtube', ...], // Still available
  excludeFromDefault: ['youtube'], // Disabled by default
}
```

### Benefits
✅ Eliminates quota exhaustion errors
✅ All other platforms continue working
✅ YouTube still available in `all` platforms for manual posting
✅ Quick fix while we implement long-term solution

## Long-Term Solutions

### Option 1: Request YouTube API Quota Increase from Google ⭐ RECOMMENDED

Contact Google Cloud Support to request a quota increase:

**Current:** 10,000 units/day (~6 uploads)
**Request:** 100,000+ units/day (~62 uploads)

**Process:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas)
2. Select YouTube Data API v3
3. Click "Quotas" tab
4. Request quota increase for "Queries per day"
5. **Justification:** "Operating 7 YouTube channels with 45+ daily uploads for multiple business brands"

**Pros:**
- Solves problem permanently
- Free (quota increases are typically free)
- No code changes needed
- Works with existing setup

**Cons:**
- Requires Google approval (usually 2-3 business days)
- May need to provide business justification

### Option 2: Create Separate Google Cloud Projects per Brand

Create separate API projects for each brand, each with its own 10,000 unit quota:

**Setup:**
1. Create 7 Google Cloud Projects (one per brand)
2. Enable YouTube Data API v3 for each project
3. Create API credentials for each project
4. Update GetLate with separate API keys per brand
5. **Total quota: 70,000 units/day (7 × 10,000)**

**Pros:**
- Each brand gets independent 10,000 unit quota
- Total capacity: ~43 uploads/day across all brands
- No waiting for Google approval
- Can implement immediately

**Cons:**
- Requires GetLate to support multiple API keys (may need GetLate team help)
- More complex setup and management
- Need to track quotas per project

### Option 3: Smart Quota Management System

Implement a quota tracking system:

```typescript
// Track daily YouTube uploads per account
const youtubeQuotaTracker = {
  maxUploadsPerDay: 6,
  currentUploads: 0,
  resetTime: Date.now() + 86400000, // 24 hours
};

// Before posting to YouTube:
if (youtubeQuotaTracker.currentUploads >= youtubeQuotaTracker.maxUploadsPerDay) {
  // Skip YouTube, post to other platforms only
  platforms = platforms.filter(p => p !== 'youtube');
}
```

**Pros:**
- Can continue using shared account
- Automatic quota management
- No account setup required

**Cons:**
- Complex logic
- Still limits total uploads
- Doesn't solve brand separation issue

### Option 4: Priority-Based YouTube Posting

Only post most important content to YouTube:

```typescript
// Priority levels
const YOUTUBE_PRIORITY = {
  property: 10,  // Properties get highest priority
  ownerfi: 8,    // Viral content second
  benefit: 6,    // Benefits third
  abdullah: 4,   // Personal brand fourth
};

// Only post to YouTube if high priority + quota available
```

**Pros:**
- Ensures most important content gets uploaded
- Works within quota limits

**Cons:**
- Still uses shared account
- Complex prioritization logic
- Some content never reaches YouTube

## Recommendation

**Implement Option 1: Request YouTube API Quota Increase**

This is the simplest, most scalable solution:

1. **Submit Quota Increase Request to Google:**
   - Go to Google Cloud Console
   - Navigate to YouTube Data API v3 quotas
   - Request increase to 100,000 units/day (or higher)
   - Justification: "Multi-brand content management system uploading 40-50 videos/day across 7 YouTube channels"

2. **While waiting for approval, keep YouTube disabled** in platform configs

3. **Once approved, re-enable YouTube:**
   ```typescript
   // Remove excludeFromDefault from all brand configs
   platforms: {
     default: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
     all: [...]
   }
   ```

4. **Monitor quotas:**
   - Set up Google Cloud monitoring alerts
   - Track daily usage via Cloud Console
   - Keep maxPostsPerDay at reasonable levels

**If quota increase is denied:** Implement Option 2 (separate projects per brand) or Option 4 (priority-based posting)

## Current Status

✅ **YouTube disabled across all brands**
⏳ **Waiting for separate channel setup**
📊 **No more quota errors**

## Files Changed

- `src/config/brand-configs.ts` - Removed YouTube from default platforms for all brands

## Testing

After re-enabling YouTube:

1. Test single brand posting to YouTube
2. Monitor quota usage in Google Cloud Console
3. Verify each brand posts to correct channel
4. Check for quota errors after 6+ uploads

## Related Issues

- Fix for "process-video network error: fetch failed" (#issue-link)
- YouTube quota monitoring system (future enhancement)
