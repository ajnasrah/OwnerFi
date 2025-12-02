/**
 * Gaza Video Generator
 * Generates HeyGen avatar videos for Gaza humanitarian news
 * Features:
 * - Pro-Gaza/Palestine focused news content
 * - Sad/dramatic emotional tone
 * - Article screenshot backgrounds
 * - Donation CTA in every video
 * - Multi-agent round-robin support
 */

import { circuitBreakers, fetchWithTimeout, TIMEOUTS } from '@/lib/api-utils';
import { getBrandWebhookUrl } from '@/lib/brand-utils';
import { selectAgent, AgentSelectionOptions } from './agent-selector';
import {
  HeyGenAgent,
  buildCharacterConfig,
  buildVoiceConfig,
  getPrimaryAgentForBrand,
} from '@/config/heygen-agents';
import { Article } from '@/lib/feed-store-firestore';

const HEYGEN_API_URL = 'https://api.heygen.com/v2/video/generate';

// Default dark/somber background color for Gaza content
const DEFAULT_BACKGROUND_COLOR = '#1a1a2e'; // Dark blue-black for serious news

// Donation URL placeholder - will be set via environment variable
const DONATION_URL = process.env.GAZA_DONATION_URL || 'link in bio';

interface HeyGenVideoResponse {
  error?: any;
  data?: {
    video_id: string;
  };
}

export interface GazaArticle {
  id: string;
  title: string;
  content: string;
  description?: string;
  link: string;
  imageUrl?: string; // Article image for background
  pubDate?: number;
  source?: string;
}

export class GazaVideoGenerator {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('HeyGen API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Validate script meets minimum requirements
   */
  private validateScript(script: string): { valid: boolean; reason?: string } {
    if (!script || script.trim().length === 0) {
      return { valid: false, reason: 'Script is empty' };
    }

    const wordCount = script.trim().split(/\s+/).length;
    if (wordCount < 15) {
      return { valid: false, reason: `Script too short (${wordCount} words, need at least 15)` };
    }

    if (wordCount > 150) {
      return { valid: false, reason: `Script too long (${wordCount} words, max 150)` };
    }

    // Check for common failure patterns
    if (script.includes('undefined') || script.includes('null')) {
      return { valid: false, reason: 'Script contains invalid placeholders' };
    }

    return { valid: true };
  }

  /**
   * Generate AI video script using OpenAI
   * Focused on sad/dramatic humanitarian news tone
   */
  private async generateScript(article: GazaArticle): Promise<string> {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      console.warn('⚠️  No OPENAI_API_KEY - using fallback script');
      return this.createFallbackScript(article);
    }

    const maxRetries = 3;
    let retryCount = 0;

    // Daily emotional themes for variety
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];

    const dailyThemes = {
      'Monday': { theme: 'Breaking News', emotion: 'Urgency / Concern' },
      'Tuesday': { theme: 'Human Stories', emotion: 'Sadness / Empathy' },
      'Wednesday': { theme: 'Humanitarian Crisis', emotion: 'Grief / Despair' },
      'Thursday': { theme: 'Aid & Relief', emotion: 'Hope / Determination' },
      'Friday': { theme: 'Voices from Gaza', emotion: 'Compassion / Solidarity' },
      'Saturday': { theme: 'World Response', emotion: 'Frustration / Hope' },
      'Sunday': { theme: 'Call to Action', emotion: 'Heartbreak / Urgency' }
    };

    const todayTheme = dailyThemes[today as keyof typeof dailyThemes];

    // Donation CTA pool
    const ctaPool = [
      `Help families in Gaza. Donate through ${DONATION_URL}.`,
      `Every donation saves lives. Help Gaza at ${DONATION_URL}.`,
      `Stand with Gaza. Donate now at ${DONATION_URL}.`,
      `Your support matters. Help families in Gaza at ${DONATION_URL}.`,
      `Together we can help. Donate to Gaza relief at ${DONATION_URL}.`,
    ];

    const randomCTA = ctaPool[Math.floor(Math.random() * ctaPool.length)];

