# Property Video A/B Testing System

## Overview
Automatic **day-by-day A/B testing** for property showcase videos:
- **Even days (2, 4, 6...)** → 30-second "Deal Explainer"
- **Odd days (1, 3, 5...)** → 15-second "Deal Drop"

All videos use same avatar (you) with property image as background.

## A/B Testing Strategy

### Day-by-Day Alternating Calendar:
```
📅 OCTOBER 2025

Day 1  (odd)  → 15-sec videos | 3 properties × 3 runs = 9 videos
Day 2  (even) → 30-sec videos | 3 properties × 3 runs = 9 videos
Day 3  (odd)  → 15-sec videos | 3 properties × 3 runs = 9 videos
Day 4  (even) → 30-sec videos | 3 properties × 3 runs = 9 videos
...
Day 25 (odd)  → 15-sec videos | TODAY ← Currently generating 15-sec
Day 26 (even) → 30-sec videos |
Day 27 (odd)  → 15-sec videos |
Day 28 (even) → 30-sec videos |
Day 29 (odd)  → 15-sec videos |
Day 30 (even) → 30-sec videos |
Day 31 (odd)  → 15-sec videos |

MONTHLY TOTALS:
- Odd days (16 days):  16 days × 9 videos = 144 videos (15-sec)
- Even days (15 days): 15 days × 9 videos = 135 videos (30-sec)
- TOTAL: 279 property videos in October
```

**Why this works:**
- Clean test - no duplicate properties
- Easy to compare performance by day
- Each day is a controlled test group
- Cron logs clearly show: "A/B Test Mode: 15-second (Day 25)"
- Over a month, nearly equal split between variants

---

## The OpenAI Prompt Being Sent

```
ROLE:
You are the viral video content generator for OwnerFi.ai, a platform that helps people discover homes they can buy without banks — through seller financing and agent-listed creative deals.
Your job is to turn property data into two punchy, legally safe scripts for short-form videos (one 30 sec and one 15 sec).

🏡 MODE 1 – 30 SECOND "DEAL EXPLAINER"

STRUCTURE (≈70-80 words):
0-3 sec – Hook: Stop-scroll statement
"This home might be cheaper than your rent — and no bank's involved."

3-15 sec – Deal summary:
Quick stats — price range, city, and key highlight
"Three-bed in Dallas around $250K, and the seller's open to owner financing."

15-25 sec – Insight:
Why it's interesting or smart
"Try finding anything close to this monthly — you can't."

25-30 sec – CTA + Disclaimer:
"Visit OwnerFi.ai to see more homes near you — all free with agent contact info. Prices and terms may change anytime."

TONE: Real, confident, fast, trustworthy.
NO: guarantees, promises, or investment talk.

⚡ MODE 2 – 15 SECOND "DEAL DROP"

STRUCTURE (≈45-55 words):
0-3 sec – Hook:
"Stop scrolling — this home might be cheaper than rent."

3-10 sec – Quick value:
"3-bed in Austin around $240K, seller's open to financing."

10-15 sec – CTA + Disclaimer:
"See more free listings near you at OwnerFi.ai — prices and terms can change anytime."

TONE: High energy, conversational, raw — like a friend dropping insider info fast.

🧠 VOICE & STYLE RULES
- Authentic, confident, street-smart tone
- 5th-grade clarity
- No corporate language
- Avoid "I think", "maybe", or "you should"
- Always finish with the legal line: "Prices and terms may change anytime."

🚫 BANNED PHRASES
❌ "Guaranteed approval"
❌ "Lock it in now"
❌ "Investment advice"
❌ "Will go up in value"

✅ OUTPUT FORMAT
Return both scripts in one structured response:

TITLE_30: [under 45 characters]
SCRIPT_30: [spoken text only]
CAPTION_30: [2–3 sentences + disclaimer + 3–5 hashtags]

TITLE_15: [under 45 characters]
SCRIPT_15: [spoken text only]
CAPTION_15: [1–2 sentences + disclaimer + 3–5 hashtags]
```

---

## How It Works

### 1. Property Added to Database
```
New property with < $15k down → Eligible for video
```

### 2. Cron Runs (3x daily)
```
11 AM, 5 PM, 11 PM EST
↓
Finds eligible properties (no existing videos)
↓
Picks top 3 properties (lowest down payment, newest)
```

### 3. For Each Property → Generate BOTH Variants
```
Property #1
  ├─ Call OpenAI with property data
  ├─ OpenAI returns 30-sec + 15-sec scripts
  ├─ Generate HeyGen video (30-sec)
  ├─ Generate HeyGen video (15-sec)
  └─ Both go through: HeyGen → Submagic → Late.dev
```

### 4. Both Videos Posted
```
Workflow #1: property_30sec_1234_abc → Posted
Workflow #2: property_15sec_1234_xyz → Posted
```

---

## A/B Testing Strategy

### What We're Testing:
- **30-sec** = More detail, builds trust, full explanation
- **15-sec** = Fast scroll-stopper, quick hit, FOMO

### Success Metrics:
Track per variant:
- Views
- Completion rate (% who watch to end)
- Engagement (likes, comments, shares)
- Click-through to ownerfi.ai
- Applications submitted

### Expected Results:
- **30-sec**: Higher trust, better for warm audience
- **15-sec**: Higher reach, better for cold audience
- **Winner**: Will emerge after 30-50 properties tested

