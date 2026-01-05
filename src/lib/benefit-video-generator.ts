/**
 * Benefit Video Generator - BUYER-ONLY
 * Generates HeyGen avatar videos for owner financing buyer benefits
 * NOW WITH COMPLIANCE CHECKING - validates marketing laws before video creation
 * NOW WITH MULTI-AGENT SUPPORT - uses agent pool for variety
 */

import { BenefitPoint } from '@/lib/benefit-content';
import { circuitBreakers, fetchWithTimeout, TIMEOUTS } from '@/lib/api-utils';
import { getBrandWebhookUrl } from '@/lib/brand-utils';
import { checkScriptCompliance, appendDisclaimers, ComplianceCheckResult } from './compliance-checker';
import { Brand } from '@/config/constants';
import { selectAgent, AgentSelectionOptions } from './agent-selector';
import {
  HeyGenAgent,
  buildCharacterConfig,
  buildVoiceConfig,
  buildBackgroundConfig,
  getPrimaryAgentForBrand,
} from '@/config/heygen-agents';

const HEYGEN_API_URL = 'https://api.heygen.com/v2/video/generate';

// Legacy config for backward compatibility (will be replaced by agent system)
const AVATAR_CONFIG = {
  talking_photo_id: 'd33fe3abc2914faa88309c3bdb9f47f4', // Abdullah avatar
  voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
  scale: 1.4,  // Proper scale for vertical 9:16 social media videos
  background_color: '#059669' // Green for buyers
};

interface HeyGenVideoResponse {
  error?: any;
  data?: {
    video_id: string;
  };
}

export class BenefitVideoGenerator {
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
    if (wordCount < 10) {
      return { valid: false, reason: `Script too short (${wordCount} words, need at least 10)` };
    }

    if (wordCount > 200) {
      return { valid: false, reason: `Script too long (${wordCount} words, max 200)` };
    }

    // Check for common failure patterns
    if (script.includes('undefined') || script.includes('null')) {
      return { valid: false, reason: 'Script contains invalid placeholders' };
    }