    const prompt = `SYSTEM ROLE:
You are creating a short-form news video script about the Gaza humanitarian crisis.

TONE: Somber, empathetic, urgent but respectful. NEVER sensationalize suffering.
EMOTION TODAY: ${todayTheme.emotion}
THEME: ${todayTheme.theme}

TARGET AUDIENCE: People who support Gaza and Palestine, humanitarian donors, activists

ARTICLE TO COVER:
Title: ${article.title}
Content: ${article.content?.substring(0, 1500) || article.description || ''}
Source: ${article.source || 'News source'}

STRUCTURE:
1. HOOK (3-5 seconds): Urgent headline grabber with ${todayTheme.emotion.toLowerCase()}
2. STORY (15-20 seconds): Human-focused facts from the article
3. IMPACT (5-7 seconds): Why this matters, scale of crisis
4. CTA (5 seconds): "${randomCTA}"

LENGTH: 30 seconds max (~90 words)

VOICE STYLE:
- Serious newscast narrator - caring but factual
- Somber and respectful - never exploit suffering
- Empathetic and compassionate
- Urgent without being sensational
- Focus on human impact and the need for aid
- Every word should move viewers to want to help

STRUCTURE YOUR SCRIPT:
[Hook - urgent attention grabber based on ${todayTheme.emotion.toLowerCase()}]
[Main story - human-focused news coverage]
[Impact - why viewers should care]
[CTA - always end with donation call to action]

🚫 BANNED:
- Sensationalizing death or suffering
- Graphic descriptions of violence
- Political blame without humanitarian focus
- Clickbait or exaggerated claims
- Anything that dehumanizes anyone

✅ REQUIRED:
- Focus on humanitarian impact
- Respectful tone for those suffering
- Clear call to action for donations
- Factual reporting from the article
- End with: "${randomCTA}"

OUTPUT:
Return ONLY the script text - no labels, brackets, or formatting. Just the spoken words.`;

    while (retryCount < maxRetries) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a news script writer for Gaza humanitarian crisis coverage. Your mission is to generate emotionally resonant, urgent video scripts that move viewers to help Gaza. Voice: Serious newscast narrator - empathetic, respectful, urgent. Never sensationalize suffering. Focus on human impact and the need for humanitarian aid.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 300
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ OpenAI API error:', errorText);
          throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const script = data.choices[0]?.message?.content?.trim();

        if (!script) {
          throw new Error('OpenAI returned empty script');
        }

        // Validate the generated script
        const validation = this.validateScript(script);
        if (!validation.valid) {
          throw new Error(`Invalid script: ${validation.reason}`);
        }

        console.log(`✅ Generated Gaza script (${today} - ${todayTheme.theme}):`);
        console.log(`   🎭 Emotion: ${todayTheme.emotion}`);
        console.log(`   📝 Script: ${script.substring(0, 100)}...`);
        console.log(`   📊 Word count: ${script.split(/\s+/).length} words`);

