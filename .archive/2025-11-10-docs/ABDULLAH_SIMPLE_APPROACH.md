# Abdullah Video System - SIMPLE APPROACH

## The Simple Way

**5 separate cron jobs, each runs once per day and does the ENTIRE workflow:**

```
Cron #1 (8:30 AM)  → Generate MINDSET script  → Create video → Post at 9:00 AM
Cron #2 (11:30 AM) → Generate BUSINESS script → Create video → Post at 12:00 PM
Cron #3 (2:30 PM)  → Generate MONEY script    → Create video → Post at 3:00 PM
Cron #4 (5:30 PM)  → Generate FREEDOM script  → Create video → Post at 6:00 PM
Cron #5 (8:30 PM)  → Generate STORY script    → Create video → Post at 9:00 PM
```

## How Each Cron Works

Each cron does the COMPLETE workflow in one go:

1. **Call ChatGPT** - "Generate ONE script for {theme}"
2. **Create HeyGen video** - Send script to HeyGen
3. **Wait for webhooks** - HeyGen → Submagic → Done
4. **Auto-post** - Webhooks handle posting at scheduled time

**ONE cron = ONE theme = ONE video**

## Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/abdullah/mindset",
      "schedule": "30 13 * * *"
    },
    {
      "path": "/api/cron/abdullah/business",
      "schedule": "30 16 * * *"
    },
    {
      "path": "/api/cron/abdullah/money",
      "schedule": "30 19 * * *"
    },
    {
      "path": "/api/cron/abdullah/freedom",
      "schedule": "30 22 * * *"
    },
    {
      "path": "/api/cron/abdullah/story",
      "schedule": "30 1 * * *"
    }
  ]
}
```

**Note:** Times are in UTC. CST is UTC-6, so:
- 8:30 AM CST = 2:30 PM UTC (14:30)
- 11:30 AM CST = 5:30 PM UTC (17:30)
- 2:30 PM CST = 8:30 PM UTC (20:30)
- 5:30 PM CST = 11:30 PM UTC (23:30)
- 8:30 PM CST = 2:30 AM UTC (02:30)

## File Structure

Create 5 simple cron files:

```
/api/cron/abdullah/
  ├── mindset/route.ts    (runs 8:30 AM CST)
  ├── business/route.ts   (runs 11:30 AM CST)
  ├── money/route.ts      (runs 2:30 PM CST)
  ├── freedom/route.ts    (runs 5:30 PM CST)
  └── story/route.ts      (runs 8:30 PM CST)