---

## Video Specs

### Visual Layout (Both Variants):
```
┌─────────────────────────────┐
│                             │
│   PROPERTY IMAGE (Full BG)  │
│                             │
│                             │
│                             │
│                 ┌─────────┐ │
│                 │  Your   │ │ ← Avatar
│                 │  Face   │ │   Bottom-right
│                 │ (0.6x)  │ │   Circle frame
│                 └─────────┘ │
└─────────────────────────────┘
```

### Technical:
- Dimensions: 1080x1920 (vertical)
- Avatar scale: 0.6 (smaller, doesn't cover property)
- Avatar style: 'circle' (round PiP effect)
- Background: Property's first image
- Voice: Your voice ID (9070a6c2dbd54c10bb111dc8c655bff7)

---

## Daily Output

### Per Cron Run (3 properties):
- 3 properties × 1 variant (based on day) = **3 videos generated**
- HeyGen cost: 3 × $0.15 = $0.45
- Processing time: ~3 minutes

### Daily (3 runs):
- 9 properties × 1 variant per day = **9 videos/day**
- HeyGen cost: $1.35/day
- Monthly: **270 property videos** (~135 properties tested in each variant over 30 days)
- Monthly cost: **$43.20**

### A/B Testing Results:
- **~15 days** of 30-second videos = ~135 videos
- **~15 days** of 15-second videos = ~135 videos
- Total: 270 videos across both variants
- Clean comparison data

---

## Cron Schedule

```json
{
  "path": "/api/property/video-cron",
  "schedule": "0 11,17,23 * * *"
}
```

**Times (EST):**
- 11:00 AM - Mid-morning
- 5:00 PM - After work
- 11:00 PM - Late night

**Offset from main content:**
- Avoids conflicts with Carz/OwnerFi (9, 12, 3, 6, 9 PM)
- Avoids conflicts with Podcast (11 AM, 2 PM, 5 PM, 8 PM, 11 PM)
- Property videos fill gaps in posting schedule

---

## Example OpenAI Input/Output

### INPUT (sent to OpenAI):
```
Generate both 30-second and 15-second video scripts for this property:

PROPERTY DATA:
- City: Houston, TX
- Price: $185,000
- Bedrooms: 3
- Bathrooms: 2
- Square Feet: 1450
- Monthly Payment: $1,320 (estimated before taxes/insurance)
- Down Payment: $9,250 (estimated)
- Highlight: Brand new kitchen and hardwood floors throughout!

Generate TITLE_30, SCRIPT_30, CAPTION_30, TITLE_15, SCRIPT_15, and CAPTION_15 following the format exactly.
```

### OUTPUT (from OpenAI):
```
TITLE_30: 🏡 Houston Home - Only $9K Down!

SCRIPT_30: This home in Houston might actually be cheaper than rent — and there's no bank involved. It's a 3-bed, 2-bath around $185K with a brand new kitchen and hardwood floors. The seller's open to owner financing, so you're looking at around $1,320 a month. Try finding a rental this nice for that price — you can't. Visit OwnerFi.ai to see more homes near you — all free with agent contact info. Prices and terms may change anytime.

CAPTION_30: Looking for a home without the bank drama? This Houston property has seller financing available with only $9K down. Browse more creative finance deals for free on OwnerFi.ai. Prices and terms may change anytime. #OwnerFi #HoustonRealEstate #SellerFinancing #NoBankLoan #HomeOwnership

TITLE_15: 💥 $9K Down Houston Deal?!

SCRIPT_15: Stop scrolling — this 3-bed in Houston might be cheaper than rent. It's around $185K and the seller's open to financing. See more free listings near you at OwnerFi.ai — prices and terms can change anytime.

CAPTION_15: Real owner-finance homes in Houston starting under $10K down. Visit OwnerFi.ai to browse for free. Prices and terms may change anytime. #OwnerFi #HoustonHomes #SellerFinancing #RealEstate
```

---

## Analytics Dashboard (Future)

Track which variant performs better:

| Metric | 30-Sec Avg | 15-Sec Avg | Winner |
|--------|------------|------------|--------|
| Views | TBD | TBD | TBD |
| Watch % | TBD | TBD | TBD |
| Engagement | TBD | TBD | TBD |
| CTR | TBD | TBD | TBD |
| Applications | TBD | TBD | TBD |

After 50-100 properties, we'll know which format drives more results.

---

## Legal Compliance

### Every Script Includes:
✅ "Prices and terms may change anytime"
✅ "Free with agent contact info" (we're a platform)
✅ No guarantees or promises
✅ No investment advice
✅ Estimated payments (not guaranteed)

### What's NOT Included (Intentionally):
❌ "Get approved today"
❌ "Lock in this rate"
❌ "Investment opportunity"
❌ "Guaranteed returns"

---

## Deployment

Already live! The system is ready to run. Next property video cron: **today at 11 PM EST**

To test manually:
```bash
curl -X POST https://ownerfi.ai/api/property/generate-video \
  -H "Content-Type: application/json" \
  -d '{"propertyId": "YOUR_PROPERTY_ID", "variant": "30"}'
```

---

**Version**: 2.0 (A/B Testing)
**Last Updated**: October 2025
**Status**: Production Ready