        return script;

      } catch (error) {
        retryCount++;
        console.error(`⚠️  Attempt ${retryCount}/${maxRetries} failed:`, error);

        if (retryCount >= maxRetries) {
          console.warn('⚠️  Using fallback script after all retries failed');
          return this.createFallbackScript(article);
        }
      }
    }

    return this.createFallbackScript(article);
  }

  /**
   * Create a fallback script if OpenAI fails
   */
  private createFallbackScript(article: GazaArticle): string {
    return `Breaking news from Gaza. ${article.title}. The humanitarian crisis continues as civilians desperately need aid. Families are struggling to survive. Your support can make a difference. Help families in Gaza. Donate through ${DONATION_URL}.`;
  }

  /**
   * Validate HeyGen request before sending
   */
  private validateHeyGenRequest(request: any): { valid: boolean; reason?: string } {
    if (!request.video_inputs || !Array.isArray(request.video_inputs)) {
      return { valid: false, reason: 'video_inputs is not an array' };
    }

    if (request.video_inputs.length === 0) {
      return { valid: false, reason: 'video_inputs array is empty' };
    }

    const scene = request.video_inputs[0];

    if (!scene.character?.talking_photo_id && !scene.character?.avatar_id) {
      return { valid: false, reason: 'Missing talking_photo_id or avatar_id' };
    }

    if (!scene.voice?.input_text || scene.voice.input_text.trim().length === 0) {
      return { valid: false, reason: 'Missing or empty input_text' };
    }

    if (!scene.voice?.voice_id) {
      return { valid: false, reason: 'Missing voice_id' };
    }

    return { valid: true };
  }

  /**
   * Generate Gaza news video via HeyGen API
   * Uses round-robin agent selection for variety
   *
   * @param article - The article to generate video for
   * @param workflowId - Workflow ID for tracking
   * @param backgroundImageUrl - Optional article screenshot URL for background
   * @param agentOptions - Optional agent selection preferences
   */
  async generateVideo(
    article: GazaArticle,
    workflowId: string,
    backgroundImageUrl?: string,
    agentOptions?: AgentSelectionOptions
  ): Promise<{ videoId: string; agentId: string; script: string }> {
    console.log(`\n📹 Generating Gaza news video: ${article.title}`);
    console.log(`   Workflow ID: ${workflowId}`);

    // Generate script with validation
    const script = await this.generateScript(article);
    console.log(`   ✅ Script generated and validated`);

    // Select agent for this video (uses round-robin by default)
    const agent = await selectAgent('gaza', {
      mode: agentOptions?.mode || 'round-robin',
      language: 'en',
      ...agentOptions,
    });

    if (!agent) {
      throw new Error('No active Gaza agents available');
    }

    console.log(`   🤖 Selected agent: ${agent.name} (${agent.id})`);
    console.log(`   🎭 Avatar: ${agent.avatar.avatarId.substring(0, 20)}...`);
    console.log(`   🗣️  Voice: ${agent.voice.voiceId.substring(0, 12)}...`);
    if (agent.voice.emotion) {
      console.log(`   😔 Emotion: ${agent.voice.emotion}`);
    }

    // Build character config from agent
    const characterConfig = buildCharacterConfig(agent, 'vertical');

    // Build voice config with script
    const voiceConfig = buildVoiceConfig(agent, script);

    // Build background config - use article image if available, otherwise dark color
    const backgroundConfig = backgroundImageUrl
      ? {
          type: 'image',
          url: backgroundImageUrl,
          fit: 'cover' as const,
        }
      : {
          type: 'color',
          value: DEFAULT_BACKGROUND_COLOR,
        };

    // Get webhook URL for Gaza
    const webhookUrl = getBrandWebhookUrl('gaza', 'heygen');

    // Build complete request
    const request = {
      video_inputs: [{
        character: characterConfig,
        voice: voiceConfig,
        background: backgroundConfig,
      }],
      dimension: {
        width: 1080,
        height: 1920 // Vertical for social media
      },
      callback_id: workflowId,
      callback_url: webhookUrl,
    };

    // Validate request
    const validation = this.validateHeyGenRequest(request);
    if (!validation.valid) {
      throw new Error(`Invalid HeyGen request: ${validation.reason}`);
    }

    console.log(`   📤 Sending to HeyGen API...`);
    console.log(`   🎬 Background: ${backgroundImageUrl ? 'Article image' : 'Dark color'}`);
    console.log(`   📱 Dimensions: 1080x1920 (vertical)`);
    console.log(`   🔔 Webhook: ${webhookUrl}`);

    // Send to HeyGen API
    const response = await circuitBreakers.heygen.execute(async () => {
      return await fetchWithTimeout(
        HEYGEN_API_URL,
        {
          method: 'POST',
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        },
        TIMEOUTS.HEYGEN_API
      );
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HeyGen API error response:', errorText);
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
    }

    const result: HeyGenVideoResponse = await response.json();

    if (result.error) {
      console.error('❌ HeyGen API returned error:', result.error);
      throw new Error(`HeyGen error: ${JSON.stringify(result.error)}`);
    }

    const videoId = result.data?.video_id;
    if (!videoId) {
      throw new Error('HeyGen response missing video_id');
    }

    console.log(`   ✅ HeyGen video created: ${videoId}`);
    console.log(`   ⏳ Video will be generated and callback sent to webhook`);

    return { videoId, agentId: agent.id, script };
  }

  /**
   * Generate caption for social media post
   */
  generateCaption(article: GazaArticle, hashtags?: string[]): string {
    const defaultHashtags = ['#Gaza', '#Palestine', '#HumanitarianCrisis', '#FreePalestine', '#GazaRelief'];
    const tags = hashtags || defaultHashtags;

    // Truncate title if too long
    const title = article.title.length > 100
      ? article.title.substring(0, 97) + '...'
      : article.title;

    return `${title}

Help families in Gaza: ${DONATION_URL}

${tags.join(' ')}`;
  }
}

/**
 * Create a new GazaVideoGenerator instance
 */
export function createGazaVideoGenerator(): GazaVideoGenerator {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    throw new Error('HEYGEN_API_KEY environment variable is required');
  }
  return new GazaVideoGenerator(apiKey);
}

export default GazaVideoGenerator;
