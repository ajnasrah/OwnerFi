/**
 * Abdullah Personal Brand Content Generator
 * Generates daily personal brand videos (Mindset, Business, Money, Freedom, Story)
 * NOW WITH COMPLIANCE CHECKING - validates marketing laws before video creation
 * NOW WITH MULTI-AGENT SUPPORT - uses agent pool for variety
 */

import { validateAndFixScript } from './compliance-checker';
import { selectAgent, AgentSelectionOptions } from './agent-selector';
import {
  buildCharacterConfig,
  buildVoiceConfig,
  buildBackgroundConfig,
} from '@/config/heygen-agents';

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

  // OPTIMIZED BASED ON YOUTUBE ANALYTICS - "Deal Mastery" video (1,374 views, 10x avg)
  // Best performing times: 8PM (358 avg), 3PM (340 avg), 12PM (325 avg)
  // Top content: Business/Deals, Financial wisdom, Entrepreneurship
  const themePrompts = {
    mindset: {
      description: 'morning motivation',
      postTime: '12:00 PM', // Moved to 12PM (3rd best slot)
      focus: 'Morning energy, crushing self-doubt, taking action TODAY, winning mentality',
      target: 'Entrepreneurs ready to take action'
    },
    business: {
      description: 'deal mastery & entrepreneurship', // HIGHEST PERFORMING THEME
      postTime: '8:00 PM', // BEST PERFORMING TIME SLOT
      focus: 'Closing deals, landing big clients, showcasing value, negotiation tactics, deal-making secrets',
      target: 'Ambitious entrepreneurs seeking to level up their deal-making skills'
    },
    money: {
      description: 'financial wisdom',
      postTime: '3:00 PM', // 2nd best slot
      focus: 'Building wealth, smart money moves, breaking limiting beliefs about money, investment mindset',
      target: 'People looking to transform their financial future'
    },
    freedom: {
      description: 'lifestyle freedom',
      postTime: '8:00 PM', // Moved to best slot
      focus: 'Escaping the 9-5, building income streams, living on your terms, time freedom',
      target: 'People dreaming of escaping the rat race'
    },
    story: {
      description: 'deal stories & lessons learned',
      postTime: '8:00 PM', // Moved to best slot
      focus: 'Real deal experiences, lessons from wins and losses, behind-the-scenes of big deals',
      target: 'People seeking real entrepreneurship stories'
    }
  };

  const config = themePrompts[theme];

  // OPTIMIZED PROMPT based on viral "Deal Mastery" video (1,374 views, 10x average)
  const systemPrompt = `You are a personal brand content creator for Abdullah, a successful entrepreneur who shares deal-making secrets and business wisdom on social media.

ABDULLAH'S VOICE:
- Real talk, no BS - speaks like a friend giving advice
- Confident deal-maker who closes big deals
- Shares real tactics, not generic motivation
- Action-focused: "Here's exactly what to do..."
- Money-focused but purpose-driven
- Speaks to ambitious entrepreneurs who want MORE

SCRIPT REQUIREMENTS (CRITICAL FOR VIRALITY):
- Length: 35-50 words (reads in 20-30 seconds) - concise but complete thought
- First-person perspective (speak as Abdullah)
- Start with a CURIOSITY HOOK (first 2-3 seconds crucial)
- End with a thought-provoking question OR clear takeaway
- Conversational, punchy sentences - NOT motivational fluff
- NO hashtags or emojis in script (those go in caption)
- Must deliver ONE specific valuable insight or tactic

TOP PERFORMING HOOK FORMULAS (USE THESE):
- Curiosity: "Unlock the secrets to landing big deals..."
- Deal Mastery: "Here's how I close deals others can't..."
- Value Reveal: "The #1 thing separating 6-figure deals from small ones..."
- Contrarian: "Everyone's chasing clients. I let them come to me..."
- Story Tease: "This one deal changed everything..."
- Question: "How do you showcase YOUR business's value?"

CONTENT THEMES THAT PERFORM BEST:
- Deal-making and closing tactics
- Showcasing value to clients
- Business growth strategies
- Entrepreneurship insights
- Financial wisdom and wealth building`;

  const userPrompt = `Generate ONE video script for Abdullah's ${config.description} content.

Theme: ${theme.toUpperCase()}
Target Audience: ${config.target}
Content Focus: ${config.focus}

Return ONLY a JSON object with this EXACT format:
{
  "script": "35-50 word script - deliver ONE valuable insight with a punchy hook and strong ending",
  "title": "2-3 word punchy title (like 'Deal Mastery' or 'Close More')",
  "caption": "Curiosity-driven caption (like 'Unlock the secrets to...') with 2 emojis, engagement question at end, then these hashtags: #Entrepreneurship #BusinessGrowth #DealMaking #Success",
  "hook": "First sentence of the script (this is the MOST important part)"
}

EXAMPLES OF WINNING TITLES: "Deal Mastery", "Close More", "Value First", "Money Moves"
EXAMPLE CAPTION FORMAT: "Unlock the secrets to landing big deals 📈💼 How do you showcase your business's value? #Entrepreneurship #BusinessGrowth"

Make it punchy, valuable, and between 35-50 words. Deliver ONE clear insight.`;

  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    // Add compliance warning on retries
    const complianceWarning = retryCount > 0
      ? `\n\n🚨 COMPLIANCE RETRY ${retryCount}/${maxRetries} - PREVIOUS ATTEMPT VIOLATED MARKETING LAWS\nYour last script violated compliance. CRITICAL FIXES NEEDED:\n- NO directive language (should/must/need to) - use "might/could/consider"\n- NO financial guarantees (guaranteed returns/easy money) - use "possible/may/requires work"\n- NO get-rich-quick language (overnight success/passive income while you sleep)\n- NO investment advice - educational/motivational content only\n- Soft, consultative tone focused on work/effort - not pushy promises\n**If this retry fails, workflow will TERMINATE.**\n`
      : '';

    console.log(`🤖 Calling OpenAI for ${theme} script (attempt ${retryCount + 1}/${maxRetries})...`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt + complianceWarning },
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

    // ==================== COMPLIANCE CHECK ====================
    console.log(`[Compliance] Checking Abdullah ${theme} script (attempt ${retryCount + 1}/${maxRetries})`);

    const complianceResult = await validateAndFixScript(
      parsed.script,
      parsed.caption,
      parsed.title,
      'abdullah',
      1 // Single check, we handle retries here
    );

    // If passed compliance
    if (complianceResult.success) {
      console.log(`[Compliance] ✅ Abdullah ${theme} script passed compliance`);

      return {
        theme,
        script: complianceResult.finalScript,
        title: complianceResult.finalTitle,
        caption: complianceResult.finalCaption, // Already has disclaimers appended
        hook: parsed.hook || complianceResult.finalScript.split('.')[0]
      };
    }

    // Failed compliance - retry
    retryCount++;

    const violations = complianceResult.complianceResult.violations
      .map(v => `${v.phrase} (${v.type})`)
      .join(', ');

    console.log(`[Compliance] ❌ Attempt ${retryCount}/${maxRetries} failed: ${violations}`);

    if (retryCount >= maxRetries) {
      throw new Error(
        `Compliance check failed after ${maxRetries} attempts for Abdullah ${theme} content. ` +
        `Violations: ${violations}`
      );
    }

    // Loop will retry with compliance warning added to system prompt
  }

  // Should never reach here
  throw new Error('Unexpected script generation loop exit');
}