```

## Example Cron Implementation

```typescript
// /api/cron/abdullah/mindset/route.ts

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent');
  const isVercelCron = userAgent === 'vercel-cron/1.0';

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🌅 MINDSET CRON - Generating morning motivation video');

  try {
    // 1. Generate script with ChatGPT
    const { generateSingleAbdullahScript } = await import('@/lib/abdullah-content-generator');
    const script = await generateSingleAbdullahScript('mindset');

    console.log(`✅ Script generated: "${script.title}"`);

    // 2. Create workflow
    const { addWorkflowToQueue, updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
    const workflow = await addWorkflowToQueue(
      `abdullah_mindset_${Date.now()}`,
      script.title,
      'abdullah'
    );

    await updateWorkflowStatus(workflow.id, 'abdullah', {
      caption: script.caption,
      title: script.title,
      status: 'heygen_processing',
      scheduledPostTime: getPostTime() // 9:00 AM CST
    } as any);

    // 3. Send to HeyGen
    const { buildAbdullahVideoRequest } = await import('@/lib/abdullah-content-generator');
    const { getBrandWebhookUrl } = await import('@/lib/brand-utils');

    const videoRequest = buildAbdullahVideoRequest(script, workflow.id);
    const webhookUrl = getBrandWebhookUrl('abdullah', 'heygen');

    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': HEYGEN_API_KEY!
      },
      body: JSON.stringify({
        ...videoRequest,
        webhook_url: webhookUrl,
        test: false
      })
    });

    if (!response.ok) {
      throw new Error(`HeyGen API error: ${response.status}`);
    }

    const data = await response.json();
    const videoId = data.data.video_id;

    console.log(`✅ HeyGen video initiated: ${videoId}`);

    // 4. Update workflow with video ID
    await updateWorkflowStatus(workflow.id, 'abdullah', {
      heygenVideoId: videoId
    } as any);

    console.log(`✅ MINDSET workflow complete - webhooks will handle rest`);
    console.log(`   Will post at 9:00 AM CST`);

    return NextResponse.json({
      success: true,
      theme: 'mindset',
      workflowId: workflow.id,
      heygenVideoId: videoId,
      title: script.title,
      postTime: '9:00 AM CST'
    });

  } catch (error) {
    console.error('❌ MINDSET cron error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getPostTime(): number {
  const now = new Date();
  const postTime = new Date(now);

  // Set to 9:00 AM CST today
  postTime.setHours(9, 0, 0, 0);

  // If 9 AM already passed, schedule for tomorrow
  if (postTime < now) {
    postTime.setDate(postTime.getDate() + 1);
  }

  return postTime.getTime();
}

export async function POST(request: NextRequest) {
  return GET(request);
}
```

## ChatGPT Prompt Per Theme

Each cron calls ChatGPT with a specific theme:

### Mindset (8:30 AM → Post 9:00 AM)
```
Generate ONE motivational video script for Abdullah's morning content.

Theme: MINDSET
Posting Time: 9:00 AM (morning motivation)
Target: People starting their day

Create:
- Script (40-60 words, 30-45 seconds)
- Title (3-5 words)
- Caption (with emojis and engagement question)
- Hook (first sentence)

Focus: Morning energy, positive thinking, setting intentions

Make it authentic to Abdullah's voice: real talk, action-oriented, confident but vulnerable.
```

### Business (11:30 AM → Post 12:00 PM)
```
Generate ONE business video script for Abdullah's midday content.

Theme: BUSINESS
Posting Time: 12:00 PM (lunch break)
Target: Entrepreneurs during work hours

Create:
- Script (40-60 words)
- Title (3-5 words)
- Caption (with emojis)
- Hook (first sentence)

Focus: Deals, sales, entrepreneurship, hustle

Make it actionable and valuable, not just motivation.
```

### Money (2:30 PM → Post 3:00 PM)
```
Generate ONE financial video script for Abdullah's afternoon content.

Theme: MONEY
Posting Time: 3:00 PM (afternoon)
Target: People thinking about wealth

Create:
- Script (40-60 words)
- Title (3-5 words)
- Caption (with emojis)
- Hook (first sentence)

Focus: Wealth building, financial mindset, breaking poverty thinking

Real talk about money - no BS.
```

### Freedom (5:30 PM → Post 6:00 PM)
```
Generate ONE lifestyle video script for Abdullah's evening content.

Theme: FREEDOM
Posting Time: 6:00 PM (end of work day)
Target: People dreaming of freedom

Create:
- Script (40-60 words)
- Title (3-5 words)
- Caption (with emojis)
- Hook (first sentence)

Focus: Time freedom, location independence, living on your terms

Inspire without being preachy.
```

### Story (8:30 PM → Post 9:00 PM)
```
Generate ONE personal story video script for Abdullah's night content.

Theme: STORY/LESSON
Posting Time: 9:00 PM (evening reflection)
Target: People winding down, seeking inspiration

Create:
- Script (40-60 words)
- Title (3-5 words)
- Caption (with emojis)
- Hook (first sentence)

Focus: Personal experience, lesson learned, vulnerability

Share a real moment - wins or losses.
```

## Implementation in abdullah-content-generator.ts

Add this new function:

```typescript
export async function generateSingleAbdullahScript(
  theme: 'mindset' | 'business' | 'money' | 'freedom' | 'story',
  openaiApiKey?: string
): Promise<AbdullahVideo> {

  const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const prompts = {
    mindset: 'Generate ONE motivational video script for morning content...',
    business: 'Generate ONE business video script for midday content...',
    money: 'Generate ONE financial video script for afternoon content...',
    freedom: 'Generate ONE lifestyle video script for evening content...',
    story: 'Generate ONE personal story video script for night content...'
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [{
        role: 'system',
        content: 'You are a personal brand content creator for Abdullah...'
      }, {
        role: 'user',
        content: prompts[theme]
      }],
      temperature: 0.9
    })
  });

  const data = await response.json();
  const scriptText = data.choices[0].message.content;

  // Parse the response into AbdullahVideo format
  return parseScriptResponse(scriptText, theme);
}
```

## Benefits of This Approach

✅ **Super simple** - Each cron is independent
✅ **No queue complexity** - Direct workflow
✅ **No race conditions** - Runs at different times
✅ **Easy to debug** - Each cron is isolated
✅ **Easy to disable** - Just comment out one cron
✅ **Easy to reschedule** - Just change cron time

## Next Steps

1. Create 5 cron route files
2. Add `generateSingleAbdullahScript()` function
3. Configure Vercel cron schedule
4. Test each cron individually
5. Deploy and monitor

**No complex queue, no batching, no confusion - just 5 simple crons!**
