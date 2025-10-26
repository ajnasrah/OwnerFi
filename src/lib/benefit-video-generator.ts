/**
 * Benefit Video Generator - BUYER-ONLY
 * Generates HeyGen avatar videos for owner financing buyer benefits
 */

import { BenefitPoint } from '@/lib/benefit-content';
import { circuitBreakers, fetchWithTimeout, TIMEOUTS } from '@/lib/api-utils';
import { getBrandWebhookUrl } from '@/lib/brand-utils';

const HEYGEN_API_URL = 'https://api.heygen.com/v2/video/generate';

// Abdullah avatar config (same as viral system)
const AVATAR_CONFIG = {
  talking_photo_id: 'f40972493dd74bbe829f30daa09ea1a9', // Motion-enabled avatar
  voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
  scale: 1.4, // Same scale as viral videos
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
   */
  private async generateScript(benefit: BenefitPoint): Promise<string> {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      console.warn('⚠️  No OPENAI_API_KEY - using fallback script');
      // Fallback if no OpenAI key
      const fallback = `Think you can't buy a home? ${benefit.shortDescription} See what's possible at OwnerFi.ai`;
      return fallback;
    }

    // Daily themes for variety
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];

    const dailyThemes = {
      'Monday': 'Credit Myths - Debunk common credit score myths that stop people from trying',
      'Tuesday': 'Real Stories - Share inspiring transformation stories of renters becoming homeowners',
      'Wednesday': 'How It Works - Explain owner financing process in simple, relatable terms',
      'Thursday': 'Money Mindset - Challenge limiting beliefs about homeownership and affordability',
      'Friday': 'Quick Wins - Share actionable tips buyers can implement immediately',
      'Saturday': 'Comparison - Show owner financing vs traditional bank loans side-by-side',
      'Sunday': 'Vision & Hope - Paint the picture of homeownership lifestyle and freedom'
    };

    const todayTheme = dailyThemes[today as keyof typeof dailyThemes];

    const prompt = `Generate a video script about "${benefit.title}" for buyers who can't qualify for traditional bank loans.

TODAY'S THEME (${today}): ${todayTheme}

TOPIC CONTEXT: ${benefit.shortDescription}

YOUR ROLE:
You are the official social-media scriptwriter for OwnerFi, a platform that helps people become homeowners without traditional banks using owner financing.

YOUR GOAL:
Make everyday renters stop scrolling and realize — they can actually own a home through owner financing.

STYLE RULES:
- Reading level: 5th grade — short, clear, natural sentences
- Tone: Friendly, confident, motivational — like a big brother giving real talk
- Length: 30 seconds max (≈90 words)
- Structure: Hook → Story/Insight → Soft CTA
- Hook (first 3 seconds): Use shock, surprise, or emotion to grab attention
- CTA: End with "See what's possible at OwnerFi.ai" or "Find homes like this for free at OwnerFi.ai"
- Do NOT promise approvals, prices, or guarantees
- All content must be 100% original and copyright-safe
- NEVER use phrases like "Let me tell you," "You won't believe this," or "I'm going to share"
- Keep it conversational — written to be spoken, not read

OUTPUT FORMAT:
Return ONLY the script text in this structure:

🎯 [Hook - 3-5 seconds of shock/surprise/emotion]
💡 [Main message - 15-20 seconds of insight/story]
🏁 [Soft CTA - 5 seconds with OwnerFi.ai]

EXAMPLE OUTPUT:
🎯 "Think you need perfect credit to buy a home? Nope — that's the old way."
💡 "With owner financing, you can buy directly from the seller. No bank hoops, no long waits, just steady income and a down payment. It's how thousands of families finally got keys in their hands."
🏁 "Search owner-finance homes near you — free at OwnerFi.ai."`;

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
              content: 'You are the official social-media scriptwriter for OwnerFi. Create short, 30-second max (≈90-word) video scripts that explain, inspire, and educate buyers who think homeownership is out of reach. Style: Friendly, confident, motivational. 5th-grade reading level. No hype, no jargon.'
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

      console.log(`✅ Generated script (${today} - ${todayTheme.split('-')[0].trim()}):`);
      console.log(script.substring(0, 100) + '...');
      console.log(`   📊 Word count: ${script.split(/\s+/).length} words`);
      return script;

    } catch (error) {
      console.error('⚠️  OpenAI script generation failed, using fallback:', error);
      const fallback = `Think you can't buy a home? ${benefit.shortDescription} See what's possible at OwnerFi.ai`;

      // Validate fallback too
      const validation = this.validateScript(fallback);
      if (!validation.valid) {
        throw new Error(`Even fallback script is invalid: ${validation.reason}`);
      }

      return fallback;
    }
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

    if (!scene.character?.talking_photo_id) {
      return { valid: false, reason: 'Missing talking_photo_id' };
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
   */
  async generateVideo(benefit: BenefitPoint, workflowId: string): Promise<string> {
    console.log(`\n📹 Generating benefit video: ${benefit.title}`);
    console.log(`   Workflow ID: ${workflowId}`);

    // Generate script with validation
    const script = await this.generateScript(benefit);
    console.log(`   ✅ Script generated and validated`);

    // Validate avatar config
    if (!AVATAR_CONFIG.talking_photo_id) {
      throw new Error('CRITICAL: talking_photo_id is missing from AVATAR_CONFIG');
    }
    if (!AVATAR_CONFIG.voice_id) {
      throw new Error('CRITICAL: voice_id is missing from AVATAR_CONFIG');
    }

    // Get webhook URL
    const webhookUrl = getBrandWebhookUrl('benefit', 'heygen');

    // Build HeyGen API request
    const request = {
      video_inputs: [
        {
          character: {
            type: 'talking_photo',
            talking_photo_id: AVATAR_CONFIG.talking_photo_id,
            scale: AVATAR_CONFIG.scale,
            talking_photo_style: 'square', // Full screen, not circle
            talking_style: 'expressive'
          },
          voice: {
            type: 'text',
            input_text: script,
            voice_id: AVATAR_CONFIG.voice_id,
            speed: 1.0
          },
          background: {
            type: 'color',
            value: AVATAR_CONFIG.background_color
          }
        }
      ],
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

    return videoId;
  }
}
