# 🎯 BRAND-SPECIFIC SOCIAL MEDIA IMPLEMENTATION PLAN

## Executive Summary

**Goal**: Optimize Carz and OwnerFi brands with platform-specific captions and brand-specific posting times based on analytics data.

**Leave Podcast Alone**: User is still experimenting with Podcast brand - skip modifications.

---

## 📊 DATA-DRIVEN STRATEGY

### CARZ BRAND (Automotive/EV Content)

**Platform Priority**: YouTube > Instagram

**YouTube Strategy**:
- Performance: 401 avg views per post (strong!)
- Caption style: >200 chars (65% of top posts)
- Best time: Wednesday 8:00 AM
- Content focus: EV/automotive news, price comparisons, dealer vs wholesale

**Instagram Strategy**:
- Performance: Lower engagement
- Caption style: Adapt to shorter/punchier OR test current long format
- Best time: Friday 2:00 PM (general Instagram peak)
- Content focus: Car financing, bad credit solutions

**Recommendation**:
- Prioritize YouTube (70% of effort)
- Use long captions for YouTube
- Test both long and short for Instagram

---

### OWNERFI BRAND (Real Estate/Owner Financing)

**Platform Priority**: Instagram > YouTube

**Instagram Strategy**:
- Performance: 1.7 avg engagement per post
- Caption style: >200 chars works (80% of top posts) ⚠️ COUNTERINTUITIVE!
- Best time: Sunday 6:00 AM OR Friday 2:00 PM
- Content focus: Owner financing, bad credit homeownership, rent vs buy

**YouTube Strategy**:
- Performance: Secondary platform
- Caption style: >200 chars (explainer content)
- Best time: Wednesday 8:00 AM
- Content focus: Real estate education, owner financing process

**Recommendation**:
- Prioritize Instagram (65% of effort)
- KEEP long captions for Instagram (data proves this works for OwnerFi)
- Use educational long-form for YouTube

---

## 🛠️ TECHNICAL IMPLEMENTATION

### Phase 1: Caption Generator System

**New File**: `src/lib/platform-caption-generator.ts`

```typescript
interface BrandCaptionConfig {
  youtube: {
    minLength: number;
    includeEmoji: boolean;
    includeExclamation: boolean;
    contentFocus: string;
  };
  instagram: {
    targetLength: number;
    includeQuestion: boolean;
    contentFocus: string;
  };
}

const BRAND_CONFIGS: Record<string, BrandCaptionConfig> = {
  carz: {
    youtube: {
      minLength: 200,
      includeEmoji: true,
      includeExclamation: true,
      contentFocus: 'EV/automotive news, price comparisons, dealer tactics'
    },
    instagram: {
      targetLength: 200, // Start with long, can test shorter later
      includeQuestion: true,
      contentFocus: 'Car financing, bad credit solutions'
    }
  },
  ownerfi: {
    youtube: {
      minLength: 200,
      includeEmoji: true,
      includeExclamation: true,
      contentFocus: 'Real estate education, owner financing process'
    },
    instagram: {
      targetLength: 200, // Data shows long captions work!
      includeQuestion: true,
      contentFocus: 'Owner financing, bad credit homeownership, rent vs buy'
    }
  }
};

export interface PlatformCaptions {
  youtube: string;
  instagram: string;
  facebook?: string;
  tiktok?: string;
}

export async function generatePlatformCaptions(
  script: string,
  brand: string,
  originalCaption: string
): Promise<PlatformCaptions> {
  const config = BRAND_CONFIGS[brand];

  if (!config) {
    // Fallback for unknown brands (like podcast)
    return {
      youtube: originalCaption,
      instagram: originalCaption,
      facebook: originalCaption,
      tiktok: originalCaption
    };
  }

  // Generate YouTube caption
  const youtubeCaption = await generateYouTubeCaption(
    script,
    brand,
    config.youtube
  );

  // Generate Instagram caption
  const instagramCaption = await generateInstagramCaption(
    script,
    brand,
    config.instagram
  );

  return {
    youtube: youtubeCaption,
    instagram: instagramCaption,
    facebook: instagramCaption, // Use Instagram caption for FB
    tiktok: instagramCaption // Use Instagram caption for TikTok
  };
}

async function generateYouTubeCaption(
  script: string,
  brand: string,
  config: any
): Promise<string> {
  // Use OpenAI to generate platform-optimized caption
  const prompt = `
