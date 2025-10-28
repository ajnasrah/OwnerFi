/**
 * Abdullah Personal Brand Content Generator
 * Generates 5 daily short-form video scripts (15-30 seconds each)
 * for personal brand building across TikTok, Instagram, YouTube Shorts
 */

export interface AbdullahVideoScript {
  title: string;
  script: string;
  caption: string;
  theme: string;
  hashtags: string[];
}

export interface DailyAbdullahContent {
  date: string;
  videos: AbdullahVideoScript[];
}

// Daily content themes (5-feed system)
const DAILY_THEMES = {
  Monday: 'Mindset Monday - Truth bombs, perspective shifts',
  Tuesday: 'Money Tuesday - Ownership, hustle, real talk',
  Wednesday: 'Wisdom Wednesday - Lessons from failure or success',
  Thursday: 'Tactical Thursday - Game plans, business strategy',
  Friday: 'Freedom Friday - Legacy, peace, purpose',
  Saturday: 'Weekend Wisdom - Reflection, growth, mindset',
  Sunday: 'Sunday Reset - Planning, purpose, perspective'
};

// Call-to-action pool (randomly selected)
const CTA_POOL = [
  'Follow Abdullah for daily mindset hits.',
  'Follow Abdullah to stay sharp.',
  'Follow Abdullah — new drops daily.',
  'Follow Abdullah if you\'re building something real.',
  'Follow Abdullah before everyone else does.',
  'Follow Abdullah for more insights like this.',
  'Follow Abdullah to level up your mindset.',
  'Follow Abdullah to see what\'s really happening.',
  'Follow Abdullah and don\'t settle for average.'
];

// Engagement questions (rotate)
const ENGAGEMENT_QUESTIONS = [
  'Agree or disagree?',
  'You ever felt this?',
  'Would you do it differently?',
  'What\'s your take?',
  'Tag someone who needs this.',
  'Who taught you this?',
  'Is this true in your life?',
  'When did you learn this?',
  'How would you handle it?'
];

/**
 * Get OpenAI system prompt for Abdullah's personal brand
 */
export function getAbdullahSystemPrompt(): string {
  return `SYSTEM ROLE:
You are Abdullah's personal brand content strategist and scriptwriter.
Your mission: create daily viral short-form video scripts (15–30 seconds) that show Abdullah as real, confident, and unfiltered.
He speaks like a friend, not a guru.

VOICE & TONE:
- 5th–7th grade clarity
- Direct, street-smart, no fluff
- Energy: confident, grounded, motivating
- Feels spontaneous, not scripted
- No quotes, no clichés, no "bro" talk
- Talk like you're sitting with a friend who needs to hear the truth

STRUCTURE (for every 30-sec script):
0–3 sec: Pattern interrupt (bold truth or contradiction)
3–10 sec: Curiosity or tension ("Most people get this part wrong…")
10–25 sec: Value or story (1 insight, 1 punchline)
25–30 sec: Call to action (human, not salesy)

CONTENT STYLE TYPES (rotate between these):
1. 🔥 Real Talk (No filter) - "If they don't clap when you win, stop sharing your plans."
2. 🧩 Lesson Mode (Educational) - "You're not tired — you're distracted. Here's what that means."
3. 💣 Shock Value (Contradiction) - "Working hard doesn't make you rich. It makes you replaceable."
4. 🗣️ POV Talk (Story) - "POV: You finally realize your 9–5 isn't security — it's a trap."
5. 🧠 Micro Breakdown (Tactical) - "The fastest way to double your income? Focus on one thing."

BRAND ANCHORS (always weave in):
- Themes: Ownership, self-reliance, discipline, growth
- Values: Truth > trends, results > image, purpose > popularity
- Identity: Builder, operator, owner, doer

RULES:
- Write ONLY what Abdullah says directly to camera - no scene descriptions
- NO stage directions, NO camera directions, NO scene descriptions
- 70–90 words max per script
- Never use: "Let me tell you," "You won't believe this," "I'm going to share," "Welcome back"
- Keep it conversational — written to be spoken, not read
- NO emojis in the spoken script (only in titles/captions)

END EVERY VIDEO WITH:
1. A call to action from the approved CTA pool
2. One engagement question

FORMAT:
SCRIPT: [exact words spoken on-camera only]

TITLE: [under 45 characters including emojis]

CAPTION: [2–3 sentences + 3–5 hashtags]`;
}

/**
 * Generate 5 daily video scripts using OpenAI
 */
