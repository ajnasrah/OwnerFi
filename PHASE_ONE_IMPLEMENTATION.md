# Phase One: Motion Proof + Tracking Integration

## ✅ Implementation Complete

This document outlines the Phase One implementation for OwnerFi.ai homepage redesign, syncing with the social media system.

---

## 🎯 What Was Implemented

### 1. Hero Motion Loop ✅
- **Video player** in hero phone mockup
- Autoplay, loop, muted, and mobile-optimized
- Supports both MP4 and WebM formats
- Fallback poster image for loading state
- **6-second demo video tracking** built-in

**Location:** `/src/components/ui/HeroVideo.tsx`

**Usage:**
```tsx
<HeroVideo />
```

### 2. Analytics & Pixel Setup ✅
Comprehensive tracking system supporting:
- **Google Analytics 4 (GA4)**
- **Meta Pixel (Facebook)**
- **TikTok Pixel**

**Locations:**
- `/src/components/analytics/AnalyticsScripts.tsx` - Pixel loading
- `/src/components/analytics/AnalyticsProvider.tsx` - Event tracking logic
- `/src/app/layout.tsx` - Global integration

**Custom Events Tracked:**
- `video_play` - When hero video starts
- `video_progress_25` - Video 25% watched
- `video_progress_50` - Video 50% watched
- `video_progress_95` - Video 95% watched (completion)
- `swipe_first` - First swipe action (ready to implement)
- `match_click` - Property match interaction (ready to implement)
- `lead_submit` - Form submission
- `calc_used` - Calculator usage (ready to implement)
- `cta_click` - CTA button clicks
- `page_view` - Page navigation

### 3. CTA & Copy Alignment ✅
- All primary CTAs updated to: **"Start Swiping Free"**
- Social media caption added below hero video:
  > "Swipe real owner-finance homes at OwnerFi — follow @OwnerFi.ai for daily updates"
- TikTok link integrated: `https://www.tiktok.com/@ownerfi.ai`

### 4. UTM Parameter Capture ✅
- Automatic UTM parameter capture on page load
- Stores in localStorage for form submissions
- Available parameters:
  - `utm_source`
  - `utm_medium`
  - `utm_campaign`
  - `utm_term`
  - `utm_content`

**Helper Functions:**
```typescript
import { captureUTMParams, getStoredUTMParams } from '@/components/analytics/AnalyticsProvider';

// Capture current UTM params
const utmParams = captureUTMParams();

// Get stored params (for forms)
const storedParams = getStoredUTMParams();
```

---

## 📁 Files Created/Modified

### New Files:
1. `/src/components/analytics/AnalyticsProvider.tsx`
2. `/src/components/analytics/AnalyticsScripts.tsx`
3. `/src/components/ui/HeroVideo.tsx`
4. `/public/hero-demo.mp4` (you need to add)
5. `/public/hero-demo.webm` (optional)
6. `/public/hero-demo-poster.jpg` (you need to add)

### Modified Files:
1. `/src/app/layout.tsx` - Added analytics providers
2. `/src/app/page.tsx` - Updated hero with video and new CTAs
3. `/src/app/globals.css` - Added float animations
4. `/.env.example` - Added analytics variables

---

## 🔧 Setup Instructions

### Step 1: Add Environment Variables

Add these to your `.env.local` file:

```bash
# Analytics & Tracking
NEXT_PUBLIC_GA4_ID="G-XXXXXXXXXX"
NEXT_PUBLIC_META_PIXEL_ID="123456789012345"
NEXT_PUBLIC_TIKTOK_PIXEL_ID="XXXXXXXXXXXXXXXXX"
```

**Where to get these:**

#### Google Analytics 4 (GA4):
1. Go to https://analytics.google.com/
2. Create a new GA4 property
3. Get your Measurement ID (starts with `G-`)
4. Add to `NEXT_PUBLIC_GA4_ID`

#### Meta Pixel:
1. Go to https://business.facebook.com/events_manager
2. Create a new pixel
3. Copy the Pixel ID (15-16 digit number)
4. Add to `NEXT_PUBLIC_META_PIXEL_ID`

#### TikTok Pixel:
1. Go to https://ads.tiktok.com/
2. Navigate to Events Manager
3. Create a new pixel
4. Copy the Pixel ID
5. Add to `NEXT_PUBLIC_TIKTOK_PIXEL_ID`

