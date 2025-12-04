# Dual Output System Guide

Generate both **individual clips** and a **final stitched video** for maximum flexibility.

## Overview

The dual-output system gives you:

1. **Individual Clips** - Separate Q&A video files
2. **Final Stitched Video** - Complete episode ready to publish
3. **Metadata** - JSON file with all episode details

## Output Structure

After generating an episode, you'll get:

```
podcast/output/episode-1/
├── q1.mp4              # Question 1 clip
├── a1.mp4              # Answer 1 clip
├── q2.mp4              # Question 2 clip
├── a2.mp4              # Answer 2 clip
├── q3.mp4              # Question 3 clip
├── a3.mp4              # Answer 3 clip
├── q4.mp4              # Question 4 clip
├── a4.mp4              # Answer 4 clip
├── q5.mp4              # Question 5 clip
├── a5.mp4              # Answer 5 clip
├── episode-1-final.mp4 # Stitched complete video
├── filelist.txt        # FFmpeg concat file
└── metadata.json       # Episode details
```

## Prerequisites

### Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org

**Verify installation:**
```bash
ffmpeg -version
```

## Usage

### Quick Test (2 Questions)

```bash
node podcast/tests/test-dual-output.js
```

This generates:
- 4 clips (Q1, A1, Q2, A2)
- 1 final video
- ~5-10 minutes total

### Full Episode (5 Questions)

```bash
node podcast/tests/test-complete-podcast-dual.js
```

This generates:
- 10 clips (Q1-Q5, A1-A5)
- 1 final stitched video
- Metadata file
- ~10-15 minutes total

## Using the VideoGenerator Directly

```javascript
const { ScriptGenerator } = await import('./podcast/lib/script-generator.ts');
const { PodcastVideoGenerator } = await import('./podcast/lib/video-generator.ts');

// Check FFmpeg first
if (!PodcastVideoGenerator.checkFFmpeg()) {
  console.error('FFmpeg not installed!');
  process.exit(1);
}

// Initialize
const scriptGen = new ScriptGenerator(process.env.OPENAI_API_KEY);
const videoGen = new PodcastVideoGenerator(process.env.HEYGEN_API_KEY);

// Generate script
const script = await scriptGen.generateScript('doctor', 5);

// Generate both clips and final video
const output = await videoGen.generatePodcast(script, 1);

console.log('Individual clips:', output.individual_clips);
console.log('Final video:', output.final_video_url);
console.log('Directory:', output.clips_directory);
```

## Workflow Options

### Option 1: Use Final Stitched Video

**Best for:** Quick publishing

1. Generate episode
2. Add captions to final video (Submagic)
3. Publish to YouTube

```bash
node podcast/tests/test-complete-podcast-dual.js
# Upload episode-X-final.mp4 to YouTube
```

### Option 2: Edit Individual Clips

**Best for:** Custom editing, reordering, or trimming

1. Generate episode
2. Edit individual clips (q1.mp4, a1.mp4, etc.)
3. Re-stitch edited clips
4. Add captions
5. Publish

```bash
# Generate
node podcast/tests/test-dual-output.js

# Edit clips manually (in video editor)

# Re-stitch with FFmpeg
cd podcast/output/episode-1
ffmpeg -f concat -safe 0 -i filelist.txt -c copy episode-1-edited.mp4
```

### Option 3: Use Clips Separately

**Best for:** Social media teasers, reels, shorts

1. Generate episode
2. Post individual Q&A clips on:
   - Instagram Reels
   - TikTok
   - YouTube Shorts
3. Post full video on YouTube

```bash
# Each clip is perfect for short-form content
# q1.mp4 + a1.mp4 = One complete Q&A
```

## Metadata File

The `metadata.json` file contains:

```json
{
  "episode_number": 1,
  "episode_title": "Dr. Smith on Nutrition and Diet",
  "guest_id": "doctor",
  "guest_name": "Dr. Smith",
  "topic": "nutrition and diet",
  "clips": [
    {
      "scene": 1,
      "type": "question",
      "video_url": "https://heygen.ai/...",
      "text": "What's the biggest nutrition myth?"
    },
    {
      "scene": 2,
      "type": "answer",
      "video_url": "https://heygen.ai/...",
      "text": "The biggest myth is..."
    }
  ],
  "final_video": "/path/to/episode-1-final.mp4",
  "generated_at": "2025-10-12T10:30:00.000Z"
}
```

