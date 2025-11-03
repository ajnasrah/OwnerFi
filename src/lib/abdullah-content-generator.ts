/**
 * Abdullah Personal Brand Content Generator
 * Generates daily personal brand videos (Mindset, Business, Money, Freedom, Story)
 */

export interface AbdullahVideo {
  theme: string;
  script: string;
  title: string;
  caption: string;
  hook: string;
}

export interface AbdullahDailyContent {
  date: Date;
  videos: AbdullahVideo[];
}

export interface AbdullahVideoScript {
  theme: 'mindset' | 'business' | 'money' | 'freedom' | 'story';
  script: string;
  title: string;
  caption: string;
  hook: string;
}

/**
 * Generate single Abdullah video script for a specific theme
 */
export async function generateSingleAbdullahScript(
  theme: 'mindset' | 'business' | 'money' | 'freedom' | 'story',
  openaiApiKey?: string
): Promise<AbdullahVideoScript> {
  const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const themePrompts = {
    mindset: {
      description: 'morning motivation',
      postTime: '9:00 AM',
      focus: 'Morning energy, positive thinking, setting intentions, overcoming self-doubt',
      target: 'People starting their day who need motivation'
    },
    business: {
      description: 'entrepreneurship insights',
      postTime: '12:00 PM',
      focus: 'Deals, sales, entrepreneurship, hustle, business strategy, client acquisition',
      target: 'Entrepreneurs during lunch break consuming content'
    },
    money: {
      description: 'financial wisdom',
      postTime: '3:00 PM',
      focus: 'Wealth building, financial mindset, breaking poverty thinking, investments',
      target: 'People thinking about wealth during afternoon'
    },
    freedom: {
      description: 'lifestyle freedom',
      postTime: '6:00 PM',
      focus: 'Time freedom, location independence, living on your terms, breaking the 9-5',
      target: 'People ending work day dreaming of freedom'
    },
    story: {
      description: 'personal reflection',
      postTime: '9:00 PM',
      focus: 'Personal experience, lesson learned, vulnerability, wins and losses',
      target: 'People winding down seeking inspiration'
    }
  };

  const config = themePrompts[theme];

  const systemPrompt = `You are a personal brand content creator for Abdullah, a successful entrepreneur who shares daily motivation and business wisdom on social media.

ABDULLAH'S VOICE:
- Real talk, no BS
- Vulnerable but confident
- Shares both wins and losses
- Focuses on action over theory
- Hustler mentality but values freedom
- Money-focused but purpose-driven

SCRIPT REQUIREMENTS:
- Length: 40-60 words (reads in 30-45 seconds)
- First-person perspective (speak as Abdullah)
- Start with a STRONG hook (first 3 seconds crucial)
- Include call-to-action or question at end
- Authentic, conversational tone
- NO hashtags or emojis in script (those go in caption)
- Must be valuable, not just motivational fluff

HOOK FORMULAS:
- Shocking: "I made $50k this month doing absolutely nothing..."
- Contrarian: "Everyone tells you to save money. That's terrible advice."
- Story: "Five years ago I was broke. Today I..."
- Question: "Want to know the #1 mistake keeping you poor?"
- Pattern interrupt: "Stop trading time for money. Here's why..."`;

  const userPrompt = `Generate ONE video script for Abdullah's ${config.description} content.

Theme: ${theme.toUpperCase()}
Posting Time: ${config.postTime}
Target Audience: ${config.target}
Content Focus: ${config.focus}

Return ONLY a JSON object with this EXACT format:
{
  "script": "40-60 word script here",
  "title": "3-5 word catchy title",
  "caption": "Instagram/TikTok caption with 2-3 emojis and engagement question at end",
  "hook": "First sentence of the script"
}

Make it unique, valuable, and optimized for short-form video virality.`;

  console.log(`🤖 Calling OpenAI for ${theme} script...`);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  console.log(`✅ OpenAI response received`);

  // Parse JSON response
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse OpenAI response:', content);
    throw new Error('OpenAI returned invalid JSON');
  }

  return {
    theme,
    script: parsed.script,
    title: parsed.title,
    caption: parsed.caption,
    hook: parsed.hook || parsed.script.split('.')[0]
  };
}

/**
 * Generate Abdullah's 5 daily videos
 */
export async function generateAbdullahDailyContent(
  openaiApiKey: string,
  date: Date = new Date()
): Promise<AbdullahDailyContent> {
  const themes: Array<'mindset' | 'business' | 'money' | 'freedom' | 'story'> =
    ['mindset', 'business', 'money', 'freedom', 'story'];

  const videos: AbdullahVideo[] = [];

  for (const theme of themes) {
    const video = await generateSingleAbdullahScript(theme, openaiApiKey);
    videos.push(video);
  }

  return {
    date,
    videos,
  };
}

/**
 * Validate Abdullah script
 */
export function validateAbdullahScript(video: AbdullahVideo): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!video.script || video.script.length < 40) {
    errors.push('Script too short (min 40 characters)');
  }

  if (video.script && video.script.length > 500) {
    errors.push('Script too long (max 500 characters)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Build HeyGen video request for Abdullah video
 */
export function buildAbdullahVideoRequest(
  video: AbdullahVideoScript | AbdullahVideo,
  callbackId?: string
): any {
  return {
    video_inputs: [{
      character: {
        type: 'talking_photo',
        talking_photo_id: 'd33fe3abc2914faa88309c3bdb9f47f4', // Abdullah avatar
        scale: 1.4,  // Proper scale for vertical 9:16 social media videos
        talking_style: 'expressive'
      },
      voice: {
        type: 'text',
        input_text: video.script,
        voice_id: '9070a6c2dbd54c10bb111dc8c655bff7', // Original voice
        speed: 1.1,
      }
    }],
    caption: false,
    dimension: { width: 1080, height: 1920 },
    test: false,
    callback_id: callbackId,
  };
}

export default {
  generateAbdullahDailyContent,
  generateSingleAbdullahScript,
  validateAbdullahScript,
  buildAbdullahVideoRequest,
};