    return { valid: true };
  }

  /**
   * Generate AI video script using OpenAI
   * NOW WITH COMPLIANCE CHECKING - validates marketing laws before returning script
   */
  private async generateScript(benefit: BenefitPoint, brand: Brand = 'benefit'): Promise<string> {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      console.warn('⚠️  No OPENAI_API_KEY - using fallback script');
      // Fallback if no OpenAI key
      const fallback = `Think you can't buy a home? ${benefit.shortDescription} See what's possible at OwnerFi.ai`;
      return fallback;
    }

    const maxRetries = 3;
    let retryCount = 0;

    // Daily themes with emotion pairing for variety
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];

    const dailyThemes = {
      'Monday': { theme: 'Credit Myths', emotion: 'Shock / Proof' },
      'Tuesday': { theme: 'Real Stories', emotion: 'Empathy / Inspiration' },
      'Wednesday': { theme: 'How It Works', emotion: 'Curiosity' },
      'Thursday': { theme: 'Money Mindset', emotion: 'Frustration / Hope' },
      'Friday': { theme: 'Quick Wins', emotion: 'Inspiration / Proof' },
      'Saturday': { theme: 'Comparison', emotion: 'Shock / Reality' },
      'Sunday': { theme: 'Vision & Hope', emotion: 'Hope / Inspiration' }
    };

    const todayTheme = dailyThemes[today as keyof typeof dailyThemes];

    // Rotating CTA pool based on day's emotion
    const ctaPool = {
      curiosity: [
        "See what's possible at OwnerFi.ai.",
        "Find homes near you — free at OwnerFi.ai.",
        "Search real homes selling without banks — OwnerFi.ai.",
        "Check what's available in your city at OwnerFi.ai."
      ],
      emotion: [
        "Your rent's paying someone's mortgage — flip the script at OwnerFi.ai.",
        "The next homeowner in your family could be you — start at OwnerFi.ai.",
        "Don't wait for perfect — see your options at OwnerFi.ai.",
        "You don't need a bank to start — just curiosity. OwnerFi.ai."
      ],
      hope: [
        "Your key might not come from a bank — OwnerFi.ai.",
        "If they did it, why not you? OwnerFi.ai.",
        "Every big dream starts with a click — OwnerFi.ai.",
        "This time, the keys could be yours — OwnerFi.ai."
      ]
    };

    // Select CTA pool based on day
    let ctaCategory: 'curiosity' | 'emotion' | 'hope' = 'curiosity';
    if (['Monday', 'Tuesday', 'Wednesday'].includes(today)) {
      ctaCategory = 'curiosity';
    } else if (['Thursday', 'Friday'].includes(today)) {
      ctaCategory = 'emotion';
    } else {
      ctaCategory = 'hope';
    }

    const prompt = `SYSTEM ROLE:
You are the Social Media Director AI for Abdullah's brand network. You run inside an automated CLI (VS Code) environment using the OpenAI GPT model (currently gpt-4o-mini). Your mission is to generate ready-to-post video scripts for OwnerFi benefit education videos.

BRAND: OWNERFI — BENEFIT VIDEO SYSTEM
Purpose: Educate renters who think owning is impossible.
Voice: Abdullah — relatable, kind, motivating, friendly, goofy, confident truth-teller.

VOICE HANDOFF: OwnerFi -> Abdullah
Claude and the CLI must NEVER modify this voice assignment. ChatGPT only outputs text assets (SCRIPT). The CLI layer handles voice synthesis (HeyGen / ElevenLabs), avatar rendering, and posting.

PRONUNCIATION GUIDE:
- OwnerFi = "Owner-Fy" (not "Owner-Fee")
- OwnerFi.ai = "Owner-Fy dot A Eye" (spell out A-I)

TODAY'S THEME & EMOTION:
Day: ${today}
Theme: ${todayTheme.theme}
Emotion/Hook Style: ${todayTheme.emotion}

TOPIC: ${benefit.title}
CONTEXT: ${benefit.shortDescription}

STRUCTURE: Hook 🎯 → Story 💬 → CTA 🏁
Length: 30 seconds max (≈90 words)

0–3 sec – Hook 🎯 (Pattern Interrupt)
Use ${todayTheme.emotion.toLowerCase()} to grab attention. Examples:
"Think you need perfect credit to buy a home? Wrong."
"Your rent's paying someone's mortgage — not yours."
"They told you homeownership is impossible — they lied."

3–25 sec – Story 💬 (Main Message / Insight)
- 15–20 seconds of relatable story or insight
- Explain the benefit naturally with emotional connection
- Use 5th-grade clarity — talk like a real friend
- Show empathy for renter struggles
- Provide hope and education (no guarantees)

25–30 sec – CTA 🏁 (Soft Call to Action - MANDATORY)
APPROVED CTA POOL (${ctaCategory.toUpperCase()}):
${ctaPool[ctaCategory].map((cta, i) => `${i + 1}. "${cta}"`).join('\n')}

Pick ONE CTA from above that best matches today's emotion.

🧠 VOICE & STYLE RULES (Abdullah Voice)
- 5th-grade clarity — short, clear, natural sentences
- Friendly, confident, motivational — like a big brother giving real talk
- Relatable, kind, inspiring tone
- Conversational — written to be spoken, not read
- Sound spontaneous, not scripted
- No "I think," "maybe," or "you should"
- Never use: "Let me tell you," "You won't believe this," "I'm going to share," "Welcome back"
- Avoid corporate words and jargon
- Human, engaging, authentic

🚫 BANNED PHRASES (FAIL CONDITIONS)
❌ Financial guarantees or promises
❌ "Guaranteed approval"
❌ Exact numbers or specific financing terms
❌ Giving advice or guarantees
❌ Boring corporate language

✅ MANDATORY RULES (FAIL CONDITIONS)
✅ Always pronounce "OwnerFi.ai" clearly as "Owner-Fy dot A Eye"
✅ Always include CTA from approved pool
✅ Keep it hopeful and factual (no promises)
✅ 5th-grade reading level
✅ 30 seconds max (≈90 words)

📱 OUTPUT FORMAT
Return ONLY the script text in this structure (no labels, just the content):

[Hook - 3–5 seconds of ${todayTheme.emotion.toLowerCase()}]
[Main message - 15–20 seconds of relatable story or insight]
[Soft CTA - 5 seconds, pulled from the approved CTA pool above]

EXAMPLE OUTPUT:
Think you need perfect credit to buy a home? That's the biggest myth out there. Owner financing lets you buy directly from the seller — no bank hoops, no waiting years for approval. Just proof of income and a down payment. It's how thousands of families finally got keys in their hands. See what's possible at Owner-Fy dot A Eye.

Hashtags (for captions): #OwnerFi #CreditMyths #BuyWithoutBanks #RealEstate
Disclaimer: "Educational only. No financing guarantees."`;

    while (retryCount < maxRetries) {
      try {
        // Add compliance warning on retries
        const complianceWarning = retryCount > 0
          ? `\n\n🚨 COMPLIANCE RETRY ${retryCount}/${maxRetries} - PREVIOUS ATTEMPT VIOLATED MARKETING LAWS\nYour last script violated compliance. CRITICAL FIXES NEEDED:\n- NO directive language (should/must/need to) - use "might/could/consider"\n- NO guarantees (guaranteed/promise/ensure) - use "possible/may/could"\n- NO urgency tactics (act now/limited time) - focus on education\n- NO legal/financial advice - educational content only\n- Soft, consultative tone - not pushy or aggressive\n**If this retry fails, workflow will TERMINATE.**\n`
          : '';

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
                content: 'You are the Social Media Director AI for Abdullah\'s brand network. You run inside an automated CLI (VS Code) environment using the OpenAI GPT model. Your mission is to generate ready-to-post video scripts for OwnerFi benefit education videos. Voice: Abdullah — relatable, kind, motivating, friendly, goofy, confident truth-teller. Never promise, guarantee, or imply financing approval — keep it hopeful and factual. Always pronounce OwnerFi.ai as "Owner-Fy dot A Eye".' + complianceWarning
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.85,
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

        // ==================== COMPLIANCE CHECK ====================
        console.log(`[Compliance] Checking benefit script for brand: ${brand} (attempt ${retryCount + 1}/${maxRetries})`);

        const caption = `Educational content about ${benefit.title}. #OwnerFi #Homeownership #RealEstate`;
        const title = benefit.title;

        const complianceResult = await checkScriptCompliance(script, caption, title, brand);

        // If passed compliance
        if (complianceResult.passed) {
          console.log(`[Compliance] ✅ Script passed compliance check`);
          console.log(`✅ Generated script (${today} - ${todayTheme.theme}):`);
          console.log(`   🎭 Emotion: ${todayTheme.emotion}`);
          console.log(`   📝 Script: ${script.substring(0, 100)}...`);
          console.log(`   📊 Word count: ${script.split(/\s+/).length} words`);
          return script;
        }

        // Failed compliance - retry
        retryCount++;

        const violations = complianceResult.violations.map(v => `${v.phrase} (${v.type})`).join(', ');
        console.log(`[Compliance] ❌ Attempt ${retryCount}/${maxRetries} failed: ${violations}`);

        if (retryCount >= maxRetries) {
          throw new Error(
            `Compliance check failed after ${maxRetries} attempts. ` +
            `Violations: ${violations}. ` +
            `Benefit: ${benefit.title}`
          );
        }

        // Loop will retry with compliance warning added to system prompt

      } catch (error) {
        // If this was the last retry, re-throw
        if (retryCount >= maxRetries - 1) {
          console.error('⚠️  OpenAI script generation failed after all retries:', error);
          const fallback = `Think you can't buy a home? ${benefit.shortDescription} See what's possible at OwnerFi.ai`;

          // Validate fallback too
          const validation = this.validateScript(fallback);
          if (!validation.valid) {
            throw new Error(`Even fallback script is invalid: ${validation.reason}`);
          }

          return fallback;
        }

        // Otherwise, increment retry and continue loop
        retryCount++;
        console.error(`⚠️  Attempt ${retryCount}/${maxRetries} failed, retrying:`, error);
      }
    }

    // Should never reach here
    throw new Error('Unexpected script generation loop exit');
  }

  /**
   * Validate HeyGen request before sending
   * Supports both talking_photo and avatar types
   */
  private validateHeyGenRequest(request: any): { valid: boolean; reason?: string } {
    if (!request.video_inputs || !Array.isArray(request.video_inputs)) {
      return { valid: false, reason: 'video_inputs is not an array' };
    }

    if (request.video_inputs.length === 0) {
      return { valid: false, reason: 'video_inputs array is empty' };
    }

    const scene = request.video_inputs[0];

    // Check for either talking_photo_id OR avatar_id (supports both types)
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
   * Generate benefit video via HeyGen API
   * Now with multi-agent support for content variety
   *
   * @param benefit - The benefit point to generate video for
   * @param workflowId - Workflow ID for tracking
   * @param agentOptions - Optional agent selection preferences
   */
  async generateVideo(
    benefit: BenefitPoint,
    workflowId: string,
    agentOptions?: AgentSelectionOptions
  ): Promise<{ videoId: string; agentId: string }> {
    console.log(`\n📹 Generating benefit video: ${benefit.title}`);
    console.log(`   Workflow ID: ${workflowId}`);

    // Generate script with validation
    const script = await this.generateScript(benefit);
    console.log(`   ✅ Script generated and validated`);

    // Select agent for this video (uses round-robin by default)
    const agent = await selectAgent('benefit', {
      mode: agentOptions?.mode || 'round-robin',
      language: 'en',
      ...agentOptions,
    });

    // Fallback to legacy config if no agent available
    if (!agent) {
      console.warn('⚠️  No agent available, using legacy AVATAR_CONFIG');
      return this.generateVideoLegacy(benefit, workflowId, script);
    }

    console.log(`   🤖 Selected agent: ${agent.name} (${agent.id})`);
    console.log(`   🎭 Avatar: ${agent.avatar.avatarId.substring(0, 12)}...`);
    console.log(`   🗣️  Voice: ${agent.voice.voiceId.substring(0, 12)}...`);
    if (agent.voice.emotion) {
      console.log(`   😊 Emotion: ${agent.voice.emotion}`);
    }

    // Get webhook URL
    const webhookUrl = getBrandWebhookUrl('benefit', 'heygen');

    // Build character config from agent
    const characterConfig = buildCharacterConfig(agent, 'vertical');

    // Build voice config from agent with the script
    const voiceConfig = buildVoiceConfig(agent, script);

    // Build background config - use brand-specific green color
    // ALWAYS provide a background to avoid white backgrounds
    const backgroundConfig = buildBackgroundConfig('benefit');

    // Build HeyGen API request with background (always included to prevent white backgrounds)
    const videoInput: any = {
      character: characterConfig,
      voice: voiceConfig,
      background: backgroundConfig,
    };

    const request = {
      video_inputs: [videoInput],
      dimension: {
        width: 1080,
        height: 1920 // Vertical for mobile/social
      },
      title: benefit.title,
      caption: false, // We'll add captions via Submagic
      callback_id: workflowId,
      webhook_url: webhookUrl
    };

    // Validate request before sending
    const validation = this.validateHeyGenRequest(request);
    if (!validation.valid) {
      console.error('❌ CRITICAL: Invalid HeyGen request:', validation.reason);
      console.error('   Request:', JSON.stringify(request, null, 2));
      throw new Error(`Invalid HeyGen request: ${validation.reason}`);
    }

    console.log(`   ✅ HeyGen request validated`);
    console.log(`   📞 Webhook URL: ${webhookUrl}`);
    console.log(`   📝 Script: ${script.split(' ').length} words`);
    console.log(`   🎭 Avatar: ${AVATAR_CONFIG.talking_photo_id.substring(0, 8)}...`);
    console.log(`   🗣️  Voice: ${AVATAR_CONFIG.voice_id.substring(0, 8)}...`);

    // Call HeyGen API
    console.log(`   🚀 Sending request to HeyGen...`);
    let response;
    try {
      response = await circuitBreakers.heygen.execute(async () => {
        return await fetchWithTimeout(
          HEYGEN_API_URL,
          {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'content-type': 'application/json',
              'x-api-key': this.apiKey
            },
            body: JSON.stringify(request)
          },
          TIMEOUTS.HEYGEN_API
        );
      });
    } catch (fetchError) {
      console.error('❌ CRITICAL: Failed to send HeyGen request:', fetchError);
      console.error('   Request that failed:', JSON.stringify(request, null, 2));
      throw new Error(`Failed to send HeyGen request: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HeyGen API Error Response:');
      console.error('   Status:', response.status);
      console.error('   Body:', errorText);
      console.error('   Request that was sent:', JSON.stringify(request, null, 2));

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      throw new Error(`HeyGen API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const result: HeyGenVideoResponse = await response.json();
    console.log(`   📬 HeyGen response:`, JSON.stringify(result, null, 2));

    if (result.error) {
      const errorMessage = typeof result.error === 'string'
        ? result.error
        : JSON.stringify(result.error);
      console.error('❌ HeyGen returned error in response:', errorMessage);
      console.error('   Request that caused error:', JSON.stringify(request, null, 2));
      throw new Error(`HeyGen API error: ${errorMessage}`);
    }

    if (!result.data || !result.data.video_id) {
      console.error('❌ HeyGen response missing video_id');
      console.error('   Response:', JSON.stringify(result, null, 2));
      console.error('   Request:', JSON.stringify(request, null, 2));
      throw new Error('HeyGen API did not return a video ID');
    }

    const videoId = result.data.video_id;
    console.log(`✅ Video generation started successfully!`);
    console.log(`   Video ID: ${videoId}`);
    console.log(`   Workflow ID: ${workflowId}`);
    console.log(`   Agent: ${agent.name} (${agent.id})`);

    return { videoId, agentId: agent.id };
  }

  /**
   * Legacy video generation (fallback when no agents available)
   * Uses the hardcoded AVATAR_CONFIG
   */
  private async generateVideoLegacy(
    benefit: BenefitPoint,
    workflowId: string,
    script: string
  ): Promise<{ videoId: string; agentId: string }> {
    console.log('   ⚠️  Using legacy avatar config (no agent system)');

    // Validate avatar config
    if (!AVATAR_CONFIG.talking_photo_id) {
      throw new Error('CRITICAL: talking_photo_id is missing from AVATAR_CONFIG');
    }
    if (!AVATAR_CONFIG.voice_id) {
      throw new Error('CRITICAL: voice_id is missing from AVATAR_CONFIG');
    }

    const webhookUrl = getBrandWebhookUrl('benefit', 'heygen');

    const request = {
      video_inputs: [
        {
          character: {
            type: 'talking_photo',
            talking_photo_id: AVATAR_CONFIG.talking_photo_id,
            scale: AVATAR_CONFIG.scale,
          },
          voice: {
            type: 'text',
            input_text: script,
            voice_id: AVATAR_CONFIG.voice_id,
            speed: 1.0,
            emotion: 'Excited', // Use excited emotion
          },
          background: {
            type: 'color',
            value: AVATAR_CONFIG.background_color
          }
        }
      ],
      dimension: {
        width: 1080,
        height: 1920
      },
      title: benefit.title,
      caption: false,
      callback_id: workflowId,
      webhook_url: webhookUrl
    };

    const response = await circuitBreakers.heygen.execute(async () => {
      return await fetchWithTimeout(
        HEYGEN_API_URL,
        {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': this.apiKey
          },
          body: JSON.stringify(request)
        },
        TIMEOUTS.HEYGEN_API
      );
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
    }

    const result: HeyGenVideoResponse = await response.json();

    if (result.error || !result.data?.video_id) {
      throw new Error(`HeyGen API error: ${JSON.stringify(result.error || 'No video ID')}`);
    }

    return { videoId: result.data.video_id, agentId: 'legacy' };
  }
}