Use this for:
- Tracking episode details
- Creating YouTube descriptions
- Generating thumbnails
- Social media posts

## Re-Stitching Clips

If you edit individual clips, re-stitch them:

### Simple Concatenation (same format):

```bash
cd podcast/output/episode-1

ffmpeg -f concat -safe 0 -i filelist.txt -c copy episode-1-restitched.mp4
```

### With Re-encoding (different formats):

```bash
ffmpeg -f concat -safe 0 -i filelist.txt \
  -c:v libx264 -preset fast -crf 22 -c:a aac \
  episode-1-restitched.mp4
```

### Custom Order:

Create a custom `filelist-custom.txt`:

```
file 'q1.mp4'
file 'a1.mp4'
file 'q3.mp4'  # Skip Q2
file 'a3.mp4'
file 'q2.mp4'  # Move Q2 to end
file 'a2.mp4'
```

Then stitch:

```bash
ffmpeg -f concat -safe 0 -i filelist-custom.txt -c copy custom-order.mp4
```

## Adding Captions to Individual Clips

You can add captions to:

1. **Final stitched video** (recommended)
2. **Individual clips** (for separate posting)

### Caption Final Video:

```javascript
const { SubmagicIntegration } = await import('./podcast/lib/submagic-integration.ts');

// Upload final video to get public URL first
const publicUrl = 'https://your-host.com/episode-1-final.mp4';

const submagic = new SubmagicIntegration(process.env.SUBMAGIC_API_KEY);
const captionedUrl = await submagic.addCaptions(publicUrl, 'Hormozi 2');
```

### Caption Individual Clips:

```javascript
// Caption each clip separately
for (const clip of individualClips) {
  const publicUrl = await uploadClip(clip.video_url);
  const captionedUrl = await submagic.addCaptions(publicUrl);
  // Download and save
}
```

## Disk Space Considerations

Videos can be large:

- Each clip: ~5-20 MB (depends on length)
- 10 clips: ~50-200 MB
- Final video: ~50-200 MB

**Total per episode:** ~100-400 MB

Clean up old episodes:

```bash
# Remove episode directory
rm -rf podcast/output/episode-1

# Keep only final videos
cd podcast/output/episode-1
rm q*.mp4 a*.mp4 filelist.txt
# Keep only episode-1-final.mp4
```

## Troubleshooting

### FFmpeg Not Found

```bash
# macOS
brew install ffmpeg

# Verify
ffmpeg -version
```

### "No such file" Error

Make sure you're in the project root:

```bash
cd /path/to/ownerfi
node podcast/tests/test-dual-output.js
```

### Clips Not Concatenating

If FFmpeg concat fails, try re-encoding:

```bash
ffmpeg -f concat -safe 0 -i filelist.txt \
  -c:v libx264 -c:a aac episode-reencoded.mp4
```

### Video Quality Issues

Adjust encoding quality:

```bash
# Higher quality (larger file)
-crf 18

# Lower quality (smaller file)
-crf 28

# Default
-crf 22
```

### Out of Disk Space

Clean up test episodes:

```bash
rm -rf podcast/output/episode-*
```

## Best Practices

1. **Test with 2 questions first** - Faster iteration
2. **Keep individual clips** - Easy to re-edit later
3. **Back up final videos** - Upload to cloud storage
4. **Clean old episodes** - Free up disk space
5. **Use metadata.json** - Track all episode details

## Example Workflow

```bash
# 1. Generate episode with 3 Q&A (for testing)
node podcast/tests/test-dual-output.js

# 2. Review clips
open podcast/output/episode-1/

# 3. If clips look good, add captions to final video
# (Upload episode-1-final.mp4 to get public URL)

# 4. Publish to YouTube

# 5. Clean up (optional)
# Keep final video, remove individual clips to save space
cd podcast/output/episode-1
rm q*.mp4 a*.mp4
```

## Advanced: Batch Processing

Generate multiple episodes:

```javascript
for (let i = 0; i < 5; i++) {
  const script = await scriptGen.generateScript();
  const output = await videoGen.generatePodcast(script, i + 1);
  console.log(`Episode ${i + 1} complete`);
}
```

Run overnight to generate a week's worth of content!

---

For more details, see:
- `SETUP.md` - Initial setup
- `API_REFERENCE.md` - API documentation