### Step 2: Add Hero Demo Video

Record your screen demo and save as:
- `/public/hero-demo.mp4` (required)
- `/public/hero-demo.webm` (optional, better compression)
- `/public/hero-demo-poster.jpg` (thumbnail image)

**Video Requirements:**
- Duration: ~6 seconds
- Shows: finger swiping → match found → contact agent popup
- Format: MP4 (H.264) and/or WebM
- Aspect ratio: 9:16 (vertical, phone screen)
- Resolution: 1080x1920 or 1080x2340
- File size: < 5MB for fast loading
- No sound (muted autoplay)

**How to Record:**
1. Open your app dashboard on a phone or simulator
2. Use screen recording (iOS: built-in, Android: built-in, Mac: QuickTime)
3. Record the swipe interaction (6 seconds)
4. Export as MP4
5. Optimize with Handbrake or ffmpeg:
   ```bash
   ffmpeg -i original.mp4 -c:v libx264 -crf 28 -preset slow -c:a copy hero-demo.mp4
   ```
6. Create poster image (screenshot at 0 seconds):
   ```bash
   ffmpeg -i hero-demo.mp4 -ss 00:00:00 -frames:v 1 hero-demo-poster.jpg
   ```

### Step 3: Deploy & Test

```bash
# Install dependencies (if needed)
npm install

# Build and start
npm run build
npm run start

# Or use Vercel
vercel --prod
```

---

## ✅ Validation Checklist

### Event Tracking Validation:

#### 1. Google Analytics 4 (GA4) DebugView:
1. Go to: https://analytics.google.com/
2. Navigate to: Configure → DebugView
3. Open your site in a new tab
4. Watch events appear in real-time
5. ✅ Check for:
   - `page_view` - Page loads
   - `video_play` - Hero video starts
   - `video_progress_25/50/95` - Video milestones
   - `cta_click` - Button clicks

