/**
 * Caption Intelligence System
 *
 * Data-backed caption and first comment generation
 * Based on analysis of 240+ posts showing:
 * - YouTube: 287 char avg, 95% exclamation, 90% emoji, 55% question
 * - Instagram: 234 char avg, 100% hashtags, 60% exclamation, 55% question
 * - Universal sweet spot: 250 characters
 */

import OpenAI from 'openai';

// Lazy initialize OpenAI client
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// ============================================================================
// UNIVERSAL CAPTION FORMULA (Works for YouTube + Instagram)
// ============================================================================

export const UNIVERSAL_CAPTION_PROMPT = `
You are the Caption Generator for a social media automation system.

Your captions MUST follow this proven formula that works across YouTube Shorts and Instagram Reels:

📝 FORMAT RULES (STRICT):
- Length: EXACTLY 200-300 characters (target 250)
- ✅ 1-2 exclamation marks (creates urgency)
- ✅ 1 question to engage audience
- ✅ Include 2-3 specific numbers/stats
- ✅ 3-4 hashtags at the end (always include brand-specific tags)
- ⚠️ Emoji OPTIONAL - only use if it fits naturally (don't force it)

🧩 STRUCTURE:
[HOOK/HEADLINE with exclamation]!
[QUESTION that engages the audience]
[EXPLANATION with specific numbers and details]
#Hashtag1 #Hashtag2 #Hashtag3 #BrandTag

🎯 EXAMPLES OF WINNING CAPTIONS:

Example 1 (Real Estate):
This is how I bought a house with a 550 credit score!
Are you tired of banks saying no?
Owner financing let me go from $1500 rent to $1200 mortgage — no bank needed. Bad credit doesn't mean you can't own.
#homeowner #ownerfinance #badcredit #realestate
(264 characters ✅)

Example 2 (EV/Cars):
Tesla Recall Alert!
Did you know 13,000 models are affected?
New safety investigation reveals critical issues with autonomous driving. California rushing to implement new laws before more accidents happen.
#Tesla #EVNews #ElectricVehicles #SelfDriving
(246 characters ✅)

Example 3 (Owner Financing):
Rejected by every bank?
Are you waiting for the right time to buy?
The housing market is shifting and owner financing gives you power. No minimum credit score required — sellers care about your ability to pay.
#realestate #ownerfinance #badcredit #homebuyer
(258 characters ✅)

⚠️ CRITICAL RULES:
- Count characters carefully - must be 200-300
- One clear hook/headline at the start
- One question to engage
- Specific numbers make it credible (credit scores, prices, percentages)
- Hashtags always at the end
- Keep it conversational and authentic
`;

// ============================================================================
// FIRST COMMENT FORMULA (Engagement + Extra Hashtags)
// ============================================================================

export const FIRST_COMMENT_PROMPT = `
You are generating a FIRST COMMENT that will be auto-posted with the video.

First comments serve 3 purposes:
1. Drive engagement (replies, emoji reactions)
2. Add extra hashtags for discoverability (without cluttering main caption)
3. Provide a clear call-to-action

📝 FORMAT RULES:
- Length: 80-150 characters
- ✅ Start with engagement hook (💬 emoji + action)
- ✅ Include 5-8 additional hashtags (different from main caption)
- ✅ Keep it conversational and natural
- ✅ Encourage interaction (tag, comment, emoji drop)

🧩 STRUCTURE:
💬 [Engagement Hook]! #hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5

🎯 EXAMPLES OF WINNING FIRST COMMENTS:

Example 1 (Real Estate):
💬 Tag someone who needs to see this! #mortgage #creditrepair #firsttimehomebuyer #renters #financialfreedom #wealthbuilding #realestateinvesting #debtfree

Example 2 (Engagement Question):
💬 Drop a 🏠 if you're ready to stop renting! #housingmarket #rentvsown #homeownership #creditscore #financialtips

Example 3 (CTA):
💬 Save this for later! #realestatetips #badcreditOK #ownerfinancing #homebuyingtips #mortgage #wealth

Example 4 (Cars/EV):
💬 Share with someone shopping for an EV! #electriccars #teslaowner #evlife #carbuyingtips #greenenergy #sustainability

⚠️ CRITICAL RULES:
- MUST start with 💬
- Hashtags should be DIFFERENT from main caption hashtags
- Keep it under 150 characters
- Natural and conversational
- Focus on action verbs (tag, share, drop, save)
`;

// ============================================================================
// INTERFACES
// ============================================================================

export interface CaptionRequest {
  topic: string;
  brand: 'ownerfi' | 'carz' | 'podcast' | 'property' | 'property-spanish' | 'vassdistro' | 'benefit' | 'abdullah' | 'personal' | 'gaza';
  script?: string; // Optional full script for context
  platform?: 'youtube' | 'instagram' | 'both'; // Default: both
}

export interface CaptionResult {
  caption: string;
  firstComment: string;
  metadata: {
    captionLength: number;
    hasExclamation: boolean;
    hasQuestion: boolean;
    hashtagCount: number;
    estimatedCharCount: number;
  };
}

// ============================================================================
// BRAND-SPECIFIC CONTEXT
// ============================================================================

