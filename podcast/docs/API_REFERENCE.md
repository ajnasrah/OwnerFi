# Podcast System API Reference

Complete API reference for the podcast automation system.

## ScriptGenerator

Generates podcast scripts using GPT-4.

### Constructor

```typescript
new ScriptGenerator(apiKey: string)
```

**Parameters:**
- `apiKey`: OpenAI API key

### Methods

#### generateScript()

```typescript
async generateScript(
  guestId?: string,
  questionsCount: number = 5
): Promise<PodcastScript>
```

Generate a complete podcast script with Q&A pairs.

**Parameters:**
- `guestId` (optional): Guest profile ID. If not provided, selects randomly.
- `questionsCount`: Number of questions (default: 5)

**Returns:**
```typescript
{
  episode_title: string;
  guest_id: string;
  guest_name: string;
  topic: string;
  qa_pairs: Array<{
    question: string;
    answer: string;
  }>;
  estimated_duration_seconds: number;
}
```

**Example:**
```javascript
const generator = new ScriptGenerator(process.env.OPENAI_API_KEY);

// Random guest
const script = await generator.generateScript();

// Specific guest
const doctorScript = await generator.generateScript('doctor', 5);
```

#### selectRandomGuest()

```typescript
selectRandomGuest(excludeRecent: string[] = []): GuestProfile
```

Select a random guest, optionally excluding recent ones.

#### listGuests()

```typescript
listGuests(): GuestProfile[]
```

Get all available guest profiles.

#### getGuestProfile()

```typescript
getGuestProfile(guestId: string): GuestProfile | null
```

Get a specific guest profile by ID.

---

## HeyGenPodcastGenerator

Creates multi-scene videos using HeyGen V2 API.

### Constructor

```typescript
new HeyGenPodcastGenerator(apiKey: string)
```

**Parameters:**
- `apiKey`: HeyGen API key

### Methods

#### generatePodcastVideo()

```typescript
async generatePodcastVideo(script: PodcastScript): Promise<string>
```

Generate a multi-scene podcast video from a script.

**Parameters:**
- `script`: PodcastScript object from ScriptGenerator

**Returns:**
- HeyGen video ID (string)

**Example:**
```javascript
const videoGen = new HeyGenPodcastGenerator(process.env.HEYGEN_API_KEY);
const videoId = await videoGen.generatePodcastVideo(script);
```

#### checkVideoStatus()

```typescript
async checkVideoStatus(videoId: string): Promise<{
  status: string;
  video_url?: string;
  duration?: number;
  error?: string;
}>
```

Check the status of a video generation job.

**Status values:**
- `pending`: Queued
- `processing`: Generating
- `completed`: Ready
- `failed`: Error occurred

#### waitForVideoCompletion()

```typescript
async waitForVideoCompletion(
  videoId: string,
  maxWaitMinutes: number = 10
): Promise<string>
```

Poll video status until completion.

**Parameters:**
- `videoId`: HeyGen video ID
- `maxWaitMinutes`: Maximum wait time (default: 10)

**Returns:**
- Video URL (string)

**Example:**
```javascript
const videoUrl = await videoGen.waitForVideoCompletion(videoId, 15);
console.log(`Video ready: ${videoUrl}`);
```

#### estimateVideoDuration()

```typescript
estimateVideoDuration(script: PodcastScript): number
```

Estimate video duration in seconds based on word count.

---

## SubmagicIntegration

Adds captions to videos using Submagic.

### Constructor

```typescript
new SubmagicIntegration(apiKey: string)
```

**Parameters:**
- `apiKey`: Submagic API key

### Methods

#### addCaptions()

```typescript
async addCaptions(
  videoUrl: string,
  template: string = 'Hormozi 2',
  language: string = 'en'
): Promise<string>
```

Add captions to a video.

**Parameters:**
- `videoUrl`: URL of video to caption
- `template`: Caption style (default: 'Hormozi 2')
- `language`: Language code (default: 'en')

**Available templates:**
- `Hormozi 2`
- `Alex Hormozi`
- `MrBeast`
- `Ali Abdaal`

**Returns:**
- Final video URL with captions

**Example:**
```javascript
const submagic = new SubmagicIntegration(process.env.SUBMAGIC_API_KEY);
const finalUrl = await submagic.addCaptions(
  videoUrl,
  'Hormozi 2',
  'en'
);
```

#### checkStatus()

```typescript
async checkStatus(jobId: string): Promise<SubmagicResponse>
```

Check status of a caption job.

#### waitForCompletion()

```typescript
async waitForCompletion(
  jobId: string,
  maxWaitMinutes: number = 15
): Promise<string>
```

Wait for caption job to complete.

---

## PodcastScheduler

Manages weekly podcast scheduling and episode tracking.

### Constructor

```typescript
new PodcastScheduler()
```

Loads configuration from `podcast/config/podcast-config.json`.

### Methods

#### shouldGenerateEpisode()

```typescript
shouldGenerateEpisode(): boolean
```

Check if it's time to generate a new episode.

**Returns:**
- `true` if a new episode should be generated
- `false` if not yet time

**Example:**
```javascript
const scheduler = new PodcastScheduler();

if (scheduler.shouldGenerateEpisode()) {
  // Generate new episode
}
```

#### getRecentGuestIds()

```typescript
getRecentGuestIds(count: number = 4): string[]
```

Get IDs of recently used guests.

**Parameters:**
- `count`: Number of recent guests to return (default: 4)

**Returns:**
- Array of guest IDs

