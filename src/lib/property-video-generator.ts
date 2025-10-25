// Property Showcase Video Generator
// Automatically creates videos for owner-financed properties < $15k down

import { PropertyListing } from './property-schema';

export interface PropertyVideoScript {
  script: string;
  caption: string;
  title: string;
  hashtags: string[];
}

/**
 * Generate video script for a property listing
 */
export function generatePropertyScript(property: PropertyListing): PropertyVideoScript {
  // Format numbers
  const downPayment = formatCurrency(property.downPaymentAmount);
  const monthlyPayment = formatCurrency(property.monthlyPayment);
  const listPrice = formatCurrency(property.listPrice);
  const sqft = property.squareFeet ? formatNumber(property.squareFeet) : null;

  // Get best highlight
  const highlight = selectBestHighlight(property);

  // Build script with legal disclaimers
  const script = `We just found this Owner Finance deal for sale!

${property.address} in ${property.city}, ${property.state}

${property.bedrooms} bed, ${property.bathrooms} bath${sqft ? `, ${sqft} square feet` : ''}

Only ${downPayment} down
${monthlyPayment} per month
${property.interestRate}% interest for ${property.termYears} years

${highlight}

If you would like to see other owner finance deals for sale in your area, visit ownerfi.ai and create a free account. You can see the different deals our team found listed on the market.

This is not financial or legal advice. We are a marketing platform connecting buyers with owner-financed properties. All deals are subject to seller approval and terms may change.`;

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
  const downPayment = formatCurrency(property.downPaymentAmount);
  const monthlyPayment = formatCurrency(property.monthlyPayment);
  const highlight = selectBestHighlight(property);

  return `🏡 New Owner Finance Deal in ${property.city}, ${property.state}!

💰 Only ${downPayment} down
🏠 ${property.bedrooms}BD | ${property.bathrooms}BA${property.squareFeet ? ` | ${formatNumber(property.squareFeet)} sq ft` : ''}
💵 ${monthlyPayment}/mo at ${property.interestRate}%

${highlight}

We connect buyers with owner-financed homes. This is a marketing platform - not financial/legal advice. All deals subject to seller approval. Always consult professionals before purchasing.

See more deals at ownerfi.ai`;
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
 * Generate hashtags for property
 */
function generateHashtags(property: PropertyListing): string[] {
  const baseHashtags = [
    'OwnerFinancing',
    'RealEstate',
    'HomeOwnership',
    'OwnerFi'
  ];

  // Add location hashtags
  const cityTag = property.city.replace(/\s+/g, '');
  const stateTag = property.state;

  baseHashtags.push(`${cityTag}${stateTag}`);
  baseHashtags.push(`${cityTag}RealEstate`);

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

  return baseHashtags.slice(0, 7); // Max 7 hashtags
}

/**
 * Check if property is eligible for video generation
 */
export function isEligibleForVideo(property: PropertyListing): boolean {
  return (
    property.downPaymentAmount < 15000 &&
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
        scale: 0.6, // Smaller - appears as overlay
        talking_photo_style: 'circle', // Circular frame
        talking_style: 'expressive'
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
  if (!property.bedrooms) errors.push('Missing bedrooms');
  if (!property.bathrooms) errors.push('Missing bathrooms');
  if (!property.downPaymentAmount) errors.push('Missing down payment');
  if (!property.monthlyPayment) errors.push('Missing monthly payment');
  if (!property.interestRate) errors.push('Missing interest rate');
  if (!property.termYears) errors.push('Missing term years');
  if (!property.imageUrls || property.imageUrls.length === 0) errors.push('Missing images');

  return {
    valid: errors.length === 0,
    errors
  };
}
