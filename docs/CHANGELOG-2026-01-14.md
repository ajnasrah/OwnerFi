# OwnerFi Platform Updates - January 14, 2026

## Overview

This document outlines all platform changes deployed on January 14, 2026. These updates include new features, bug fixes, and infrastructure improvements.

---

## 1. Google Analytics 4 Integration

**Status:** Live on ownerfi.ai

We now have comprehensive analytics tracking across the entire platform.

### What's Being Tracked

| User Action | Event Name | Data Captured |
|-------------|------------|---------------|
| Page visits | `page_view` | URL, page title |
| Scroll depth | `scroll_25/50/75/90` | How far users scroll |
| Property liked | `property_like` | Property ID, city, price |
| Property passed | `property_pass` | Property ID, city, price |
| Property shared | `property_share` | Property ID, share method (SMS, WhatsApp, Email, Copy Link) |
| First swipe | `swipe_first` | First interaction with property cards |
| Tutorial started | `tutorial_start` | New user onboarding |
| Tutorial completed | `tutorial_complete` | Finished all steps |
| Tutorial skipped | `tutorial_skip` | Which step they left on |
| OTP sent | `auth_otp_sent` | Login attempts |
| Login success | `auth_login` | Successful logins |
| Signup complete | `auth_signup` | New registrations (buyer/realtor) |
| Logout | `auth_logout` | User logouts |
| Form started | `form_start` | User began filling form |
| Form submitted | `form_submit` | Form submission attempted |
| Form success | `form_success` | Successful submission |

### How to View Analytics

1. Go to [Google Analytics](https://analytics.google.com)
2. Select the OwnerFi property
3. **Realtime** → See live users on the site right now
4. **Reports** → Historical data (takes 24-48 hours to populate)

### UTM Campaign Tracking

Marketing campaigns using UTM parameters are automatically captured:
- `utm_source` - Where traffic comes from (facebook, google, tiktok)
- `utm_medium` - Marketing medium (cpc, social, email)
- `utm_campaign` - Campaign name

These are stored and attached to form submissions for attribution.

---

## 2. Lead Matching System Update

**Change:** Realtors now see all buyers in their state, not just their city.

### Before vs After

| Criteria | Before | After |
|----------|--------|-------|
| Geographic match | Buyer must be within realtor's 30-mile city radius | Buyer must be in same **state** |
| Language match | Required - no match = no lead | Optional bonus points |
| City match | Required | Bonus points if buyer is in realtor's service area |

### Why This Change?

Realtors were missing leads because buyers were in different cities within the same state. For example, a Dallas realtor couldn't see a buyer in Houston, even though both are in Texas.

### New Scoring System

| Factor | Points |
|--------|--------|
| Same state | +40 |
| City in service area | +20 |
| Language match | +20 |
| Active buyer (liked properties) | +10 |
| Active within last week | +10 |
| Active within last month | +5 |

---

## 3. Monthly Free Credits for Realtors

**New Feature:** All realtors receive 1 free credit on the 1st of every month.

### How It Works

- **Schedule:** Runs automatically at midnight on the 1st of each month
- **Action:** Every realtor with an account gets +1 credit added
- **New signups:** Now start with 1 credit instead of 0

### Credit Usage Reminder

- Free tier: 3 pending agreements at a time
- Each credit = 1 additional lead claim beyond free tier
- Credits never expire

---

## 4. Double Referral System (Agent-to-Agent)

**New Feature:** Realtors can now refer their signed leads to other realtors.

### Use Case

Agent A has a signed buyer but:
- Buyer wants to move to a different area
- Agent A doesn't serve that market
- Agent A refers the lead to Agent B

### How It Works

1. **Agent A** goes to their signed lead
2. Creates a referral invite link with their fee percentage (1-50%)
3. Shares link with **Agent B**
4. **Agent B** clicks link, logs in, and accepts the referral
5. Lead transfers to Agent B with referral agreement

### Commission Structure

```
Example: $10,000 commission on sale

Agent A sets 20% referral fee:
- Agent B gets: $8,000 (80%)
- Agent A gets: $2,000 (20%)
- OwnerFi gets: $600 (30% of Agent A's cut)

Agent A's net: $1,400
```

### Rules

- No triple referrals (a re-referred lead cannot be referred again)
- Agent B must have an OwnerFi account
- Referral fee range: 1-50%
- OwnerFi always gets 30% of the referring agent's cut

### New API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/realtor/referral/create-invite` | Create invite link |
| `GET /api/realtor/referral/accept?token=X` | Preview referral |
| `POST /api/realtor/referral/accept` | Accept referral |

---

## 5. Admin Panel Improvements

### Realtor Management Tabs

The admin realtors page now has filtering tabs:

| Tab | Shows |
|-----|-------|
| All Realtors | Everyone |
| With Leads | Realtors who have any agreements |
| Pending Agreements | Realtors with unsigned agreements |
| Signed Agreements | Realtors with signed deals |

### New Columns in Realtor Table

- **Pending** - Count of pending agreements
- **Signed** - Count of signed agreements
- **Location** - City, State
- **Brokerage** - Company name

### Admin Phone Fix

Admin phone numbers in environment variables are now normalized to E.164 format for consistent matching.

---

## 6. Bug Fixes

| Issue | Resolution |
|-------|------------|
| GA4 not loading on production | Moved script injection to `<head>` for reliable loading |
| Meta Pixel tracking incorrect | Fixed `fbq()` call signature |
| TikTok Pixel tracking incorrect | Fixed event mapping |
| Video play event firing on resume | Now only fires on first play |
| Console.log in production | Removed (dev-only now) |
| www.ownerfi.ai not updating | Fixed Vercel domain alias |

---

## Technical Details

### Files Modified

```
src/app/layout.tsx                              - GA4 injection
src/components/analytics/AnalyticsProvider.tsx  - All tracking logic
src/components/analytics/AnalyticsScripts.tsx   - Script loading
src/app/dashboard/page.tsx                      - Property tracking
src/components/ui/PropertySwiper2.tsx           - Swipe tracking
src/components/ui/ShareModal.tsx                - Share tracking
src/components/dashboard/Tutorial.tsx           - Tutorial tracking
src/app/auth/page.tsx                           - Auth tracking
src/app/auth/setup/page.tsx                     - Signup tracking
src/app/contact/page.tsx                        - Form tracking
src/lib/consolidated-lead-system.ts             - Lead matching
src/app/api/cron/monthly-realtor-credits/       - Monthly credits
src/app/api/realtor/referral/                   - Referral system
src/app/admin/realtors/page.tsx                 - Admin tabs
src/app/api/admin/realtors/route.ts             - Admin API
src/lib/firebase-models.ts                      - Data models
src/lib/auth.ts                                 - Phone normalization
vercel.json                                     - Cron schedule
```

### Environment Variables

| Variable | Purpose | Where to Set |
|----------|---------|--------------|
| `NEXT_PUBLIC_GA4_ID` | Google Analytics tracking | Vercel Dashboard |

---

## Deployment Info

- **Deployed:** January 14, 2026
- **Commits:** 6
- **Production URL:** https://ownerfi.ai

---

## Questions?

Contact the development team for any questions about these changes.
