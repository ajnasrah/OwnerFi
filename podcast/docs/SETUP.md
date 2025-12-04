# Podcast Automation Setup Guide

Complete guide to setting up your weekly AI podcast automation system.

## Prerequisites

- Node.js 18+ installed
- OpenAI API key (GPT-4 access)
- HeyGen API key with credits
- Submagic API key
- YouTube account (for publishing)

## Step 1: Environment Configuration

Add the following variables to your `.env.local` file:

```env
# OpenAI (Script Generation)
OPENAI_API_KEY=your_openai_key_here

# HeyGen (Video Generation)
HEYGEN_API_KEY=your_heygen_key_here

# Submagic (Captions)
SUBMAGIC_API_KEY=your_submagic_key_here

# YouTube (Publishing - Optional)
YOUTUBE_API_KEY=your_youtube_key
YOUTUBE_CHANNEL_ID=your_channel_id
```

## Step 2: Configure Guest Avatars

Edit `podcast/config/guest-profiles.json`:

### Update Host Avatar

```json
{
  "host": {
    "name": "Your Name",
    "avatar_type": "talking_photo",
    "avatar_id": "your_heygen_avatar_id",
    "voice_id": "your_heygen_voice_id",
    "scale": 1.4
  }
}
```

### Update Guest Avatars

For each guest profile, update the `avatar_id` and `voice_id`:

```json
{
  "doctor": {
    "avatar_id": "actual_heygen_avatar_id_for_doctor",
    "voice_id": "actual_voice_id_for_doctor"
  }
}
```

**How to get HeyGen Avatar IDs:**

1. Go to HeyGen dashboard
2. Navigate to "Avatars" section
3. Copy the ID of each avatar you want to use
4. Update `guest-profiles.json` accordingly

**Available avatar types:**
- `avatar`: Standard HeyGen avatar
- `talking_photo`: Photo avatar (like your custom avatar)

## Step 3: Test Script Generation

Run the script generation test:

```bash
node podcast/tests/test-script-generation.js
```

**Expected output:**
- List of available guests
- Generated Q&A script with 5 questions
- Estimated duration

**Troubleshooting:**
- `OPENAI_API_KEY not found`: Check `.env.local` file
- `File not found`: Ensure you're in the project root directory
- `API error`: Verify OpenAI key has GPT-4 access

## Step 4: Test Video Generation

Run the HeyGen multi-scene test:

```bash
node podcast/tests/test-heygen-multiscene.js
```

**This will:**
1. Generate a 2-question script
2. Create a multi-scene video (4 scenes: 2Q + 2A)
3. Wait for completion (2-5 minutes)
4. Return video URL

**Troubleshooting:**
- `Invalid avatar_id`: Update avatar IDs in `guest-profiles.json`
- `Insufficient credits`: Add credits to HeyGen account
- `Timeout error`: Increase wait time or check HeyGen status

## Step 5: Test Complete Workflow

Run the full end-to-end test:

```bash
node podcast/tests/test-complete-podcast.js
```

**This will:**
1. Generate script
2. Create video with HeyGen
3. Add captions with Submagic
4. Record episode in scheduler
5. Display final video URL

**Duration:** 5-10 minutes total

## Step 6: Configure Schedule

Edit `podcast/config/podcast-config.json`:

```json
{
  "schedule": {
    "frequency": "weekly",
    "day_of_week": "monday",
    "time": "09:00",
    "timezone": "America/New_York",
    "enabled": true
  }
}
```

## Step 7: Set Up Automation

### Option A: GitHub Actions (Recommended)

Create `.github/workflows/weekly-podcast.yml`:

```yaml
name: Weekly Podcast Generation

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  generate-podcast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: node podcast/tests/test-complete-podcast.js
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          HEYGEN_API_KEY: ${{ secrets.HEYGEN_API_KEY }}
          SUBMAGIC_API_KEY: ${{ secrets.SUBMAGIC_API_KEY }}
```

Add secrets in GitHub repository settings.

### Option B: Cron Job (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add line (runs every Monday at 9 AM)
0 9 * * 1 cd /path/to/ownerfi && node podcast/tests/test-complete-podcast.js
```

### Option C: Manual Trigger

Run manually whenever you want:

```bash
node podcast/tests/test-complete-podcast.js
```

## Step 8: Monitor Episodes

Check scheduler status:

```javascript
const { PodcastScheduler } = require('./podcast/lib/podcast-scheduler.ts');
const scheduler = new PodcastScheduler();

console.log(scheduler.getStats());
// Shows: total episodes, published count, recent guests
```

View all episodes:

```javascript
const episodes = scheduler.getAllEpisodes();
episodes.forEach(ep => {
  console.log(`Episode ${ep.episode_number}: ${ep.guest_id}`);
  console.log(`  Published: ${ep.published}`);
  console.log(`  YouTube: ${ep.youtube_url || 'Not published'}`);
});
```

## Customization Options

### Change Questions Per Episode

In `podcast/config/podcast-config.json`:

```json
{
  "generation": {
    "questions_per_episode": 7,  // Change from 5 to 7
  }
}
```

### Change Video Format

For landscape YouTube videos:

```json
{
  "video": {
    "format": "landscape",
    "width": 1920,
    "height": 1080
  }
}
```

### Change Caption Style

```json
{
  "captions": {
    "template": "Alex Hormozi",  // or "MrBeast", "Hormozi 2", etc.
  }
}
```

### Add More Guest Types

Edit `guest-profiles.json` and add new profiles:

```json
{
  "profiles": {
    "lawyer": {
      "id": "lawyer",
      "name": "Attorney Johnson",
      "title": "Legal Expert",
      "expertise": "Law & Legal Advice",
      "avatar_id": "your_lawyer_avatar",
      "voice_id": "professional_voice",
      "question_topics": [
        "small business legal",
        "contracts basics",
        "intellectual property"
      ]
    }
  }
}
```

## Cost Estimates

Per episode (5 questions = 10 scenes):

- **OpenAI GPT-4**: ~$0.10 per script
- **HeyGen**: ~$0.50-1.00 per video (depends on plan)
- **Submagic**: ~$0.25-0.50 per video

**Monthly cost (4 episodes):** $3-6

## Troubleshooting

### "Module not found" errors

```bash
npm install
```

### TypeScript errors

The `.ts` files are dynamically imported. If you see errors:

```bash
npm install -D typescript @types/node
```

### HeyGen timeout

Increase timeout in test files:

```javascript
await videoGen.waitForVideoCompletion(videoId, 15); // 15 minutes
```

### Submagic API errors

Check API key and account status:
- Login to Submagic dashboard
- Verify API key is active
- Check credit balance

## Next Steps

1. ✅ Test all components individually
2. ✅ Run complete workflow test
3. ✅ Set up automation (GitHub Actions or cron)
4. 📤 Add YouTube publishing (coming soon)
5. 🔄 Monitor and refine

## Support

For issues, check:
- `podcast/docs/API_REFERENCE.md`
- HeyGen documentation: https://docs.heygen.com
- Submagic documentation: https://submagic.co/docs
