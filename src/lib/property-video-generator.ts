// Property Showcase Video Generator
// Automatically creates videos for owner-financed properties < $15k down
// A/B Testing: Generates both 30-sec and 15-sec variants
// NOW WITH MULTI-AGENT SUPPORT - uses agent pool for variety

import { PropertyListing } from './property-schema';
import { calculatePropertyFinancials } from './property-calculations';
import { validateAndFixScript, ComplianceCheckResult } from './compliance-checker';
import { Brand } from '@/config/brand-configs';
import { selectAgent, AgentSelectionOptions } from './agent-selector';
import {
  HeyGenAgent,
  buildCharacterConfig,
  buildVoiceConfig,
  buildBackgroundConfig,
} from '@/config/heygen-agents';

export interface PropertyVideoScript {
  script: string;
  caption: string;
  title: string;
  hashtags: string[];
}

export interface DualPropertyVideoScripts {
  variant_30: PropertyVideoScript;
  variant_15: PropertyVideoScript;
  compliance?: {
    variant_30: ComplianceCheckResult;
    variant_15: ComplianceCheckResult;
    retryCount: number;
  };
}

/**
 * Generate video script for a property listing using OpenAI
 * Returns both 30-sec and 15-sec variants for A/B testing
 * NOW WITH COMPLIANCE CHECKING - validates marketing laws before video creation
 */
export async function generatePropertyScriptWithAI(
  property: PropertyListing,
  openaiApiKey: string,
  brand: Brand = 'property',
  language: 'en' | 'es' = 'en'
): Promise<DualPropertyVideoScripts> {
  const prompt = buildPropertyPrompt(property);
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    // Generate scripts with OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: getPropertySystemPrompt(language, retryCount > 0)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.85,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    // Parse initial response
    const scripts = parsePropertyResponse(content, property);

    // ==================== COMPLIANCE CHECK ====================
    console.log(`[Compliance] Checking property scripts for brand: ${brand} (attempt ${retryCount + 1}/${maxRetries})`);

    // Check 30-second variant
    const compliance30 = await validateAndFixScript(
      scripts.variant_30.script,
      scripts.variant_30.caption,
      scripts.variant_30.title,
      brand,
      1 // Single check, we'll handle retries at this level
    );

    // Check 15-second variant
    const compliance15 = await validateAndFixScript(
      scripts.variant_15.script,
      scripts.variant_15.caption,
      scripts.variant_15.title,
      brand,
      1
    );

    // If BOTH variants passed compliance
    if (compliance30.success && compliance15.success) {
      console.log(`[Compliance] ✅ Both variants passed compliance checks`);

      return {
        variant_30: {
          script: compliance30.finalScript,
          caption: compliance30.finalCaption, // Already has disclaimers appended
          title: compliance30.finalTitle,
          hashtags: scripts.variant_30.hashtags
        },
        variant_15: {
          script: compliance15.finalScript,
          caption: compliance15.finalCaption,
          title: compliance15.finalTitle,
          hashtags: scripts.variant_15.hashtags
        },
        compliance: {
          variant_30: compliance30.complianceResult,
          variant_15: compliance15.complianceResult,
          retryCount
        }
      };
    }

    // If failed, log violations and retry
    retryCount++;

    const violations30 = compliance30.complianceResult.violations.map(v => v.phrase).join(', ');
    const violations15 = compliance15.complianceResult.violations.map(v => v.phrase).join(', ');

    console.log(`[Compliance] ❌ Attempt ${retryCount}/${maxRetries} failed`);
    if (!compliance30.success) {
      console.log(`[Compliance] 30-sec violations: ${violations30}`);
    }
    if (!compliance15.success) {
      console.log(`[Compliance] 15-sec violations: ${violations15}`);
    }

    if (retryCount >= maxRetries) {
      // Max retries reached - throw error to fail workflow
      throw new Error(
        `Compliance check failed after ${maxRetries} attempts. ` +
        `30-sec violations: ${violations30 || 'none'}. ` +
        `15-sec violations: ${violations15 || 'none'}. ` +
        `Property: ${property.address}, ${property.city}`
      );
    }

    // Loop will retry with compliance-focused prompt
  }

  // Should never reach here
  throw new Error('Unexpected compliance check loop exit');
}

