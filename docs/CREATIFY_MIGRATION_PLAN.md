# Creatify Migration Plan — Full Pipeline Rebuild

## Goal

Replace HeyGen/Synthesia + Submagic with a single Creatify pipeline. Build each brand individually, starting with OwnerFi, perfecting it before replicating.

---

## Real Numbers

### Current Monthly Volume

| Brand | Videos/Day | Videos/Month |
|-------|-----------|-------------|
| OwnerFi | 3 | 90 |
| Carz | 3 | 90 |
| Abdullah | 3 | 90 |
| Gaza | 3-5 | 90-150 |
| Realtors | 0-3 | 0-90 |
| Benefit | 0-5 | 0-150 |
| Personal | 0 | 0 |
| **TOTAL** | **12-21** | **360-630** |

**Realistic monthly estimate: ~500 videos/month**

### Creatify Credit Costs (From Docs)

| Endpoint | Credits | Per |
|----------|---------|-----|
| **AI Avatar v1** (lipsync) | 5 credits | per 30 seconds |
| **AI Avatar v2** (multi-scene) | 5 credits | per 30 seconds |
| **Aurora** (premium) | 20 credits | per 15 seconds |
| **Aurora Fast** | 10 credits | per 15 seconds |
| **AI Shorts** | DEPRECATED | — |
| **TTS only** | 1 credit | per 30 seconds |
| **Custom Avatar creation** | Free | one-time review |

### Cost Calculation for OwnerFi (Phase 1)

**Using AI Avatar v2 (recommended — multi-scene, captions, backgrounds):**
- Script target: ~45 seconds per video
- Credits per video: 5 credits × 2 (for 30-60 sec) = **10 credits/video**
- OwnerFi monthly: 90 videos × 10 credits = **900 credits/month**

**Using Aurora (premium quality):**
- Credits per video: 20 credits × 3 (for 45 sec) = **60 credits/video**
- OwnerFi monthly: 90 videos × 60 credits = **5,400 credits/month**
- Too expensive for daily content — save Aurora for special campaigns

### Cost Calculation for All Brands

**AI Avatar v2 across all brands:**
- 500 videos/month × 10 credits = **5,000 credits/month**
- Enterprise tier needed (200-5,000+ credits)
- **Must contact Creatify sales for enterprise pricing**

### What We're Replacing (Current Costs)

| Service | Monthly Cost | Purpose |
|---------|-------------|---------|
| HeyGen/Synthesia | ~$150-500/mo | Avatar video generation |
| Submagic | $150/mo (600 credits) | Captions + b-roll + zooms |
| **Total replaced** | **$300-650/mo** | |

### Creatify Pricing Estimates

| Plan | Credits/Month | Monthly Cost | Enough? |
|------|--------------|-------------|---------|
| Starter | 100 | $19/mo | No (10 videos) |
| Pro | 200 | ~$99/mo | No (20 videos) |
| Enterprise | 200-5000+ | Custom | Need 5,000+ |

**Action item: Contact Creatify sales at api@creatify.ai for enterprise pricing at 5,000 credits/month. Compare to current $300-650/mo spend.**

---

## Which Creatify API to Use

### AI Avatar v2 (Recommended for OwnerFi)

**Why v2 over v1:**
- Multi-scene support — different avatar, voice, background per scene
- Per-scene caption control (font, color, position, style)
- Background customization per scene (image or video URL)
- Avatar scale and positioning (x/y offset)
- Transition effects between scenes
- 1,500+ stock avatars
- 5 credits per 30 seconds (same as v1, more features)

**Why NOT Aurora:**
- 4x more expensive (20 credits/15 sec vs 5 credits/30 sec)
- Requires pre-generated audio (extra TTS step)
- Requires source image (not a stock avatar ID)
- Best for custom avatar campaigns, not daily content

### Making Engaging Videos for 20-35 Year Old Renters

**V2 multi-scene structure for maximum engagement:**