#### 2. Meta Pixel Helper (Chrome Extension):
1. Install: [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
2. Open your site
3. Click the extension icon
4. ✅ Check for:
   - Green checkmark (pixel active)
   - `PageView` event
   - Custom events: `video_play`, `cta_click`, etc.
   - No errors or warnings

#### 3. TikTok Pixel Helper:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Type: `ttq` and press Enter
4. ✅ Should see TikTok pixel object (not undefined)
5. Events will fire as you interact with the site

#### 4. Screen Recording:
Record a short video showing:
1. Homepage loads (hero video plays)
2. Video plays through (capture in GA4 DebugView)
3. Click "Start Swiping Free" button
4. Event appears in tracking tools
5. Desktop + mobile views

**Recording Tools:**
- Mac: QuickTime Screen Recording, or `Cmd+Shift+5`
- Windows: Xbox Game Bar (`Win+G`), or OBS
- Chrome: Loom extension

---

## 🎯 Custom Event Tracking Usage

### Track Custom Events in Your Code:

```typescript
import { trackEvent } from '@/components/analytics/AnalyticsProvider';

// Example: Track first swipe
trackEvent('swipe_first', {
  property_id: property.id,
  property_price: property.listPrice,
  direction: 'right' // or 'left'
});

// Example: Track match click
trackEvent('match_click', {
  property_id: property.id,
  match_type: 'affordability',
  user_budget: userBudget
});

// Example: Track calculator usage
trackEvent('calc_used', {
  calc_type: 'monthly_payment',
  property_price: 285000,
  down_payment: 20000
});

// Example: Track lead submission
trackEvent('lead_submit', {
  form_type: 'signup',
  utm_source: utmParams.utm_source,
  utm_campaign: utmParams.utm_campaign
});
```

### Automatic Tracking (Data Attributes):

Add data attributes to any element to auto-track clicks:

```tsx
<button
  data-event="cta_click"
  data-location="footer"
  data-label="Start Swiping"
>
  Start Swiping Free
</button>
```

**Supported Attributes:**
- `data-event` - Event name (required)
- `data-location` - Where on page (optional)
- `data-label` - Custom label (optional)

---

## 📊 What You'll See in Analytics

### GA4 Dashboard:
1. **Real-time reports** → See active users
2. **Events** → All custom events with parameters
3. **Conversions** → Mark `lead_submit` as conversion
4. **User journeys** → See path from video → signup

### Meta Events Manager:
1. **Events** → All pixel events
2. **Test Events** → Debug mode
3. **Custom Conversions** → Create audiences
4. **Match Quality** → See how well events match to users

### TikTok Events Manager:
1. **Events** → Track all pixel fires
2. **Custom Events** → Video engagement
3. **Audiences** → Create retargeting audiences

---

## 🚀 Next Steps: Phase Two

After Phase One is live and validated, we'll implement:

1. **Micro-Landing Variants**
   - Dynamic headlines based on UTM source
   - A/B test different value props
   - Location-specific landing pages

2. **Dynamic Social Embeds**
   - Live TikTok feed on homepage
   - Instagram stories carousel
   - Social proof counter

3. **Retargeting Audiences**
   - Video viewers (25%, 50%, 95%)
   - Button clickers (non-converters)
   - Page visitors (time on site)
   - Property swipers (engaged users)

4. **Advanced Tracking**
   - Scroll depth tracking
   - Heatmaps (via Hotjar/Microsoft Clarity)
   - Session recordings
   - Form abandonment tracking

5. **Conversion Optimization**
   - A/B test hero copy
   - Test different video lengths
   - Optimize CTA placement
   - Add trust badges/social proof

---

## 🐛 Troubleshooting

### Video Not Playing:
- Check file exists: `/public/hero-demo.mp4`
- Check file format: Must be H.264 MP4
- Check file size: Should be < 5MB
- Check autoplay: Some browsers block autoplay without user interaction
- Try adding `playsInline` attribute (already added)

### Events Not Firing:
- Check browser console for errors
- Verify env variables are set: `NEXT_PUBLIC_GA4_ID`, etc.
- Check if pixel scripts loaded: View page source, look for `gtag` or `fbq`
- Disable ad blockers during testing
- Check GA4 DebugView (events appear within seconds)

### UTM Params Not Capturing:
- Check localStorage: Open DevTools → Application → Local Storage
- Look for key: `ownerfi_utm_params`
- Make sure URL has UTM params: `?utm_source=test&utm_campaign=phase1`
- Check function is called on page load (in AnalyticsProvider)

### TypeScript Errors:
```bash
# Clear .next cache
rm -rf .next

# Reinstall dependencies
npm install

# Rebuild
npm run build
```

---

## 📝 Notes

- All analytics code is client-side only (uses `'use client'`)
- Pixels only load if env variables are set (won't break if missing)
- UTM params persist across pages (stored in localStorage)
- Video tracking automatically fires 25%, 50%, 95% events
- Events are sent to ALL configured pixels (GA4, Meta, TikTok)

---

## ✅ Success Metrics

After Phase One launch, track these metrics:

**Week 1:**
- [ ] Video completion rate (95% watched)
- [ ] CTA click-through rate
- [ ] Time on page (should increase)
- [ ] Bounce rate (should decrease)

**Week 2:**
- [ ] Sign-up conversion rate
- [ ] Mobile vs desktop engagement
- [ ] UTM source performance
- [ ] Social media traffic (TikTok referrals)

**Week 3-4:**
- [ ] Retargeting audience sizes
- [ ] Cost per lead (if running ads)
- [ ] Return visitor rate
- [ ] Video engagement by device

---

## 🎯 Target Audience Reminder

- **Age:** 25-40
- **Status:** Currently renting
- **Goal:** Buy first home
- **Pain Points:** Bad credit, can't get bank approval
- **Tech Savvy:** Used to Tinder/swipe apps
- **Trust Level:** Skeptical of scams, needs social proof

**What Phase One Achieves:**
1. ✅ Shows it's a real app (video demo)
2. ✅ Builds trust (professional design, social links)
3. ✅ Tracks engagement (know what works)
4. ✅ Captures attribution (know where users come from)
5. ✅ Enables retargeting (bring back visitors)

---

## 📞 Support

If you encounter issues:
1. Check this documentation
2. Review `/src/components/analytics/` files
3. Check browser console for errors
4. Test in incognito mode (disable extensions)
5. Verify env variables are set correctly

---

**Phase One Complete! 🎉**

Ready for validation and Phase Two planning.
