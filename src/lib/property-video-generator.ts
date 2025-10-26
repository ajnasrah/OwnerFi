// Property Showcase Video Generator
// Automatically creates videos for owner-financed properties < $15k down
// A/B Testing: Generates both 30-sec and 15-sec variants

import { PropertyListing } from './property-schema';
import { calculatePropertyFinancials } from './property-calculations';

export interface PropertyVideoScript {
  script: string;
  caption: string;
  title: string;
  hashtags: string[];
}

export interface DualPropertyVideoScripts {
  variant_30: PropertyVideoScript;
  variant_15: PropertyVideoScript;
}

/**
 * Generate video script for a property listing using OpenAI
 * Returns both 30-sec and 15-sec variants for A/B testing
 */
export async function generatePropertyScriptWithAI(property: PropertyListing, openaiApiKey: string): Promise<DualPropertyVideoScripts> {
  const prompt = buildPropertyPrompt(property);

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
          content: getPropertySystemPrompt()
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

  return parsePropertyResponse(content, property);
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
  const downPayment = formatCurrencyRounded(financials.downPaymentAmount);
  const monthlyPayment = formatCurrencyRounded(financials.monthlyPayment);
  const listPrice = formatCurrencyRounded(property.listPrice);
  const sqft = property.squareFeet ? formatNumber(property.squareFeet) : null;

  // Get best highlight
  const highlight = selectBestHighlight(property);

  // Build script with legal disclaimers (30 seconds max = ~75 words)
  const script = `We just found this Owner Finance deal for sale!

${property.address} in ${property.city}, ${property.state}

${property.bedrooms} bed, ${property.bathrooms} bath${sqft ? `, ${sqft} square feet` : ''}

The down payment is estimated to be around ${downPayment}. Monthly payment estimated before taxes and insurance is around ${monthlyPayment}.

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
  const downPayment = formatCurrencyRounded(property.downPaymentAmount);
  const monthlyPayment = formatCurrencyRounded(property.monthlyPayment);
  const highlight = selectBestHighlight(property);

  return `🏡 New Owner Finance Deal in ${property.city}, ${property.state}!

📍 ${property.address}
💰 Est. ${downPayment} down
🏠 ${property.bedrooms}BD | ${property.bathrooms}BA${property.squareFeet ? ` | ${formatNumber(property.squareFeet)} sq ft` : ''}
💵 Est. ${monthlyPayment}/mo (before taxes/insurance)

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
 * Generate HeyGen-compatible video request
 */
export function buildPropertyVideoRequest(
  property: PropertyListing,
  script: string,
  avatarId: string = '31c6b2b6306b47a2ba3572a23be09dbc',
  voiceId: string = '9070a6c2dbd54c10bb111dc8c655bff7'
) {
  // Get best property image (prefer exterior shots)
  const backgroundImage = selectBestPropertyImage(property);

  return {
    video_inputs: [{
      character: {
        type: 'talking_photo',
        talking_photo_id: avatarId,
        scale: 0.5, // Larger so HeyGen renders it (was 0.35 - too small!)
        talking_photo_style: 'circle', // Circular frame
        talking_style: 'expressive',
        offset: {
          x: 0.60, // Bottom-right position
          y: 0.72  // Safe from crop
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
      }
    }],
    dimension: { width: 1080, height: 1920 },
    title: `${property.address} - Owner Finance`,
    callback_id: `property_${property.id}`
  };
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
 */
export function validatePropertyForVideo(property: PropertyListing): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!property.address) errors.push('Missing address');
  if (!property.city) errors.push('Missing city');
  if (!property.state) errors.push('Missing state');
  if (property.bedrooms === undefined || property.bedrooms === null) errors.push('Missing bedrooms');
  if (property.bathrooms === undefined || property.bathrooms === null) errors.push('Missing bathrooms');

  // Check either downPaymentAmount OR downPaymentPercent exists (0 is valid)
  if ((property.downPaymentAmount === undefined || property.downPaymentAmount === null) && !property.downPaymentPercent) {
    errors.push('Missing down payment (need either amount or percent)');
  }

  if (!property.monthlyPayment) errors.push('Missing monthly payment');
  if (!property.interestRate) errors.push('Missing interest rate');
  if (!property.termYears) errors.push('Missing term years');
  if (!property.imageUrls || property.imageUrls.length === 0) errors.push('Missing images');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get system prompt for OpenAI property video generation
 * OWNERFI DUAL-MODE DEAL VIDEO SYSTEM PROMPT
 */
function getPropertySystemPrompt(): string {
  return `ROLE:
You are the viral video content generator for OwnerFi.ai, a platform that helps people discover homes they can buy without banks — through seller financing and agent-listed creative deals.
Your job is to turn property data into two punchy, legally safe scripts for short-form videos (one 30 sec and one 15 sec).

🎯 INPUT DATA (per listing)
Each run will include fields like:
- city, state
- price
- bedrooms, bathrooms, sqft
- monthly_payment (estimated)
- highlight (e.g. seller financing, rent-to-own, flexible terms)

Use this info naturally in the scripts without sounding like a robot.

🏡 MODE 1 – 30 SECOND "DEAL EXPLAINER"

STRUCTURE (≈70-80 words):
0-3 sec – Hook: Stop-scroll statement
"This home might be cheaper than your rent — and no bank's involved."

3-15 sec – Deal summary:
Quick stats — price range, city, and key highlight
"Three-bed in Dallas around $250K, and the seller's open to owner financing."

15-25 sec – Insight:
Why it's interesting or smart
"Try finding anything close to this monthly — you can't."

25-30 sec – CTA + Disclaimer:
"Visit OwnerFi.ai to see more homes near you — all free with agent contact info. Prices and terms may change anytime."

TONE: Real, confident, fast, trustworthy.
NO: guarantees, promises, or investment talk.

⚡ MODE 2 – 15 SECOND "DEAL DROP"

STRUCTURE (≈45-55 words):
0-3 sec – Hook:
"Stop scrolling — this home might be cheaper than rent."

3-10 sec – Quick value:
"3-bed in Austin around $240K, seller's open to financing."

10-15 sec – CTA + Disclaimer:
"See more free listings near you at OwnerFi.ai — prices and terms can change anytime."

TONE: High energy, conversational, raw — like a friend dropping insider info fast.

🧠 VOICE & STYLE RULES
- Authentic, confident, street-smart tone
- 5th-grade clarity
- No corporate language
- Avoid "I think", "maybe", or "you should"
- Always finish with the legal line: "Prices and terms may change anytime."

🚫 BANNED PHRASES
❌ "Guaranteed approval"
❌ "Lock it in now"
❌ "Investment advice"
❌ "Will go up in value"

✅ OUTPUT FORMAT
Return both scripts in one structured response:

TITLE_30: [under 45 characters]
SCRIPT_30: [spoken text only]
CAPTION_30: [2–3 sentences + disclaimer + 3–5 hashtags]

TITLE_15: [under 45 characters]
SCRIPT_15: [spoken text only]
CAPTION_15: [1–2 sentences + disclaimer + 3–5 hashtags]

💡 EXAMPLE OUTPUT

TITLE_30: 🏡 No Bank? Real Deal in Texas!
SCRIPT_30: "Crazy part? This 3-bed home near Dallas might cost less than rent. It's around $250K, and the seller's open to owner financing — no bank, no credit drama. You could own instead of rent. Visit OwnerFi.ai to see more homes near you — all free with agent contact info. Prices and terms may change anytime."
CAPTION_30: Homes like this are out there — seller finance, flexible terms, real ownership without banks. Visit OwnerFi.ai to find homes near you for free. Prices and terms may change anytime. #OwnerFi #Homeownership #NoBankLoan #TexasHomes #RealEstate

TITLE_15: 💥 No Bank Homes Under $250K?!
SCRIPT_15: "Stop scrolling — this 3-bed near Dallas might actually cost less than rent. It's around $250K and the seller's open to owner financing. See more free listings near you at OwnerFi.ai — prices and terms can change anytime."
CAPTION_15: Browse real owner-finance homes for free on OwnerFi.ai. No banks, no catch. Prices and terms may change anytime. #OwnerFi #RealEstate #Homeownership #NoBankLoan #TexasDeals`;
}

/**
 * Build property input prompt for OpenAI
 */
function buildPropertyPrompt(property: PropertyListing): string {
  const price = formatCurrencyRounded(property.listPrice);
  const monthly = formatCurrencyRounded(property.monthlyPayment);
  const down = formatCurrencyRounded(property.downPaymentAmount);
  const highlight = selectBestHighlight(property);

  return `Generate both 30-second and 15-second video scripts for this property:

PROPERTY DATA:
- City: ${property.city}, ${property.state}
- Price: ${price}
- Bedrooms: ${property.bedrooms}
- Bathrooms: ${property.bathrooms}
- Square Feet: ${property.squareFeet || 'Not specified'}
- Monthly Payment: ${monthly} (estimated before taxes/insurance)
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
  const script30Match = content.match(/SCRIPT_30:\s*"?([^"]+)"?\s*(?=CAPTION_30|TITLE_15|$)/is);
  const caption30Match = content.match(/CAPTION_30:\s*(.+?)(?=TITLE_15|SCRIPT_15|$)/is);

  // Extract 15-second variant
  const title15Match = content.match(/TITLE_15:\s*(.+)/i);
  const script15Match = content.match(/SCRIPT_15:\s*"?([^"]+)"?\s*(?=CAPTION_15|$)/is);
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

  return `Stop scrolling — this ${beds}-bed near ${city} might cost less than rent. It's around ${price} and the seller's open to owner financing. See more free listings near you at OwnerFi.ai — prices and terms can change anytime.`;
}

/**
 * Generate short caption (fallback)
 */
function generateShortCaption(property: PropertyListing): string {
  return `Browse real owner-finance homes for free on OwnerFi.ai. No banks, no catch. Prices and terms may change anytime. #OwnerFi #RealEstate #Homeownership #NoBankLoan`;
}
