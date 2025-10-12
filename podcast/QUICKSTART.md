# Quick Start Guide - Podcast System

Get your first podcast episode generated in 10 minutes!

## Step 1: Install FFmpeg (Required)

**macOS:**
```bash
brew install ffmpeg
```

**Verify:**
```bash
ffmpeg -version
```

## Step 2: Your Configuration is Ready!

Your podcast system is already configured with:
- ✅ Your avatar from social-media system
- ✅ Avatar ID: `31c6b2b6306b47a2ba3572a23be09dbc`
- ✅ Voice ID: `9070a6c2dbd54c10bb111dc8c655bff7`
- ✅ API keys from `.env.local`

## Step 3: Test Script Generation (30 seconds)

```bash
node podcast/tests/test-script-generation.js
```

**What this does:**
- Lists available guests
- Generates a sample 5-question script
- Shows estimated duration

**Expected output:**
```
✅ Script generated!
   Title: Dr. Smith on Nutrition and Diet
   Guest: Dr. Smith
   Duration: ~180s
```

## Step 4: Test Dual Output (5-10 minutes)

Generate 2 Q&A with individual clips + final video:

```bash
node podcast/tests/test-dual-output.js
```

**What this creates:**
```
podcast/output/episode-1/
├── q1.mp4              # Your question 1
├── a1.mp4              # Guest answer 1
├── q2.mp4              # Your question 2
├── a2.mp4              # Guest answer 2
├── episode-1-final.mp4 # Complete video (all 4 scenes)
└── metadata.json       # Episode info
```

**Timeline:**
- Script generation: ~10 seconds
- Video generation: ~5-8 minutes
- Total: ~5-10 minutes

## Step 5: Review Output

```bash
# Open output folder
open podcast/output/episode-1/

# Play final video
open podcast/output/episode-1/episode-1-final.mp4
```

## Step 6: Full Episode (Optional - 10-15 minutes)

Generate a complete 5 Q&A episode:

```bash
node podcast/tests/test-complete-podcast-dual.js
```

This creates:
- 10 clips (q1-q5, a1-a5)
- 1 complete video (~3-5 minutes)

## What You Get

### From Each Episode:

**Individual Clips:**
- Perfect for social media
- Each Q&A is one reel/short
- Post to: Instagram, TikTok, YouTube Shorts, etc.

**Complete Video:**
- Full podcast episode
- Post to: YouTube, Facebook
- 3-5 minutes long

**Example Usage:**
- 1 episode = 5 short clips + 1 long video
- Post long video to YouTube
- Post each short clip to TikTok/Reels
- **Result: 6 pieces of content from 1 automation run!**

## Publish to Your Metricool Brand

Your Metricool account is already configured:
- Brand ID: `3738036`
- User ID: `2946453`

**Long Form:**
- Upload `episode-X-final.mp4` to YouTube
- Upload `episode-X-final.mp4` to Facebook

**Short Form:**
- Upload `q1.mp4 + a1.mp4` to all short-form platforms
- Instagram Reels, TikTok, YouTube Shorts, etc.

## Troubleshooting

### "FFmpeg not found"
```bash
brew install ffmpeg
```

### "OPENAI_API_KEY not found"
Check `.env.local` has your OpenAI key

### "Avatar ID invalid"
The system uses your existing social-media avatar automatically

### Videos take too long
This is normal! HeyGen takes 2-3 minutes per clip:
- 2 Q&A = 4 clips = ~8 minutes
- 5 Q&A = 10 clips = ~20 minutes

## Next Steps

1. ✅ Test script generation
2. ✅ Test dual output (2 Q&A)
3. 📤 Review output videos
4. 🎨 Customize guest avatars (optional)
5. 🚀 Set up weekly automation

## Customize Guest Avatars (Optional)

To use different avatars for guests, edit:
```
podcast/config/guest-profiles.json
```

Find different avatar IDs from your HeyGen account and update:
```json
{
  "doctor": {
    "avatar_id": "your_doctor_avatar_id",
    "voice_id": "your_voice_id"
  }
}
```

Right now, all guests use your avatar (for testing), but you can customize them later.

## Weekly Automation

Once you're happy with the output, set up weekly automation:

```yaml
# .github/workflows/weekly-podcast.yml
name: Weekly Podcast
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday 9 AM
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: node podcast/tests/test-complete-podcast-dual.js
```

## Cost Per Episode

With 5 Q&A (10 clips):
- OpenAI: ~$0.10
- HeyGen: ~$1.00
- Submagic: ~$0.50 (optional)

**Total: ~$1.10-1.60 per episode**

---

Need help? Check:
- `podcast/docs/SETUP.md` - Detailed setup
- `podcast/docs/DUAL_OUTPUT_GUIDE.md` - Advanced features
- `podcast/docs/API_REFERENCE.md` - API docs