/**
 * Generate Abdullah's daily videos
 * @param count - Number of videos to generate (1-5). Defaults to 5 if not specified.
 */
export async function generateAbdullahDailyContent(
  openaiApiKey: string,
  date: Date = new Date(),
  count: number = 5
): Promise<AbdullahDailyContent> {
  const allThemes: Array<'mindset' | 'business' | 'money' | 'freedom' | 'story'> =
    ['mindset', 'business', 'money', 'freedom', 'story'];

  // Validate count and limit to available themes
  const videoCount = Math.max(1, Math.min(count, allThemes.length));
  const themes = allThemes.slice(0, videoCount);

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

  // Updated: Shorter scripts (30-40 words = ~150-250 chars) perform better
  if (!video.script || video.script.length < 100) {
    errors.push('Script too short (min 100 characters)');
  }

  // Shorter is better for retention - max 300 chars (~45 words)
  if (video.script && video.script.length > 300) {
    errors.push('Script too long (max 300 characters for better retention)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Build HeyGen video request for Abdullah video (legacy - uses hardcoded avatar)
 * @deprecated Use buildAbdullahVideoRequestWithAgent instead
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

/**
 * Build HeyGen video request for Abdullah video with agent rotation
 * Uses the agent selector for round-robin agent selection
 */
export async function buildAbdullahVideoRequestWithAgent(
  video: AbdullahVideoScript | AbdullahVideo,
  callbackId: string,
  agentOptions?: AgentSelectionOptions
): Promise<{ request: any; agentId: string }> {
  // Select agent for this video (uses round-robin by default)
  const agent = await selectAgent('abdullah', {
    mode: agentOptions?.mode || 'round-robin',
    language: 'en',
    ...agentOptions,
  });

  // Fallback to legacy if no agent available
  if (!agent) {
    console.warn('⚠️  No agent available for abdullah, using legacy config');
    const request = buildAbdullahVideoRequest(video, callbackId);
    return { request, agentId: 'legacy' };
  }

  console.log(`   🤖 Selected agent: ${agent.name} (${agent.id})`);
  console.log(`   🎭 Avatar: ${agent.avatar.avatarId.substring(0, 12)}...`);
  console.log(`   🗣️  Voice: ${agent.voice.voiceId.substring(0, 12)}...`);
  if (agent.voice.emotion) {
    console.log(`   😊 Emotion: ${agent.voice.emotion}`);
  }

  // Build character config from agent
  const characterConfig = buildCharacterConfig(agent, 'vertical');

  // Build voice config from agent with the script
  const voiceConfig = buildVoiceConfig(agent, video.script);

  // Abdullah videos use brand-specific dark background
  // ALWAYS provide a background to avoid white backgrounds
  const backgroundConfig = buildBackgroundConfig('abdullah');

  // Build request with background (always included to prevent white backgrounds)
  const videoInput: any = {
    character: characterConfig,
    voice: voiceConfig,
    background: backgroundConfig,
  };

  const request = {
    video_inputs: [videoInput],
    caption: false,
    dimension: { width: 1080, height: 1920 },
    test: false,
    callback_id: callbackId,
  };

  return { request, agentId: agent.id };
}

export default {
  generateAbdullahDailyContent,
  generateSingleAbdullahScript,
  validateAbdullahScript,
  buildAbdullahVideoRequest,
  buildAbdullahVideoRequestWithAgent,
};