**Example:**
```javascript
const recentGuests = scheduler.getRecentGuestIds();
// Pass to scriptGenerator.selectRandomGuest(recentGuests) to avoid repetition
```

#### recordEpisode()

```typescript
recordEpisode(guestId: string, videoId: string): number
```

Record a new episode.

**Parameters:**
- `guestId`: Guest profile ID used
- `videoId`: HeyGen video ID

**Returns:**
- Episode number (integer)

**Example:**
```javascript
const episodeNum = scheduler.recordEpisode('doctor', videoId);
console.log(`Episode #${episodeNum} recorded`);
```

#### markPublished()

```typescript
markPublished(episodeNumber: number, youtubeUrl: string): void
```

Mark an episode as published.

**Parameters:**
- `episodeNumber`: Episode number
- `youtubeUrl`: Published YouTube URL

#### getAllEpisodes()

```typescript
getAllEpisodes(): EpisodeRecord[]
```

Get all episodes.

**Returns:**
```typescript
Array<{
  episode_number: number;
  guest_id: string;
  generated_at: string;
  video_id: string;
  published: boolean;
  youtube_url?: string;
}>
```

#### getEpisode()

```typescript
getEpisode(episodeNumber: number): EpisodeRecord | undefined
```

Get a specific episode by number.

#### getStats()

```typescript
getStats(): {
  total_episodes: number;
  published_episodes: number;
  last_episode_number: number;
  recent_guests: string[];
  schedule_enabled: boolean;
  next_scheduled: string;
}
```

Get scheduler statistics.

**Example:**
```javascript
const stats = scheduler.getStats();
console.log(`Total episodes: ${stats.total_episodes}`);
console.log(`Published: ${stats.published_episodes}`);
console.log(`Next scheduled: ${stats.next_scheduled}`);
```

---

## Configuration Files

### guest-profiles.json

Defines all guest avatars and the host.

**Structure:**
```json
{
  "profiles": {
    "guest_id": {
      "id": "guest_id",
      "name": "Guest Name",
      "title": "Professional Title",
      "expertise": "Area of Expertise",
      "avatar_type": "avatar" | "talking_photo",
      "avatar_id": "heygen_avatar_id",
      "voice_id": "heygen_voice_id",
      "question_topics": ["topic1", "topic2"],
      "tone": "professional, friendly",
      "background_color": "#hexcolor"
    }
  },
  "host": {
    "name": "Host Name",
    "avatar_type": "talking_photo",
    "avatar_id": "host_avatar_id",
    "voice_id": "host_voice_id",
    "scale": 1.4,
    "background_color": "#ffffff"
  },
  "video_settings": {
    "dimension": { "width": 1080, "height": 1920 },
    "questions_per_episode": 5,
    "scene_count": 10,
    "target_duration_minutes": 5
  }
}
```

### podcast-config.json

General podcast settings.

**Structure:**
```json
{
  "podcast": {
    "title": "Podcast Title",
    "description": "Description",
    "category": "Education",
    "language": "en"
  },
  "schedule": {
    "frequency": "weekly",
    "day_of_week": "monday",
    "time": "09:00",
    "timezone": "America/New_York",
    "enabled": true
  },
  "generation": {
    "questions_per_episode": 5,
    "answer_length": "medium",
    "conversational_style": "professional_friendly"
  },
  "video": {
    "format": "vertical",
    "width": 1080,
    "height": 1920
  },
  "captions": {
    "enabled": true,
    "provider": "submagic",
    "template": "Hormozi 2"
  }
}
```

---

## Error Handling

All async methods can throw errors. Wrap in try-catch:

```javascript
try {
  const script = await generator.generateScript();
  const videoId = await videoGen.generatePodcastVideo(script);
  const videoUrl = await videoGen.waitForVideoCompletion(videoId);
} catch (error) {
  console.error('Podcast generation failed:', error.message);

  // Handle specific errors
  if (error.message.includes('API key')) {
    // Invalid API key
  } else if (error.message.includes('timeout')) {
    // Video generation took too long
  }
}
```

---

## Complete Workflow Example

```javascript
// Import all modules
const { ScriptGenerator } = await import('./podcast/lib/script-generator.ts');
const { HeyGenPodcastGenerator } = await import('./podcast/lib/heygen-podcast.ts');
const { SubmagicIntegration } = await import('./podcast/lib/submagic-integration.ts');
const { PodcastScheduler } = await import('./podcast/lib/podcast-scheduler.ts');

// Initialize
const scriptGen = new ScriptGenerator(process.env.OPENAI_API_KEY);
const videoGen = new HeyGenPodcastGenerator(process.env.HEYGEN_API_KEY);
const submagic = new SubmagicIntegration(process.env.SUBMAGIC_API_KEY);
const scheduler = new PodcastScheduler();

// Check if it's time
if (!scheduler.shouldGenerateEpisode()) {
  console.log('Not time yet for new episode');
  process.exit(0);
}

// Generate
const recentGuests = scheduler.getRecentGuestIds();
const script = await scriptGen.generateScript(undefined, 5);

const videoId = await videoGen.generatePodcastVideo(script);
const rawVideoUrl = await videoGen.waitForVideoCompletion(videoId);
const finalVideoUrl = await submagic.addCaptions(rawVideoUrl);

// Record
const episodeNum = scheduler.recordEpisode(script.guest_id, videoId);

console.log(`Episode #${episodeNum} complete: ${finalVideoUrl}`);

// Publish to YouTube (manual for now)
// Then mark as published:
// scheduler.markPublished(episodeNum, youtubeUrl);
```