Generate a YouTube caption for a ${brand} video.

Script: ${script}

Requirements:
- Minimum ${config.minLength} characters
- ${config.includeEmoji ? 'Include relevant emoji' : 'No emoji'}
- ${config.includeExclamation ? 'Include exclamation marks for excitement' : 'Professional tone'}
- Content focus: ${config.contentFocus}
- Include call-to-action to follow
- Add relevant hashtags

Format:
[Emoji] [Attention-grabbing headline]!

[Detailed explanation - make it ${config.minLength}+ characters]

[Call to action]
#Hashtags #Relevant #ToContent
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });

  return response.choices[0].message.content || script;
}

async function generateInstagramCaption(
  script: string,
  brand: string,
  config: any
): Promise<string> {
  const prompt = `
Generate an Instagram caption for a ${brand} video.

Script: ${script}

Requirements:
- Target length: ${config.targetLength} characters
- ${config.includeQuestion ? 'Include a question to engage audience' : 'Direct statement'}
- Content focus: ${config.contentFocus}
- Keep it engaging and action-oriented

${brand === 'ownerfi'
  ? 'NOTE: Data shows LONG captions (200+ chars) perform best for OwnerFi. Make it detailed!'
  : 'Keep it concise but informative.'}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });

  return response.choices[0].message.content || script;
}
```

---

### Phase 2: Brand-Specific Queue Scheduling

**Modify**: `src/lib/late-api.ts`

Add function to get brand-specific posting time:

```typescript
/**
 * Get optimal posting time for a brand based on analytics
 */
export function getBrandOptimalTime(brand: string): { day: number; hour: number } {
  const schedules: Record<string, { day: number; hour: number }> = {
    carz: { day: 3, hour: 8 }, // Wednesday 8 AM
    ownerfi: { day: 0, hour: 6 }, // Sunday 6 AM (can also try Friday 2 PM: day: 5, hour: 14)
    // podcast: leave undefined for now
  };

  return schedules[brand] || { day: 5, hour: 14 }; // Default: Friday 2 PM
}

/**
 * Calculate next occurrence of brand's optimal posting time
 */
export function getNextBrandPostingTime(brand: string): Date {
  const { day: targetDay, hour: targetHour } = getBrandOptimalTime(brand);

  const now = new Date();
  const targetDate = new Date(now);

  // Calculate days until target day
  const currentDay = now.getDay();
  let daysUntilTarget = targetDay - currentDay;

  if (daysUntilTarget < 0) {
    daysUntilTarget += 7; // Next week
  } else if (daysUntilTarget === 0 && now.getHours() >= targetHour) {
    daysUntilTarget = 7; // Same day but past the hour, so next week
  }

  targetDate.setDate(now.getDate() + daysUntilTarget);
  targetDate.setHours(targetHour, 0, 0, 0);

  return targetDate;
}
```

---

### Phase 3: Update Workflow Integration

**Modify**: `src/app/api/workflow/complete-viral/route.ts`

**Current code** (around line 899-906):
```typescript
const postResult = await scheduleVideoPost(
  publicVideoUrl,
  content.caption,  // SAME caption for all platforms
  content.title,
  platforms,
  schedule,
  brand
);
```

**New code**:
```typescript
import { generatePlatformCaptions, PlatformCaptions } from '@/lib/platform-caption-generator';
import { getNextBrandPostingTime } from '@/lib/late-api';

// Around line 88-90, after generating content:
const content = await generateViralContent(article.content, brand);

// Generate platform-specific captions
let platformCaptions: PlatformCaptions;

if (brand === 'podcast') {
  // Leave podcast alone - use original caption for all platforms
  platformCaptions = {
    youtube: content.caption,
    instagram: content.caption,
    facebook: content.caption,
    tiktok: content.caption
  };
} else {
  // Generate platform-specific captions for Carz and OwnerFi
  platformCaptions = await generatePlatformCaptions(
    content.script,
    brand,
    content.caption
  );
}

// Get brand-specific optimal posting time
const scheduleTime = getNextBrandPostingTime(brand);

// Around line 899-906, modify to use platform-specific captions:
const postResult = await scheduleVideoPostWithPlatformCaptions(
  publicVideoUrl,
  platformCaptions, // Platform-specific captions
  content.title,
  platforms,
  scheduleTime, // Brand-specific time
  brand
);
```

**New function** in `src/lib/late-api.ts`:
```typescript
export async function scheduleVideoPostWithPlatformCaptions(
  videoUrl: string,
  platformCaptions: PlatformCaptions,
  title: string,
  platforms: string[],
  scheduledFor: Date,
  brand: string
): Promise<any> {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  if (!LATE_API_KEY) {
    throw new Error('LATE_API_KEY not found');
  }

  // Build platform-specific data
  const platformSpecificData: any[] = platforms.map(platform => {
    const caption = platformCaptions[platform as keyof PlatformCaptions] || platformCaptions.youtube;

    return {
      platform,
      caption,
      title: platform === 'youtube' ? title : undefined
    };
  });

  const requestBody = {
    content: platformCaptions.youtube, // Fallback caption
    platforms,
    platformSpecificData, // Platform-specific captions
    mediaUrls: [videoUrl],
    scheduledFor: scheduledFor.toISOString(),
    timezone: 'America/New_York',
    useQueue: true
  };

  const response = await fetch('https://getlate.dev/api/v1/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LATE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Late.dev API error: ${error}`);
  }

  return response.json();
}
```

---

## 📅 POSTING SCHEDULE CALENDAR

### Carz Brand:
- **Primary**: YouTube every Wednesday 8:00 AM
- **Secondary**: Instagram every Friday 2:00 PM
- **Focus**: 70% YouTube, 30% Instagram

### OwnerFi Brand:
- **Primary**: Instagram every Sunday 6:00 AM (or Friday 2:00 PM)
- **Secondary**: YouTube every Wednesday 8:00 AM
- **Focus**: 65% Instagram, 35% YouTube

### Podcast Brand:
- **Status**: LEAVE ALONE - user is still experimenting
- No changes to workflow

---

## 🚀 ROLLOUT PLAN

### Week 1: Build Caption Generator
1. Create `src/lib/platform-caption-generator.ts`
2. Test caption generation manually with 5 sample posts
3. Verify output quality for both Carz and OwnerFi

### Week 2: Integrate Scheduling
1. Add `getBrandOptimalTime()` and `getNextBrandPostingTime()` to `late-api.ts`
2. Create `scheduleVideoPostWithPlatformCaptions()` function
3. Test scheduling logic (dry run - don't actually post)

### Week 3: Update Workflow
1. Modify `complete-viral/route.ts` to use new caption generator
2. Add conditional logic to skip Podcast brand
3. Deploy to production
4. Monitor first 10 posts closely

### Week 4: Measure Results
1. Run analytics scripts weekly
2. Compare engagement before/after
3. Iterate on caption styles if needed

---

## 📊 EXPECTED IMPROVEMENTS

### Carz:
- **Before**: 401 avg YouTube views with generic captions
- **After**: 500+ avg YouTube views with optimized long captions at Wednesday 8 AM

### OwnerFi:
- **Before**: 1.7 avg Instagram engagement with long captions
- **After**: 2.5+ avg Instagram engagement with LONG captions at Sunday 6 AM

### Overall:
- More targeted content per platform
- Better posting times = higher initial engagement
- Algorithm boost from early engagement
- Clearer brand positioning

---

## ⚠️ IMPORTANT NOTES

1. **OwnerFi Instagram**: Data shows >200 char captions work best (80% of top posts). DON'T shorten them!

2. **Podcast**: Leave completely alone - no changes to workflow

3. **Testing**: Start with 10 posts per brand before full rollout

4. **Analytics**: Continue running brand-specific analysis weekly to track improvement

5. **Late.dev Queue**: May need to configure queue settings in Late.dev dashboard to align with optimal times

---

## 🎯 NEXT STEPS

Copy-paste ONE of these:

1. **"Start with Phase 1 - build the caption generator"**

2. **"Show me the exact code changes for each file"**

3. **"Test this with 5 manual posts first before automating"**

4. **"Build everything and deploy it"**

Which approach?
