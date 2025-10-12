# Weekly AI Podcast Automation System

Automated weekly podcast generation featuring your AI avatar interviewing expert avatars (doctors, real estate agents, car salesmen, etc.) with educational Q&A content for adults.

## Directory Structure

```
podcast/
├── config/              # Configuration files
│   ├── guest-profiles.json    # Guest avatar profiles database
│   └── podcast-config.json    # Podcast settings
├── lib/                 # Core libraries
│   ├── script-generator.ts    # GPT-4 script generation
│   ├── video-generator.ts     # Dual output: clips + stitched video
│   ├── heygen-podcast.ts      # HeyGen V2 multi-scene API (legacy)
│   ├── submagic-integration.ts # Caption automation
│   └── podcast-scheduler.ts   # Weekly scheduling
├── tests/               # Test scripts
│   ├── test-script-generation.js
│   ├── test-dual-output.js          # NEW: Test dual output
│   ├── test-complete-podcast-dual.js # NEW: Full workflow
│   └── test-heygen-multiscene.js
├── docs/                # Documentation
│   ├── SETUP.md
│   ├── DUAL_OUTPUT_GUIDE.md    # NEW: Dual output guide
│   └── API_REFERENCE.md
└── README.md            # This file
```

## Features

- Weekly automated podcast generation
- 5 Q&A format (host asks, expert answers)
- **Dual Output System:**
  - Individual Q&A clips (perfect for reels/shorts)
  - Complete stitched video (full podcast)
- Multi-scene HeyGen videos (10 scenes per episode)
- Random guest selection from profile database
- GPT-4 powered script generation
- Submagic caption integration
- Multi-platform publishing (YouTube, Facebook, Instagram, TikTok, etc.)
- Educational content for adults

## Workflow

```
Weekly Trigger
    ↓
Select Random Guest Profile (Doctor, Agent, etc.)
    ↓
GPT-4: Generate 5 Educational Q&A Pairs
    ↓
HeyGen V2: Generate Individual Clips (Q1, A1, Q2, A2, etc.)
    ↓
FFmpeg: Stitch Clips into Complete Video
    ↓
Submagic: Add Captions & Effects
    ↓
Multi-Platform Publishing:
  - Long Video → YouTube, Facebook
  - Short Clips → Reels, Shorts, TikTok, LinkedIn, Threads, Twitter
```

## Guest Avatar Types

- Medical Doctors (Health & Wellness)
- Real Estate Agents (Property Investment)
- Car Salesmen (Auto Industry)
- Financial Advisors (Money Management)
- Tech Experts (Technology Tips)
- Fitness Trainers (Exercise & Nutrition)

## Quick Start

1. **Install FFmpeg**: `brew install ffmpeg` (required for stitching)
2. **Configure Guest Profiles**: Edit `config/guest-profiles.json`
3. **Set Environment Variables**: Add to `.env.local`
4. **Test Script Generation**: `node tests/test-script-generation.js`
5. **Test Dual Output**: `node tests/test-dual-output.js` (creates clips + final video)
6. **Run Complete Workflow**: `node tests/test-complete-podcast-dual.js`

## Environment Variables Required

```env
# OpenAI (Script Generation)
OPENAI_API_KEY=your_key

# HeyGen (Video Generation)
HEYGEN_API_KEY=your_key

# Submagic (Captions)
SUBMAGIC_API_KEY=your_key

# YouTube (Publishing)
YOUTUBE_API_KEY=your_key
YOUTUBE_CHANNEL_ID=your_channel

# Podcast Configuration
PODCAST_HOST_AVATAR_ID=your_avatar_id
PODCAST_HOST_VOICE_ID=your_voice_id
PODCAST_SCHEDULE=weekly
PODCAST_DAY=monday
```

## API Routes

The podcast system uses dedicated API routes:

- `/api/podcast/generate` - Generate new podcast episode
- `/api/podcast/schedule` - Manage weekly schedule
- `/api/podcast/status/:id` - Check episode status
- `/api/podcast/publish/:id` - Publish to YouTube

## Output Structure

After generating an episode:

```
podcast/output/episode-1/
├── q1.mp4, a1.mp4, q2.mp4, a2.mp4, ... # Individual clips
├── episode-1-final.mp4                  # Complete stitched video
└── metadata.json                        # Episode details
```

**Use Cases:**
- **Long Video**: Upload `episode-X-final.mp4` to YouTube, Facebook
- **Short Clips**: Post individual `qX.mp4 + aX.mp4` to Reels, Shorts, TikTok
- **Flexibility**: Edit individual clips and re-stitch if needed

## Multi-Platform Publishing

Post to brand ID `3738036` (User `2946453`):

**Long Form (3-5 min):**
- YouTube (main channel)
- Facebook (video)

**Short Form (30-60s clips):**
- Facebook Reels
- Instagram Reels
- YouTube Shorts
- TikTok
- LinkedIn
- Threads
- Twitter

See `docs/DUAL_OUTPUT_GUIDE.md` for publishing strategies.

## Support

See documentation in `docs/` folder for detailed guides:
- `SETUP.md` - Initial setup
- `DUAL_OUTPUT_GUIDE.md` - Individual clips + stitching
- `API_REFERENCE.md` - API documentation