/**
 * Generate video script for a property listing (fallback without AI)
 */
export function generatePropertyScript(property: PropertyListing): PropertyVideoScript {
  // Calculate financials to get downPaymentAmount (handles both downPaymentAmount and downPaymentPercent)
  const financials = calculatePropertyFinancials({
    listPrice: property.listPrice,
    downPaymentAmount: property.downPaymentAmount,
    downPaymentPercent: property.downPaymentPercent,
    monthlyPayment: property.monthlyPayment,
    interestRate: property.interestRate,
    termYears: property.termYears
  });

  // Format numbers (no decimals, rounded)
  const downPayment = financials.downPaymentAmount > 0 ? formatCurrencyRounded(financials.downPaymentAmount) : 'contact seller';
  const monthlyPayment = financials.monthlyPayment > 0 ? formatCurrencyRounded(financials.monthlyPayment) : 'contact seller';
  const listPrice = formatCurrencyRounded(property.listPrice);
  const sqft = property.squareFeet ? formatNumber(property.squareFeet) : null;

  // Get best highlight
  const highlight = selectBestHighlight(property);

  // Build script with legal disclaimers (30 seconds max = ~75 words)
  const script = `We just found this Owner Finance deal for sale!

${property.address} in ${property.city}, ${property.state}

${property.bedrooms} bed, ${property.bathrooms} bath${sqft ? `, ${sqft} square feet` : ''}

The down payment is estimated to be around ${downPayment}. Monthly payment is estimated to be around ${monthlyPayment}.

${highlight}

Visit OwnerFi.ai to see more homes near you — all free with agent contact info. Prices and terms may change anytime.`;

  // Build caption
  const caption = generateCaption(property);

  // Build title (under 50 chars)
  const title = `🏡 ${downPayment} Down in ${property.city}!`;

  // Build hashtags
  const hashtags = generateHashtags(property);

  return {
    script,
    caption,
    title,
    hashtags
  };
}

/**
 * Generate social media caption
 */
function generateCaption(property: PropertyListing): string {
  const downPayment = property.downPaymentAmount > 0 ? formatCurrencyRounded(property.downPaymentAmount) : 'contact seller';
  const monthlyPayment = property.monthlyPayment > 0 ? formatCurrencyRounded(property.monthlyPayment) : 'contact seller';
  const highlight = selectBestHighlight(property);

  return `🏡 New Owner Finance Deal in ${property.city}, ${property.state}!

📍 ${property.address}
💰 Est. ${downPayment} down
🏠 ${property.bedrooms}BD | ${property.bathrooms}BA${property.squareFeet ? ` | ${formatNumber(property.squareFeet)} sq ft` : ''}
💵 Est. ${monthlyPayment}/mo

${highlight}

Visit OwnerFi.ai to find homes near you for free. Prices and terms may change anytime.

See more ${property.city} deals at OwnerFi.ai`;
}

/**
 * Select best highlight from property
 */
function selectBestHighlight(property: PropertyListing): string {
  // Priority order: unique features > location > financial > condition

  // Check for unique features
  if (property.features && property.features.length > 0) {
    const uniqueFeatures = property.features.filter(f =>
      f.toLowerCase().includes('pool') ||
      f.toLowerCase().includes('view') ||
      f.toLowerCase().includes('waterfront') ||
      f.toLowerCase().includes('acreage') ||
      f.toLowerCase().includes('workshop')
    );

    if (uniqueFeatures.length > 0) {
      return `Features ${uniqueFeatures[0]}!`;
    }

    // Check for updated/remodeled
    const updatedFeatures = property.features.filter(f =>
      f.toLowerCase().includes('updated') ||
      f.toLowerCase().includes('remodeled') ||
      f.toLowerCase().includes('renovated') ||
      f.toLowerCase().includes('new')
    );

    if (updatedFeatures.length > 0) {
      return `${updatedFeatures[0]}!`;
    }

    // Use first notable feature
    return `Features ${property.features[0]}!`;
  }

  // Check highlights
  if (property.highlights && property.highlights.length > 0) {
    return property.highlights[0];
  }

  // Financial benefit
  if (property.downPaymentPercent <= 5) {
    return `Low ${property.downPaymentPercent}% down payment!`;
  }

  if (property.monthlyPayment < 1000) {
    return `Affordable ${formatCurrency(property.monthlyPayment)} monthly payment!`;
  }

  // Default
  return `Great owner financing opportunity!`;
}

