# Complete System Audit - OwnerFi Video Automation

**Audit Date**: October 25, 2025, 3:30 PM
**Status**: Comprehensive Health Check

---

## 📊 CRON SCHEDULE OVERVIEW (ALL TIMES EST)

### Content Generation Crons

| Cron | Schedule | Times (EST) | Brand | Videos/Day |
|------|----------|-------------|-------|------------|
| `/api/cron/generate-video` | `0 9,12,15,18,21 * * *` | 9 AM, 12 PM, 3 PM, 6 PM, 9 PM | Carz, OwnerFi | 5 each = 10 total |
| `/api/podcast/cron` | `0 9,12,15,18,21 * * *` | 10 AM, 1 PM, 4 PM, 7 PM, 10 PM CST* | Podcast | 5 |
| `/api/benefit/cron` | `0 10,13,16,19,22 * * *` | 11 AM, 2 PM, 5 PM, 8 PM, 11 PM CST* | Benefits | 5 |
| `/api/property/video-cron` | `0 11,17,23 * * *` | 11 AM, 5 PM, 11 PM | Property | 9 (3 per run) |

*CST = EST - 1 hour

**Total Daily Videos**: 29 videos (10 viral + 5 podcast + 5 benefits + 9 properties)

### Support Crons

| Cron | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/fetch-rss` | `0 8 * * *` | 8 AM daily | Fetch RSS articles |
| `/api/cron/rate-articles` | `30 8 * * *` | 8:30 AM daily | Rate articles for quality |
| `/api/cron/check-stuck-heygen` | `*/15 * * * *` | Every 15 min | Check stuck HeyGen |
| `/api/cron/check-stuck-submagic` | `*/15 * * * *` | Every 15 min | Check stuck Submagic |
| `/api/cron/check-stuck-posting` | `0 */2 * * *` | Every 2 hours | Check stuck posts |
| `/api/cron/check-stuck-video-processing` | `0 */2 * * *` | Every 2 hours | Check stuck videos |
| `/api/cron/weekly-maintenance` | `0 11 * * 1` | Mon 11 AM | Weekly cleanup |
| `/api/cron/cleanup-videos` | `0 3 * * *` | 3 AM daily | Clean old videos |
| `/api/cron/process-scraper-queue` | `*/10 14-23,0-2 * * *` | Every 10 min (2 PM-2 AM) | Process property scraper |

---

## 🎬 BRAND CONFIGURATIONS

### Carz Inc
- **Profile ID**: `LATE_CARZ_PROFILE_ID` ✅
- **Timezone**: America/New_York (EST)
- **Posting**: 9 AM, 12 PM, 3 PM, 6 PM, 9 PM EST
- **Videos/Day**: 5
- **Platforms**: Instagram, TikTok, YouTube, Facebook, LinkedIn, Threads
- **Avatar**: `31c6b2b6306b47a2ba3572a23be09dbc`
- **Voice**: `9070a6c2dbd54c10bb111dc8c655bff7`
- **Webhooks**:
  - HeyGen: `/api/webhooks/heygen/carz`
  - Submagic: `/api/webhooks/submagic/carz`

### OwnerFi (Viral Videos)
- **Profile ID**: `LATE_OWNERFI_PROFILE_ID` ✅
- **Timezone**: America/New_York (EST)
- **Posting**: 9 AM, 12 PM, 3 PM, 6 PM, 9 PM EST
- **Videos/Day**: 5
- **Platforms**: Instagram, TikTok, YouTube, Facebook, LinkedIn, Threads, Twitter, Bluesky
- **Avatar**: `31c6b2b6306b47a2ba3572a23be09dbc` (same as Carz)
- **Voice**: `9070a6c2dbd54c10bb111dc8c655bff7` (same as Carz)
- **Webhooks**:
  - HeyGen: `/api/webhooks/heygen/ownerfi`
  - Submagic: `/api/webhooks/submagic/ownerfi`

### Podcast
- **Profile ID**: `LATE_PODCAST_PROFILE_ID` ✅
- **Timezone**: America/Chicago (CST/CDT)
- **Posting**: 9 AM, 12 PM, 3 PM, 6 PM, 9 PM CST = 10 AM, 1 PM, 4 PM, 7 PM, 10 PM EST
- **Videos/Day**: 5
- **Platforms**: Instagram, TikTok, YouTube, Facebook, LinkedIn, Threads
- **Avatar**: `31c6b2b6306b47a2ba3572a23be09dbc` (host)
- **Voice**: `9070a6c2dbd54c10bb111dc8c655bff7`
- **Webhooks**:
  - HeyGen: `/api/webhooks/heygen/podcast`
  - Submagic: `/api/webhooks/submagic/podcast`

### Benefits
- **Profile ID**: `LATE_OWNERFI_PROFILE_ID` ✅ (shares with OwnerFi)
- **Timezone**: America/Chicago (CST/CDT)
- **Posting**: 10 AM, 1 PM, 4 PM, 7 PM, 10 PM CST = 11 AM, 2 PM, 5 PM, 8 PM, 11 PM EST
- **Videos/Day**: 5
- **Platforms**: Same as OwnerFi
- **Avatar**: `BENEFIT_AVATAR_ID` = `31c6b2b6306b47a2ba3572a23be09dbc` ✅
- **Voice**: `BENEFIT_VOICE_ID` = `9070a6c2dbd54c10bb111dc8c655bff7` ✅
- **Webhooks**:
  - HeyGen: `/api/webhooks/heygen/benefit`
  - Submagic: `/api/webhooks/submagic/benefit`

### Property Videos (NEW)
- **Profile ID**: `LATE_OWNERFI_PROFILE_ID` ✅ (shares with OwnerFi)
- **Timezone**: America/New_York (EST)
- **Posting**: 11 AM, 5 PM, 11 PM EST
- **Videos/Day**: 9 (3 per run × 3 runs)
- **Length**: 15 seconds only
- **Avatar**: `31c6b2b6306b47a2ba3572a23be09dbc` (0.6x scale, bottom-right)
- **Background**: Property image
- **Webhooks**: Uses benefit webhooks (need to add property-specific)

---

## ⚠️ ISSUES FOUND

### 1. Property Video Cron Times (11 PM is too late!)
**Current**: 11 AM, 5 PM, **11 PM** ❌
**Problem**: 11 PM is after most people sleep
**Recommended**: 11 AM, 3 PM, 7 PM ✅

### 2. Missing Property Webhooks
Property videos need their own webhook handlers:
- `/api/webhooks/heygen/property` ❌ NOT CREATED
- `/api/webhooks/submagic/property` ❌ NOT CREATED

**Current**: Property videos will fail at webhook step!

### 3. Benefit Avatar Configuration
**Status**: ✅ FIXED (now uses same avatar as Carz)
- Old (broken): `8988e02d16544a4286305603244310fc`
- New (working): `31c6b2b6306b47a2ba3572a23be09dbc`

### 4. OPENAI_API_KEY on Vercel
**Status**: ⚠️ Only in Preview, not Production
- Production: ❌ Missing
- Preview: ✅ Set

**Impact**: Property videos won't work in production without OpenAI key!

---

## 🔧 REQUIRED FIXES

### Priority 1 (CRITICAL):
1. ✅ Add OPENAI_API_KEY to production
2. ✅ Create property webhook handlers
3. ✅ Fix property video cron timing (remove 11 PM)

### Priority 2 (Important):
4. Test property video end-to-end
5. Verify Late.dev queue slots are configured
6. Check benefit videos are working with new avatar

### Priority 3 (Nice to Have):
7. Add property video analytics
8. Create dashboard for property video monitoring
9. Add manual trigger button for property videos

---

## 📋 LATE.DEV QUEUE STATUS

Need to verify queues are configured. Running check...

### Expected Configuration:
- **Carz**: 5 slots/day (9, 12, 3, 6, 9 PM EST)
- **OwnerFi**: 5 slots/day (9, 12, 3, 6, 9 PM EST) - handles viral + benefits + properties
- **Podcast**: 5 slots/day (10 AM, 1 PM, 4 PM, 7 PM, 10 PM CST)

**Question**: OwnerFi queue needs to handle 5 viral + 5 benefits + 9 properties = **19 videos into 5 slots**

This will create backup! Need to either:
- Increase OwnerFi queue slots to 19/day
- OR reduce video generation
- OR use immediate posting instead of queue

---

## 🎯 RECOMMENDED CHANGES

### 1. Fix Property Video Timing
Change from: `0 11,17,23 * * *`
To: `0 11,15,19 * * *` (11 AM, 3 PM, 7 PM EST)

### 2. Add OPENAI_API_KEY to Production
```bash
vercel env add OPENAI_API_KEY production
```

### 3. Create Property Webhooks
Need to create:
- `/api/webhooks/heygen/property/route.ts`
- `/api/webhooks/submagic/property/route.ts`

OR reuse benefit webhooks (they're nearly identical)

### 4. Increase OwnerFi Queue Slots
Current: 5 slots/day
Needed: 19 slots/day (5 viral + 5 benefits + 9 properties)

Update `setup-late-queues.ts` to add more slots or use immediate posting.

---

## 📈 CURRENT SYSTEM CAPACITY

### Daily Video Generation:
- Carz: 5 videos
- OwnerFi Viral: 5 videos
- Podcast: 5 videos
- Benefits: 5 videos
- Properties: 9 videos
- **Total**: 29 videos/day

### Monthly:
- **870 videos/month**
- **~$139/month** in HeyGen costs (870 × $0.16)

### API Usage:
- HeyGen: 29 requests/day
- Submagic: 29 requests/day
- OpenAI: 10 requests/day (viral videos only, properties use templates)
- Late API: 29 posts/day

---

## ✅ WHAT'S WORKING

1. ✅ Carz viral videos
2. ✅ OwnerFi viral videos
3. ✅ Podcast episodes
4. ✅ Avatar configuration (all use same avatar)
5. ✅ Late.dev integration
6. ✅ Gangster prompts for viral content
7. ✅ 5x daily posting for main brands

## ❌ WHAT NEEDS FIXING

1. ❌ Property video webhooks missing
2. ❌ OPENAI_API_KEY not in production
3. ❌ Property video cron timing (11 PM too late)
4. ❌ OwnerFi queue capacity (5 slots for 19 videos)
5. ⚠️ Benefit videos may still be failing (needs testing)

---

## 🚀 NEXT STEPS

Want me to:
1. Fix property video cron timing (11 AM, 3 PM, 7 PM instead)?
2. Add OPENAI_API_KEY to production?
3. Create property webhook handlers?
4. Increase OwnerFi queue capacity?
5. Run end-to-end test?

Let me know which fixes to prioritize!