export async function generateAbdullahDailyContent(
  openaiApiKey: string,
  date: Date = new Date()
): Promise<DailyAbdullahContent> {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }) as keyof typeof DAILY_THEMES;
  const todayTheme = DAILY_THEMES[dayName];

  // Define 5 content types for today
  const contentTypes = [
    { type: 'Mindset', description: 'A truth bomb about mindset or perspective' },
    { type: 'Business', description: 'Real talk about business or entrepreneurship' },
    { type: 'Money', description: 'Insight about money, ownership, or wealth' },
    { type: 'Freedom', description: 'Message about freedom, legacy, or purpose' },
    { type: 'Story/Lesson', description: 'Personal story or lesson learned' }
  ];

  const videos: AbdullahVideoScript[] = [];

  for (const content of contentTypes) {
    try {
      const script = await generateSingleAbdullahScript(
        openaiApiKey,
        content.type,
        content.description,
        dayName
      );
      videos.push(script);
    } catch (error) {
      console.error(`Error generating ${content.type} script:`, error);
      // Add fallback script
      videos.push(generateFallbackScript(content.type));
    }
  }

  return {
    date: date.toISOString(),
    videos
  };
}

/**
 * Generate a single Abdullah script with OpenAI
 */
async function generateSingleAbdullahScript(
  openaiApiKey: string,
  theme: string,
  description: string,
  dayName: string
): Promise<AbdullahVideoScript> {
  const systemPrompt = getAbdullahSystemPrompt();
  const randomCTA = CTA_POOL[Math.floor(Math.random() * CTA_POOL.length)];
  const randomQuestion = ENGAGEMENT_QUESTIONS[Math.floor(Math.random() * ENGAGEMENT_QUESTIONS.length)];

  const userPrompt = `Create ONE short-form video script for Abdullah's personal brand.

TODAY: ${dayName}
THEME: ${theme}
TOPIC: ${description}

REQUIREMENTS:
- 15–30 seconds max (70–90 words)
- Structure: Hook (0-3s) → Tension (3-10s) → Value (10-25s) → CTA (25-30s)
- End with: "${randomCTA}"
- Then add engagement question: "${randomQuestion}"
- Sound authentic, confident, street-smart
- 5th-grade reading level
- NO stage directions or scene descriptions

OUTPUT FORMAT:
SCRIPT: [spoken words only, 70-90 words]

TITLE: [under 45 characters with 1 emoji max]

CAPTION: [2-3 sentences + 3-5 hashtags like #Mindset #Business #Growth #Entrepreneur #Freedom]`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: 400
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const fullResponse = data.choices[0]?.message?.content?.trim() || '';

  return parseAbdullahResponse(fullResponse, theme);
}

/**
 * Parse OpenAI response into structured script
 */