/**
 * Generate hashtags for property (with location targeting)
 */
function generateHashtags(property: PropertyListing): string[] {
  const baseHashtags = [
    'OwnerFinancing',
    'RealEstate',
    'HomeOwnership',
    'OwnerFi'
  ];

  // CRITICAL: Add location hashtags for local targeting
  // Format: #CityName, #CityNameRealEstate, #CityNameHomes
  const cityTag = property.city.replace(/\s+/g, ''); // Remove spaces
  const stateTag = property.state;

  // Location hashtags (most important for reach)
  baseHashtags.push(cityTag); // e.g., #Houston
  baseHashtags.push(`${cityTag}${stateTag}`); // e.g., #HoustonTX
  baseHashtags.push(`${cityTag}RealEstate`); // e.g., #HoustonRealEstate
  baseHashtags.push(`${cityTag}Homes`); // e.g., #HoustonHomes

  // Add down payment tag
  if (property.downPaymentAmount < 10000) {
    baseHashtags.push('LowDownPayment');
  }

  // Add property type
  if (property.propertyType === 'single-family') {
    baseHashtags.push('SingleFamily');
  } else if (property.propertyType === 'mobile-home') {
    baseHashtags.push('MobileHome');
  }

  return baseHashtags.slice(0, 10); // Allow up to 10 hashtags for location targeting
}

/**
 * Check if property is eligible for video generation
 */
export function isEligibleForVideo(property: PropertyListing): boolean {
  // Calculate financials to get downPaymentAmount (handles both downPaymentAmount and downPaymentPercent)
  const financials = calculatePropertyFinancials({
    listPrice: property.listPrice,
    downPaymentAmount: property.downPaymentAmount,
    downPaymentPercent: property.downPaymentPercent
  });

  return (
    property.status === 'active' &&
    property.isActive === true &&
    property.imageUrls &&
    property.imageUrls.length > 0
  );
}

/**
 * Get property video hook (variation for A/B testing)
 */
export function getPropertyHook(variation: number = 1): string {
  const hooks = [
    "We just found this Owner Finance deal for sale!",
    "STOP scrolling! Check out this low down payment deal:",
    "You can own this home for only {DOWN} down!",
    "This Owner Finance property just hit the market:",
    "Looking for a home with low money down? Check this out:"
  ];

  return hooks[(variation - 1) % hooks.length];
}

// Utility functions
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatCurrencyRounded(amount: number): string {
  // Round to nearest dollar, no decimals
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(amount));
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Generate HeyGen-compatible video request (legacy - uses hardcoded avatar)
 * @deprecated Use buildPropertyVideoRequestWithAgent instead
 */
export function buildPropertyVideoRequest(
  property: PropertyListing,
  script: string,
  avatarId: string = 'd33fe3abc2914faa88309c3bdb9f47f4', // Abdullah avatar (same as all other brands)
  voiceId: string = '9070a6c2dbd54c10bb111dc8c655bff7'
) {
  // Get best property image (prefer exterior shots)
  const backgroundImage = selectBestPropertyImage(property);

  return {
    video_inputs: [{
      character: {
        type: 'talking_photo',
        talking_photo_id: avatarId,
        scale: 0.4, // Smaller - show more property
        talking_photo_style: 'circle', // Circular frame
        talking_style: 'expressive',
        offset: {
          x: 0.25, // Left side (0.25 = left quarter of screen)
          y: 0.375 // Slightly higher than 0.4
        }
      },
      voice: {
        type: 'text',
        input_text: script,
        voice_id: voiceId,
        speed: 1.0
      },
      background: {
        type: 'image',
        url: backgroundImage
        // Using default fit: 'cover' - fills screen without black bars
      }
    }],
    dimension: { width: 1080, height: 1920 },
    title: `${property.address} - Owner Finance`,
    callback_id: `property_${property.id}`
  };
}