const BRAND_CONTEXT: Record<string, { focus: string; hashtags: string[] }> = {
  ownerfi: {
    focus: 'Real estate, owner financing, bad credit homeownership, rent vs buy',
    hashtags: ['homeowner', 'ownerfinance', 'badcredit', 'realestate', 'mortgage', 'creditrepair', 'firsttimehomebuyer', 'renters', 'financialfreedom', 'wealthbuilding']
  },
  carz: {
    focus: 'Electric vehicles, car news, EV technology, dealer tactics, car buying',
    hashtags: ['ElectricVehicles', 'EVNews', 'Tesla', 'CarBuying', 'AutoNews', 'GreenEnergy', 'EVLife', 'SelfDriving']
  },
  property: {
    focus: 'Property investment, real estate deals, property management',
    hashtags: ['realestate', 'property', 'investment', 'passiveincome', 'realestateinvesting']
  },
  'property-spanish': {
    focus: 'Propiedades, financiamiento de dueño, inversión inmobiliaria',
    hashtags: ['propiedades', 'bienesinmuebles', 'casapropia', 'financiamiento', 'inversion', 'inmobiliario']
  },
  podcast: {
    focus: 'Expert interviews, educational content, advice',
    hashtags: ['podcast', 'interview', 'expertadvice', 'education']
  },
  vassdistro: {
    focus: 'Distribution, business, logistics',
    hashtags: ['business', 'distribution', 'logistics', 'commerce']
  },
  benefit: {
    focus: 'Benefits of owner financing, buyer and seller advantages',
    hashtags: ['ownerfinance', 'homebuyer', 'realestate', 'benefits', 'finance', 'homeownership']
  },
  abdullah: {
    focus: 'Personal brand, entrepreneurship, business insights',
    hashtags: ['entrepreneur', 'business', 'success', 'motivation', 'leadership']
  },
  personal: {
    focus: 'Personal content, lifestyle, thoughts',
    hashtags: ['personal', 'lifestyle', 'thoughts', 'daily']
  },
  gaza: {
    focus: 'Gaza humanitarian news, Palestine, humanitarian crisis coverage',
    hashtags: ['Gaza', 'Palestine', 'Humanitarian', 'News', 'FreePalestine', 'HumanitarianCrisis', 'MiddleEast']
  }
};

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

export async function generateCaptionAndComment(
  request: CaptionRequest
): Promise<CaptionResult> {
  const brandContext = BRAND_CONTEXT[request.brand] || BRAND_CONTEXT.ownerfi;

  // Build caption prompt with brand context
  const captionPrompt = `
${UNIVERSAL_CAPTION_PROMPT}

BRAND: ${request.brand}
FOCUS: ${brandContext.focus}
TOPIC: ${request.topic}
${request.script ? `SCRIPT CONTEXT: ${request.script.substring(0, 500)}` : ''}

RECOMMENDED HASHTAGS: ${brandContext.hashtags.slice(0, 8).map(tag => '#' + tag).join(' ')}

Now generate a caption following the universal formula above.
Remember: 200-300 characters, exclamation, question, numbers, hashtags.
`;

  // Build first comment prompt
  const firstCommentPrompt = `
${FIRST_COMMENT_PROMPT}

BRAND: ${request.brand}
TOPIC: ${request.topic}

AVAILABLE HASHTAGS (use different ones from main caption):
${brandContext.hashtags.map(tag => '#' + tag).join(' ')}

Now generate a first comment that drives engagement and adds extra hashtags.
Remember: 💬 + engagement hook + 5-8 hashtags, under 150 characters.
`;

  try {
    const openaiClient = getOpenAI();

    // Generate caption
    const captionResponse = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert social media caption writer. You follow formulas precisely and count characters accurately.'
        },
        {
          role: 'user',
          content: captionPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    const caption = captionResponse.choices[0].message.content?.trim() || '';

    // Generate first comment
    const commentResponse = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at writing engaging first comments that drive social media interaction.'
        },
        {
          role: 'user',
          content: firstCommentPrompt
        }
      ],
      temperature: 0.8,
      max_tokens: 100
    });

    const firstComment = commentResponse.choices[0].message.content?.trim() || '';

    // Calculate metadata
    const metadata = {
      captionLength: caption.length,
      hasExclamation: caption.includes('!'),
      hasQuestion: caption.includes('?'),
      hashtagCount: (caption.match(/#/g) || []).length,
      estimatedCharCount: caption.length
    };

    // Validate caption length
    if (caption.length < 200 || caption.length > 350) {
      console.warn(`⚠️  Caption length ${caption.length} outside optimal range (200-300 chars)`);
    }

    return {
      caption,
      firstComment,
      metadata
    };
  } catch (error) {
    console.error('❌ Error generating caption and comment:', error);
    throw new Error('Failed to generate caption and comment');
  }
}

// ============================================================================
// HELPER: Generate Multiple Variants for A/B Testing
// ============================================================================

export async function generateCaptionVariants(
  request: CaptionRequest,
  count: number = 3
): Promise<CaptionResult[]> {
  const variants: CaptionResult[] = [];

  for (let i = 0; i < count; i++) {
    const result = await generateCaptionAndComment(request);
    variants.push(result);

    // Small delay to get variation
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return variants;
}

// ============================================================================
// VALIDATION: Check if caption meets formula
// ============================================================================

export function validateCaption(caption: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Length check
  if (caption.length < 200) {
    issues.push(`Too short: ${caption.length} chars (need 200-300)`);
  }
  if (caption.length > 350) {
    issues.push(`Too long: ${caption.length} chars (need 200-300)`);
  }

  // Exclamation check
  if (!caption.includes('!')) {
    issues.push('Missing exclamation mark');
  }

  // Question check
  if (!caption.includes('?')) {
    issues.push('Missing question');
  }

  // Hashtag check
  const hashtagCount = (caption.match(/#/g) || []).length;
  if (hashtagCount < 3) {
    issues.push(`Only ${hashtagCount} hashtags (need 3-4)`);
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