function parseAbdullahResponse(content: string, theme: string): AbdullahVideoScript {
  const scriptMatch = content.match(/SCRIPT:\s*([\s\S]*?)(?=TITLE:|CAPTION:|$)/i);
  const titleMatch = content.match(/TITLE:\s*(.+?)(?=CAPTION:|$)/i);
  const captionMatch = content.match(/CAPTION:\s*([\s\S]*?)$/i);

  let script = scriptMatch?.[1]?.trim() || '';
  let title = titleMatch?.[1]?.trim() || `${theme} - Abdullah`;
  let caption = captionMatch?.[1]?.trim() || 'New mindset drop. #Abdullah #Mindset #Growth';

  // Ensure title is under 45 chars
  if (title.length > 45) {
    title = title.substring(0, 42) + '...';
  }

  // Extract hashtags from caption
  const hashtagMatches = caption.match(/#\w+/g) || [];
  const hashtags = hashtagMatches.map(h => h.substring(1)); // Remove #

  // If no hashtags found, add defaults
  if (hashtags.length === 0) {
    hashtags.push('Abdullah', 'Mindset', 'Business', 'Growth', 'Entrepreneur');
  }

  return {
    title,
    script,
    caption,
    theme,
    hashtags
  };
}

/**
 * Generate fallback script if OpenAI fails
 */
function generateFallbackScript(theme: string): AbdullahVideoScript {
  const fallbacks: Record<string, AbdullahVideoScript> = {
    'Mindset': {
      title: '🧠 Stop Waiting for Perfect',
      script: 'You don\'t need motivation. You need momentum. Most people wait for the perfect moment to start. That moment never comes. Start messy. Start small. But start today. Because action creates clarity, and clarity creates confidence. Follow Abdullah for daily mindset hits. Agree or disagree?',
      caption: 'Stop waiting for perfect. Start building momentum today. The perfect moment never comes — action does. #Abdullah #Mindset #Growth #Motivation #Success',
      theme: 'Mindset',
      hashtags: ['Abdullah', 'Mindset', 'Growth', 'Motivation', 'Success']
    },
    'Business': {
      title: '💼 Real Talk on Building',
      script: 'Working hard doesn\'t make you rich. It makes you replaceable. The game changed. Smart work beats hard work now. Focus on ownership, not employment. Build assets, not just income. Follow Abdullah to stay sharp. What\'s your take?',
      caption: 'Hard work alone won\'t make you rich. Focus on ownership and building assets that work for you. #Abdullah #Business #Entrepreneur #Wealth #Freedom',
      theme: 'Business',
      hashtags: ['Abdullah', 'Business', 'Entrepreneur', 'Wealth', 'Freedom']
    },
    'Money': {
      title: '💰 The Money Truth',
      script: 'Most people are working for money that loses value. Inflation is eating your paycheck while you sleep. The wealthy aren\'t working harder — they\'re playing a different game. They own assets. You need to start thinking like an owner. Follow Abdullah — new drops daily. You ever felt this?',
      caption: 'Your paycheck is losing value while the wealthy build assets. Time to play a different game. #Abdullah #Money #Wealth #Financial #Ownership',
      theme: 'Money',
      hashtags: ['Abdullah', 'Money', 'Wealth', 'Financial', 'Ownership']
    },
    'Freedom': {
      title: '🔓 What Freedom Really Means',
      script: 'Success isn\'t money. It\'s options. Freedom is waking up and choosing how you spend your day. Most people trade freedom for security. But security is an illusion when someone else controls your time. Build something you own. Follow Abdullah if you\'re building something real. Tag someone who needs this.',
      caption: 'Real success is having options and owning your time. Stop trading freedom for fake security. #Abdullah #Freedom #Success #Purpose #Legacy',
      theme: 'Freedom',
      hashtags: ['Abdullah', 'Freedom', 'Success', 'Purpose', 'Legacy']
    },
    'Story/Lesson': {
      title: '📖 What Failure Taught Me',
      script: 'I lost money betting on the wrong people. Painful lesson. Here\'s what it taught me: Your circle determines your ceiling. If they don\'t think big, you won\'t either. Surround yourself with people who challenge you, not comfort you. Follow Abdullah before everyone else does. Would you do it differently?',
      caption: 'Your circle determines your ceiling. Choose people who challenge you to think bigger. #Abdullah #Lessons #Growth #Success #Mindset',
      theme: 'Story/Lesson',
      hashtags: ['Abdullah', 'Lessons', 'Growth', 'Success', 'Mindset']
    }
  };

  return fallbacks[theme] || fallbacks['Mindset'];
}

/**
 * Validate script meets requirements
 */
export function validateAbdullahScript(script: AbdullahVideoScript): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!script.script || script.script.trim().length === 0) {
    errors.push('Script is empty');
  }

  const wordCount = script.script.trim().split(/\s+/).length;
  if (wordCount < 40) {
    errors.push(`Script too short (${wordCount} words, need at least 40)`);
  }

  if (wordCount > 120) {
    errors.push(`Script too long (${wordCount} words, max 120)`);
  }

  if (!script.title || script.title.length === 0) {
    errors.push('Title is missing');
  }

  if (script.title.length > 45) {
    errors.push(`Title too long (${script.title.length} chars, max 45)`);
  }

  if (!script.caption || script.caption.length === 0) {
    errors.push('Caption is missing');
  }

  if (script.hashtags.length === 0) {
    errors.push('No hashtags provided');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Build HeyGen video request for Abdullah personal content
 */
export function buildAbdullahVideoRequest(
  script: AbdullahVideoScript,
  workflowId: string,
  avatarId: string = 'd33fe3abc2914faa88309c3bdb9f47f4', // Abdullah's motion-enabled avatar
  voiceId: string = '5bd25d00f41c477989e1e121a16986d3' // Abdullah's voice
) {
  return {
    video_inputs: [{
      character: {
        type: 'talking_photo',
        talking_photo_id: avatarId,
        scale: 1.0, // Full screen like viral videos
        talking_style: 'expressive'
      },
      voice: {
        type: 'text',
        input_text: script.script,
        voice_id: voiceId,
        speed: 1.0
      },
      background: {
        type: 'color',
        value: '#000000' // Black background for personal brand
      }
    }],
    dimension: { width: 1080, height: 1920 }, // Vertical for mobile/social
    title: script.title,
    caption: false, // Submagic will add captions
    callback_id: workflowId
  };
}