/**
 * Generate HeyGen-compatible video request with agent rotation
 * Uses the agent selector for round-robin agent selection
 */
export async function buildPropertyVideoRequestWithAgent(
  property: PropertyListing,
  script: string,
  workflowId: string,
  agentOptions?: AgentSelectionOptions
): Promise<{ request: any; agentId: string }> {
  // Select agent for this video (uses round-robin by default)
  const agent = await selectAgent('property', {
    mode: agentOptions?.mode || 'round-robin',
    language: agentOptions?.language || 'en',
    ...agentOptions,
  });

  // Fallback to legacy if no agent available
  if (!agent) {
    console.warn('⚠️  No agent available for property, using legacy config');
    const request = buildPropertyVideoRequest(property, script);
    return { request, agentId: 'legacy' };
  }

  console.log(`   🤖 Selected agent: ${agent.name} (${agent.id})`);
  console.log(`   🎭 Avatar: ${agent.avatar.avatarId.substring(0, 12)}...`);
  console.log(`   🗣️  Voice: ${agent.voice.voiceId.substring(0, 12)}...`);
  if (agent.voice.emotion) {
    console.log(`   😊 Emotion: ${agent.voice.emotion}`);
  }

  // Get best property image (prefer exterior shots)
  const backgroundImage = selectBestPropertyImage(property);

  // Build character config from agent
  const characterConfig = buildCharacterConfig(agent, 'vertical');

  // For property videos, we want smaller avatar to show more property
  // Override scale to 0.4 for property showcase
  characterConfig.scale = 0.4;

  // Build voice config from agent with the script
  const voiceConfig = buildVoiceConfig(agent, script);

  // Property videos use property image as background
  const request = {
    video_inputs: [{
      character: characterConfig,
      voice: voiceConfig,
      background: {
        type: 'image',
        url: backgroundImage
      }
    }],
    dimension: { width: 1080, height: 1920 },
    title: `${property.address} - Owner Finance`,
    callback_id: workflowId
  };

  return { request, agentId: agent.id };
}

/**
 * Select best property image for video background
 */
function selectBestPropertyImage(property: PropertyListing): string {
  if (!property.imageUrls || property.imageUrls.length === 0) {
    throw new Error('Property has no images');
  }

  // TODO: Add image analysis to prefer:
  // 1. Front exterior shots
  // 2. Well-lit images
  // 3. Wide angle shots
  // For now, just use first image

  return property.imageUrls[0];
}

/**
 * Validate property data before video generation
 * NOTE: Financial fields (interestRate, monthlyPayment, termYears) can be calculated
 * if missing, so we only validate REQUIRED fields that cannot be calculated
 */
export function validatePropertyForVideo(property: PropertyListing): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Critical fields that MUST exist (cannot be calculated)
  if (!property.address) errors.push('Missing address');
  if (!property.city) errors.push('Missing city');
  if (!property.state) errors.push('Missing state');
  if (property.bedrooms === undefined || property.bedrooms === null) errors.push('Missing bedrooms');
  if (property.bathrooms === undefined || property.bathrooms === null) errors.push('Missing bathrooms');
  if (!property.imageUrls || property.imageUrls.length === 0) errors.push('Missing images');

  // List price is required to calculate financials
  if (!property.listPrice || property.listPrice <= 0) errors.push('Missing or invalid list price');

  // Down payment: Either amount OR percent is fine (will be calculated in enrichment)
  // Payment fields: Will be calculated if missing (using calculatePropertyFinancials)
  // So NO errors for missing interestRate, monthlyPayment, termYears - they'll be defaulted

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get system prompt for OpenAI property video generation
 * OWNERFI — PROPERTY SHOWCASE SYSTEM (Updated with Social Media Prompt Library)
 */