```
Scene 1 (0-3 sec): HOOK
  - Bold avatar, close-up scale
  - Eye-catching background (gradient or city skyline)
  - Large animated caption style
  - "STOP paying someone else's mortgage."

Scene 2 (3-15 sec): PROBLEM
  - Same or different avatar
  - Background: rent increase chart image or apartment stock footage
  - Caption style: highlight key words
  - "Your rent goes up every year but your equity stays at ZERO..."

Scene 3 (15-35 sec): SOLUTION
  - Switch to a different avatar (variety = retention)
  - Background: house exterior or keys handover
  - "Owner financing lets you BUY without a bank saying no..."

Scene 4 (35-45 sec): CTA
  - Back to first avatar
  - OwnerFi branded background
  - "Follow Owner-Fy for daily updates."
```

**This multi-scene approach:**
- Mimics b-roll cuts (avatar switches = visual variety)
- Background images act as b-roll (real estate photos, city shots, charts)
- Different avatars keep viewer attention (human instinct to focus on new faces)
- Caption styling per scene creates visual rhythm
- No Submagic needed — captions are built in

---

## New Pipeline Architecture

### Current (6 steps, 2 external services)

```
Cron → GPT Script → HeyGen/Synthesia → R2 → Submagic → R2 → Late.dev
         ↑              ↑                       ↑
      OpenAI API    Video Provider          Caption/B-roll
      ~$0.001         ~$1-3/vid              $0.25/vid
```

### New (4 steps, 1 external service for video)

```
Cron → GPT Multi-Scene Script → Creatify v2 → R2 → Late.dev
         ↑                          ↑
      OpenAI API              Avatar + Captions + Backgrounds
      ~$0.001                   ~10 credits/vid
```

**What's eliminated:**
- HeyGen client + webhook handler + stuck detection
- Synthesia client + webhook handler + stuck detection
- Submagic client + webhook handler + stuck detection + export flow
- Agent selector / round-robin logic (Creatify has 1,500 avatars)
- Two-stage R2 upload (was: video provider → R2 → Submagic → R2)
- Firebase Storage (legacy, already mostly unused)

**What stays:**
- GPT script generation (enhanced for multi-scene)
- Cloudflare R2 (download from Creatify, store permanently)
- Late.dev (post to all platforms)
- Firestore (workflow tracking)
- Cost tracker (update for Creatify credits)
- Caption intelligence (adapt for v2 caption_setting)

---

## OwnerFi Brand Strategy — Target: 20-35 Year Old Renters

### Avatar Selection Strategy

Pick 4-6 avatars from Creatify's 1,500+ that resonate with the audience:

| Role | Look | Tone | Usage |
|------|------|------|-------|
| **Primary Male** | 25-30, casual (hoodie/streetwear) | Real talk, direct | Main scenes |
| **Primary Female** | 25-30, professional-casual | Confident, empowering | Alternate scenes |
| **Authority Male** | 30-35, business casual | Trustworthy, data-driven | Stats/proof scenes |
| **Authority Female** | 30-35, smart casual | Educational, warm | Solution scenes |

**Why this matters for 20-35 renters:**
- They scroll TikTok/Reels — need to see people who look like them
- Professional but not corporate (kills trust with this demo)
- Mix of genders and styles prevents audience fatigue
- Casual > formal for this age group

### Background Strategy

Pre-load a library of background images for scenes:

| Scene Type | Background | Purpose |
|------------|-----------|---------|
| Hook | Bold gradient (#1a1a2e → #2563eb) | Pattern interrupt |
| Problem | Apartment/rent sign stock photo | Make them feel it |
| Stats | Dark background with stat overlay | Data credibility |
| Solution | House exterior / keys / family | Aspirational |
| CTA | OwnerFi branded (#1a1a2e + logo) | Brand recall |

### Caption Style Strategy

Creatify v2 supports per-scene caption styling:

```json
{
  "font_family": "Montserrat",
  "font_size": 70,
  "style": "normal-black",
  "text_color": "#FFFFFF",
  "highlight_text_color": "#FCD34D",
  "offset": { "x": 0.0, "y": 0.45 }
}
```

- **Montserrat Bold** — clean, modern, readable on mobile
- **White text** with **yellow highlight** on active word
- **Bottom 45%** positioning — keeps avatar face visible
- **Font size 70** — readable on phone without squinting

### Voice Strategy

- **Speed:** Normal (1.0x) — rushed voiceover kills trust
- **Accent:** American English — matches target demo
- **Tone:** Conversational, NOT corporate — "your friend who knows real estate"
- Voice IDs selected per avatar from `GET /api/voices/` endpoint

---

## Implementation Plan — Phase 1: OwnerFi

### Step 1: Foundation (Day 1)

**New files to create:**
```
src/lib/creatify-client.ts          — API client (create, status, download)
src/config/creatify-agents.ts       — Avatar configs per brand
src/app/api/webhooks/creatify/[brand]/route.ts  — Webhook handler
```

**Creatify client functions:**
```typescript
// Core
checkCredits(): Promise<{ remaining: number }>
createVideo(request: CreatifyVideoRequest): Promise<{ id: string; status: string }>
getVideoStatus(id: string): Promise<CreatifyVideoStatus>

// Helpers
listPersonas(): Promise<CreatifyPersona[]>
listVoices(): Promise<CreatifyVoice[]>
```

### Step 2: Multi-Scene Script Generator (Day 1-2)

**Modify the GPT prompt to output structured multi-scene JSON instead of a flat script.**

Current output format:
```
SCRIPT: "Stop scrolling..."
TITLE: 🏠 Title Here
CAPTION: Caption text #hashtags
```

New output format:
```json
{
  "scenes": [
    {
      "type": "hook",
      "text": "STOP paying someone else's mortgage.",
      "duration_hint": "3s",
      "avatar_role": "primary_male",
      "background_type": "gradient"
    },
    {
      "type": "problem",
      "text": "Your rent goes up every year...",
      "duration_hint": "12s",
      "avatar_role": "primary_female",
      "background_type": "apartment"
    },
    {
      "type": "solution",
      "text": "Owner financing lets you buy...",
      "duration_hint": "20s",
      "avatar_role": "authority_male",
      "background_type": "house"
    },
    {
      "type": "cta",
      "text": "Follow Owner-Fy for daily updates.",
      "duration_hint": "5s",
      "avatar_role": "primary_male",
      "background_type": "branded"
    }
  ],
  "title": "🏠 Renting Forever? Read This",
  "caption": "Caption text #hashtags"
}
```

### Step 3: Scene-to-Creatify Mapper (Day 2)

**Converts GPT scene output → Creatify v2 `video_inputs` array:**

```typescript
function buildCreatifyPayload(scenes: Scene[], brand: Brand): CreatifyV2Request {
  return {
    video_inputs: scenes.map(scene => ({
      character: {
        type: "avatar",
        avatar_id: getAvatarForRole(scene.avatar_role, brand),
        scale: scene.type === "hook" ? 1.2 : 1.0,  // Zoom in on hook
        offset: { x: -0.2, y: 0.3 }
      },
      voice: {
        type: "text",
        input_text: scene.text,
        voice_id: getVoiceForRole(scene.avatar_role, brand),
        volume: 0.8
      },
      background: {
        type: "image",
        url: getBackgroundUrl(scene.background_type, brand),
        fit: "crop"
      },
      caption_setting: {
        style: "normal-black",
        font_family: "Montserrat",
        font_size: 70,
        text_color: "#FFFFFF",
        highlight_text_color: "#FCD34D",
        offset: { x: 0.0, y: 0.45 },
        hidden: false
      }
    })),
    aspect_ratio: "9x16"
  };
}
```

### Step 4: Webhook + Download (Day 2-3)

**New webhook handler at `/api/webhooks/creatify/[brand]`:**
- Receives completion callback
- Downloads from Creatify S3 URL to our R2
- Updates workflow status
- Triggers Late.dev posting

**Simpler than current setup:**
- No two-stage download (video provider → Submagic → R2)
- Single download: Creatify → R2
- No export triggering (Submagic required a separate export step)

### Step 5: OwnerFi Cron Update (Day 3)

**Update `/api/cron/generate-videos` for OwnerFi brand only:**
- Keep existing HeyGen/Synthesia flow for other brands
- OwnerFi uses new Creatify pipeline
- Feature flagged: `OWNERFI_VIDEO_PROVIDER=creatify`

### Step 6: Testing & Tuning (Day 3-5)

1. Generate 5 test videos manually via API
2. Compare quality to current HeyGen + Submagic output
3. Tune: avatar selection, background images, caption styling
4. Test webhook reliability (create → callback → R2 → post)
5. Test stuck workflow detection with Creatify status polling
6. Verify Late.dev posting works with Creatify-sourced R2 URLs

### Step 7: Go Live OwnerFi (Day 5-7)

1. Set `OWNERFI_VIDEO_PROVIDER=creatify` in Vercel env
2. Monitor first 3 days of automated videos
3. Check: engagement rates, completion rates, follower response
4. Tune prompts and avatar selection based on performance

---

## Phase 2-7: Replicate to Other Brands

Once OwnerFi is stable (~1 week), replicate:

| Phase | Brand | Unique Considerations |
|-------|-------|-----------------------|
| 2 | Carz | Auto/car backgrounds, different avatars |
| 3 | Abdullah | Personal brand — may want BYOA custom avatar |
| 4 | Gaza | Serious tone, muted backgrounds, stable voice delivery |
| 5 | Realtors | Professional avatars, educational tone |
| 6 | Benefit | Educational content, warm/encouraging tone |
| 7 | Personal | Manual uploads — may not need Creatify |

**Each brand gets its own:**
- Avatar roster (4-6 avatars tailored to brand audience)
- Background image library
- Caption style preset
- Voice/accent selection
- GPT prompt with brand-specific viral formula

---

## What We Delete After Full Migration

Once all brands are on Creatify:

```
DELETE: src/lib/heygen-client.ts
DELETE: src/lib/synthesia-client.ts
DELETE: src/lib/submagic-client.ts
DELETE: src/config/heygen-agents.ts
DELETE: src/config/synthesia-agents.ts
DELETE: src/app/api/webhooks/heygen/[brand]/route.ts
DELETE: src/app/api/webhooks/synthesia/[brand]/route.ts
DELETE: src/app/api/webhooks/submagic/[brand]/route.ts
DELETE: src/app/api/admin/recover-stuck-submagic/route.ts
DELETE: src/app/api/admin/submagic-status/route.ts
DELETE: src/app/api/workflow/retry-submagic/route.ts
DELETE: src/lib/agent-selector.ts (replaced by Creatify persona selection)

SIMPLIFY: src/app/api/cron/check-stuck-workflows/route.ts (1 provider instead of 3)
SIMPLIFY: src/lib/video-storage.ts (1 download path instead of 3)
SIMPLIFY: src/lib/cost-tracker.ts (1 video service instead of 3)
```

**~20 files deleted, ~5 files simplified.**

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Creatify quality lower than HeyGen + Submagic | Test 5-10 videos before going live; keep old pipeline as fallback |
| Creatify API down | Webhook handler retries; stuck-workflow cron polls status |
| Download URLs expire | Download to R2 immediately in webhook (same pattern as Synthesia) |
| Enterprise pricing too high | Compare per-video cost: current ~$1.50-4/vid vs Creatify credits |
| Caption quality worse than Submagic | Tune font_family, font_size, highlight_text_color, positioning |
| No b-roll stock footage | Use background images per scene as b-roll substitute; avatar switches create visual variety |
| Rate limits | Check `GET /api/remaining_credits/` before generation; respect Vercel 300s cron timeout |

---

## Action Items (Before Coding)

1. **Sign up for Creatify** — get API credentials (X-API-ID, X-API-KEY)
2. **Contact sales** (api@creatify.ai) — get enterprise pricing for 5,000 credits/month
3. **Browse avatars** — call `GET /api/personas/` and pick 4-6 for OwnerFi
4. **Browse voices** — call `GET /api/voices/` and pick matching voices
5. **Prepare background images** — upload 5-6 to R2 (branded gradients, real estate photos)
6. **Test one video manually** — POST to `/api/lipsyncs_v2/` and evaluate quality

Once you have credentials and have seen the quality, say the word and I'll build Phase 1.

---

*Created: March 10, 2026*