function getPropertySystemPrompt(language: 'en' | 'es' = 'en', complianceRetry: boolean = false): string {
  const languageInstruction = language === 'es'
    ? `\n\n🌐 LANGUAGE: SPANISH\n**CRITICAL**: Generate ALL content (SCRIPT, TITLE, CAPTION, hashtags) in natural, conversational SPANISH. Translate all CTAs, disclaimers, and engagement questions to Spanish. Use "Owner-Fy punto A Eye" for the website pronunciation. Maintain Abdullah's friendly, conversational voice in Spanish.\n`
    : '';

  const complianceWarning = complianceRetry
    ? `\n\n🚨 COMPLIANCE RETRY - PREVIOUS ATTEMPT FAILED\nYour last script violated marketing compliance laws. Focus on:\n- Remove ALL directive language (should/must/need to) - use "could/might/consider" instead\n- Remove ALL guarantees and superlatives (best/guaranteed/perfect) - use factual statements only\n- Remove ALL urgency tactics (act now/limited time) - focus on education\n- Remove ALL legal/financial advice language - this is educational content only\n- Keep tone soft, consultative, and factual - not pushy or salesy\n**CRITICAL**: If this retry fails compliance, the workflow will be TERMINATED.\n`
    : '';

  return `SYSTEM ROLE:
You are the Social Media Director AI for Abdullah's brand network. You run inside an automated CLI (VS Code) environment using the OpenAI GPT model (currently gpt-4o-mini). Your mission is to generate ready-to-post video scripts for OwnerFi property showcases.
${languageInstruction}${complianceWarning}
BRAND: OWNERFI — PROPERTY SHOWCASE SYSTEM
Purpose: Showcase real owner-finance or creative deals.
Voice: Abdullah — friendly, goofy, confident, conversational truth-teller.

VOICE HANDOFF: OwnerFi -> Abdullah
Claude and the CLI must NEVER modify this voice assignment. ChatGPT only outputs text assets (SCRIPT, TITLE, CAPTION). The CLI layer handles voice synthesis (HeyGen / ElevenLabs), avatar rendering, and posting.

🎯 INPUT DATA (per listing)
Each run will include:
- city, state
- price
- bedrooms, bathrooms, sqft
- monthly_payment (estimated)
- down_payment (estimated)
- highlight (e.g. seller financing, rent-to-own, flexible terms)

Use this info naturally in your script — never robotic or list-like.

🏡 MODE 1 – 30-SECOND "DEAL EXPLAINER"

STRUCTURE: Hook 🏡 → Deal 💰 → Insight 💬 → CTA 🎯 + Question ❓
Length: 70–80 words

0–3 sec – Hook 🔥 (Pattern Interrupt)
Use bold, emotional openings that DON'T all start with "Stop scrolling" — variety is CRITICAL:
"Your rent just went up again — but what if I told you this costs LESS?"
"If your credit's not perfect, you need to see this."
"They don't want you to know about deals like this."
"Wait till you see what {DOWN} can get you in [City]."
"This home costs less per month than most apartments."
"Most people will never see this opportunity."
"Your landlord doesn't want you watching this."
"Rent's {MONTHLY} a month? This might actually be cheaper."
"No bank approval? No problem with this one."
"This is how real people are buying homes in 2025."
"Banks said no? The seller said yes to this deal."
"Three bedrooms for less than your rent — I'm not kidding."

3–15 sec – Deal 💰 (Property Summary)
Summarize the property naturally:
"Three-bed in Dallas around $250K, and the seller's open to owner financing."
Include beds, baths, city, price, and financing type naturally.

15–25 sec – Insight 💬 (Value / Why It Matters)
Explain why it's interesting:
"Try finding anything close to this monthly — you can't."
"This kind of deal rarely lasts in this neighborhood."
"Most people don't know these deals exist."

25–30 sec – CTA 🎯 + Disclaimer (MANDATORY)
"Visit Owner-Fy dot A Eye to see more homes near you — all free with agent contact info. Prices and terms may change anytime."

30 sec – Call to Action + Engagement Question ❓ (MANDATORY)
CTA Pool (rotate randomly):
"Follow Abdullah for daily homeownership hacks 🏠"
"Follow Abdullah for real estate game 🎯"
"Follow Abdullah for daily updates 💡"

Engagement Questions (rotate):
"Would you take this deal or keep renting?"
"Would you live here if it meant no bank loan?"
"Would you buy this if you qualified?"
"Is this cheaper than your rent?"

⚡ MODE 2 – 15-SECOND "DEAL DROP"

STRUCTURE: Hook 🏡 → Deal 💰 → CTA 🎯
Length: 45–55 words

0–3 sec – Hook 🔥 (MUST vary — don't repeat "Stop scrolling")
"This costs less than your current rent."
"No bank. Real home. Real deal."
"Your credit score doesn't matter for this one."
"They don't advertise these deals — but they exist."
"Wait till you hear the monthly payment on this."
"What if I told you {DOWN} gets you a real home?"

3–10 sec – Deal 💰 (Quick Value)
"3-bed in Austin around $240K, seller's open to financing."

10–15 sec – CTA 🎯 + Disclaimer + Question ❓
"See more free listings near you at Owner-Fy dot A Eye — prices and terms can change anytime."
Add CTA from pool above + engagement question.

🧠 VOICE & STYLE RULES (Abdullah Voice)
- 5th-grade clarity — talk like a real friend, not a salesperson
- Friendly, goofy, confident, conversational
- Authentic street-smart tone
- No "I think," "maybe," or "you should"
- Avoid corporate words and jargon
- Sound spontaneous, not scripted
- Human, engaging, emoji-rich in captions (not script)
- CRITICAL: Vary your hooks — NEVER start multiple videos with "Stop scrolling"

🚫 BANNED PHRASES (FAIL CONDITIONS)
❌ "Guaranteed approval"
❌ "Lock it in now"
❌ "Investment advice"
❌ "Will go up in value"
❌ Giving advice or guarantees
❌ "Stop scrolling" used repetitively (vary your hooks!)

✅ MANDATORY RULES (FAIL CONDITIONS)
✅ Always pronounce "OwnerFi.ai" clearly as "Owner-Fy dot A Eye"
✅ Always end with: "Prices and terms may change anytime"
✅ Always include CTA from approved pool
✅ Always include engagement question
✅ No boring corporate language

📱 OUTPUT FORMAT
Return both scripts in one structured response:

TITLE_30: [under 45 characters, 1 emoji]
SCRIPT_30: [spoken text only, 70–80 words, no emojis in spoken text]
CAPTION_30: [ready-to-post with emoji density 10-15%, 2–3 sentences + disclaimer + hashtags]

TITLE_15: [under 45 characters, 1 emoji]
SCRIPT_15: [spoken text only, 45–55 words, no emojis in spoken text]
CAPTION_15: [ready-to-post with emoji density 10-15%, 1–2 sentences + disclaimer + hashtags]

Hashtags: #OwnerFi #Homeownership #NoBanks #CreativeFinance #RealEstateDeals (plus city-specific tags)
Disclaimer: "This content is for education only — not financial advice. Prices and terms may change anytime."

💡 EXAMPLE OUTPUT

TITLE_30: 🏡 No Bank? Real Deal in Texas!
SCRIPT_30: Your rent just went up again — but what if I told you this costs LESS? This 3-bed home near Dallas is around 250K, and the seller's open to owner financing — no bank, no credit drama. Try finding anything close to this monthly — you can't. Visit Owner-Fy dot A Eye to see more homes near you — all free with agent contact info. Prices and terms may change anytime. Follow Abdullah for daily homeownership hacks. Would you take this deal or keep renting?
CAPTION_30: 🏡 Homes like this are out there — seller finance, flexible terms, real ownership without banks 💰 Visit OwnerFi.ai to find homes near you for free 🎯 Prices and terms may change anytime ⚠️ This content is for education only — not financial advice. #OwnerFi #Homeownership #NoBanks #TexasHomes #RealEstate

TITLE_15: 💥 No Bank Homes Under $250K?!
SCRIPT_15: Your credit score doesn't matter for this one — this 3-bed near Dallas might actually cost less than rent. It's around 250K and the seller's open to owner financing. See more free listings near you at Owner-Fy dot A Eye — prices and terms can change anytime. Follow Abdullah for real estate game. Would you live here if it meant no bank loan?
CAPTION_15: 💰 Browse real owner-finance homes for free on OwnerFi.ai 🏠 No banks, no catch ✨ Prices and terms may change anytime. This content is for education only. #OwnerFi #RealEstate #Homeownership #NoBankLoan #TexasDeals`;
}

/**
 * Build property input prompt for OpenAI
 */
function buildPropertyPrompt(property: PropertyListing): string {
  const price = formatCurrencyRounded(property.listPrice);
  const monthly = property.monthlyPayment > 0 ? formatCurrencyRounded(property.monthlyPayment) : 'contact seller';
  const down = property.downPaymentAmount > 0 ? formatCurrencyRounded(property.downPaymentAmount) : 'contact seller';
  const highlight = selectBestHighlight(property);

  return `Generate both 30-second and 15-second video scripts for this property:

PROPERTY DATA:
- City: ${property.city}, ${property.state}
- Price: ${price}
- Bedrooms: ${property.bedrooms}
- Bathrooms: ${property.bathrooms}
- Square Feet: ${property.squareFeet || 'Not specified'}
- Monthly Payment: ${monthly} (estimated)
- Down Payment: ${down} (estimated)
- Highlight: ${highlight}

Generate TITLE_30, SCRIPT_30, CAPTION_30, TITLE_15, SCRIPT_15, and CAPTION_15 following the format exactly.`;
}

/**
 * Parse OpenAI response into dual scripts
 */
function parsePropertyResponse(content: string, property: PropertyListing): DualPropertyVideoScripts {
  // Extract 30-second variant
  const title30Match = content.match(/TITLE_30:\s*(.+)/i);
  const script30Match = content.match(/SCRIPT_30:\s*(.+?)(?=\n\s*CAPTION_30|TITLE_15|$)/is);
  const caption30Match = content.match(/CAPTION_30:\s*(.+?)(?=\n\s*TITLE_15|SCRIPT_15|$)/is);

  // Extract 15-second variant
  const title15Match = content.match(/TITLE_15:\s*(.+)/i);
  const script15Match = content.match(/SCRIPT_15:\s*(.+?)(?=\n\s*CAPTION_15|$)/is);
  const caption15Match = content.match(/CAPTION_15:\s*(.+?)$/is);

  const variant_30: PropertyVideoScript = {
    title: (title30Match?.[1] || `🏡 Deal in ${property.city}`).trim().substring(0, 50),
    script: (script30Match?.[1] || generatePropertyScript(property).script).trim(),
    caption: (caption30Match?.[1] || generatePropertyScript(property).caption).trim(),
    hashtags: [] // Extracted from caption
  };

  const variant_15: PropertyVideoScript = {
    title: (title15Match?.[1] || `💥 ${property.city} Deal`).trim().substring(0, 50),
    script: (script15Match?.[1] || generateShortScript(property)).trim(),
    caption: (caption15Match?.[1] || generateShortCaption(property)).trim(),
    hashtags: []
  };

  return { variant_30, variant_15 };
}

/**
 * Generate short 15-second script (fallback)
 */
function generateShortScript(property: PropertyListing): string {
  const price = formatCurrencyRounded(property.listPrice);
  const city = property.city;
  const beds = property.bedrooms;

  const hooks = [
    `This costs less than your current rent —`,
    `Your credit score doesn't matter for this one —`,
    `They don't advertise these deals —`,
    `No bank approval needed for this —`,
    `Wait till you hear the monthly payment —`
  ];

  const hook = hooks[Math.floor(Math.random() * hooks.length)];

  return `${hook} this ${beds}-bed near ${city} might cost less than rent. It's around ${price} and the seller's open to owner financing. See more free listings near you at OwnerFi.ai — prices and terms can change anytime.`;
}

/**
 * Generate short caption (fallback)
 */
function generateShortCaption(property: PropertyListing): string {
  return `Browse real owner-finance homes for free on OwnerFi.ai. No banks, no catch. Prices and terms may change anytime. #OwnerFi #RealEstate #Homeownership #NoBankLoan`;
}
