// Copyright Safety System
// Ensures all generated content is transformative and doesn't infringe copyright

export interface CopyrightSafetyConfig {
  // Content transformation rules
  minTransformationScore: number; // 0-100, how much content must differ
  requireOriginalCommentary: boolean; // Must add original insights
  prohibitDirectQuotes: boolean; // No verbatim copying

  // Attribution requirements
  requireSourceCredit: boolean; // Must credit source
  allowedUseTypes: ('commentary' | 'criticism' | 'news' | 'educational')[];

  // Content restrictions
  maxOriginalContentPercent: number; // Max % of original article to use
  requireFactualTransformation: boolean; // Must present facts differently
}

const DEFAULT_CONFIG: CopyrightSafetyConfig = {
  minTransformationScore: 80, // Highly transformative
  requireOriginalCommentary: true,
  prohibitDirectQuotes: true,
  requireSourceCredit: true,
  allowedUseTypes: ['commentary', 'news', 'educational'],
  maxOriginalContentPercent: 30, // Only 30% max from original
  requireFactualTransformation: true
};

/**
 * Copyright-safe content transformation guidelines
 */
export const TRANSFORMATION_RULES = {
  // What makes content transformative (Fair Use)
  TRANSFORMATIVE_ELEMENTS: [
    'Add original analysis and commentary',
    'Present information in a new context',
    'Create educational value beyond the original',
    'Add your own insights and perspectives',
    'Explain implications and significance',
    'Connect to broader trends or context'
  ],

  // What to AVOID (copyright infringement)
  PROHIBITED_PRACTICES: [
    '❌ Direct copying of article text verbatim',
    '❌ Reading the article word-for-word',
    '❌ Using copyrighted images without permission',
    '❌ Reproducing substantial portions unchanged',
    '❌ Substituting for the original article',
    '❌ Competing with the original source'
  ],

  // Safe practices (Fair Use protection)
  SAFE_PRACTICES: [
    '✅ Summarize facts in your own words',
    '✅ Add original commentary and analysis',
    '✅ Focus on factual information (not creative expression)',
    '✅ Use minimal necessary content',
    '✅ Always credit the source',
    '✅ Transform the purpose (news → educational commentary)'
  ]
};

/**
 * Generate copyright-safe instructions for AI
 */
export function getCopyrightSafePromptInstructions(): string {
  return `
CRITICAL COPYRIGHT RULES (MUST FOLLOW):

1. TRANSFORMATION REQUIREMENT:
   - DO NOT copy or paraphrase the original article directly
   - Extract ONLY the core FACTS (who, what, when, where, why)
   - Present these facts in a COMPLETELY NEW WAY with your own words and structure
   - Add ORIGINAL commentary, analysis, and perspective

2. WHAT YOU CAN USE (Facts are not copyrighted):
   ✅ Basic facts (prices, dates, specifications, events)
   ✅ Public information and statistics
   ✅ General concepts and ideas
   ✅ Your own analysis of these facts

3. WHAT YOU CANNOT USE:
   ❌ Direct quotes or near-verbatim copying
   ❌ Creative descriptions from the article
   ❌ The author's unique perspective or analysis
   ❌ Substantial portions of the original text
   ❌ The article's structure or organization

4. SAFE TRANSFORMATION EXAMPLE:

   ORIGINAL (COPYRIGHTED):
   "The sleek, aerodynamic Tesla Model 3 glides effortlessly through city streets,
   its whisper-quiet electric motors delivering instant torque that pins you to
   your seat with a satisfying surge of acceleration."

   YOUR VERSION (FACTS + ORIGINAL COMMENTARY):
   "Did you know Tesla just slashed Model 3 prices by $5,000? Here's what this
   means for YOU! The base model now starts at $40,000 - that's crazy! With
   0-60 in under 5 seconds and 272 miles of range, this could shake up the
   entire EV market. Let's break down why this is HUGE..."

5. ATTRIBUTION:
   - Always mention the source at the beginning: "According to [Source Name]..."
   - Make it clear you're commenting ON the news, not replacing the article

6. PURPOSE:
   - Your video is COMMENTARY and EDUCATION
   - You're adding NEW value through analysis and perspective
   - You're NOT a substitute for reading the original article

This is Fair Use under US Copyright Law when done correctly.
`;
}

/**
 * Validate content for copyright safety
 */
export function validateCopyrightSafety(
  originalArticle: string,
  generatedScript: string,
  config: CopyrightSafetyConfig = DEFAULT_CONFIG
): {
  safe: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // Check 1: Direct text copying (most critical)
  const copyingScore = checkTextCopying(originalArticle, generatedScript);
  if (copyingScore < 80) {
    issues.push('⚠️ Detected potential direct copying from original article');
    score -= 30;
    recommendations.push('Rewrite using only factual information in your own words');
  }

  // Check 2: Original commentary requirement
  if (config.requireOriginalCommentary) {
    const hasCommentary = checkForOriginalCommentary(generatedScript);
    if (!hasCommentary) {
      issues.push('⚠️ Missing original commentary and analysis');
      score -= 20;
      recommendations.push('Add your own insights, opinions, and analysis');
    }
  }

  // Check 3: Source attribution
  if (config.requireSourceCredit) {
    const hasAttribution = checkAttribution(generatedScript);
    if (!hasAttribution) {
      issues.push('⚠️ Missing source attribution');
      score -= 15;
      recommendations.push('Add "According to [Source]" at the beginning');
    }
  }

  // Check 4: Transformation indicators
  const transformationIndicators = [
    /let me break down/i,
    /here's what (this|that) means/i,
    /why (is this|this is) important/i,
    /here's the crazy part/i,
    /what does this mean for you/i,
    /let's talk about/i,
    /in my opinion/i,
    /here's the thing/i
  ];

  const hasTransformation = transformationIndicators.some(pattern =>
    pattern.test(generatedScript)
  );

  if (!hasTransformation) {
    issues.push('⚠️ Low transformation - needs more original perspective');
    score -= 15;
    recommendations.push('Add phrases that show your unique analysis and commentary');
  }

  const safe = issues.length === 0 && score >= config.minTransformationScore;

  return {
    safe,
    score,
    issues,
    recommendations
  };
}

/**
 * Check for direct text copying
 */
function checkTextCopying(original: string, generated: string): number {
  // Simple similarity check - in production, use more sophisticated algorithms
  const originalWords = original.toLowerCase().split(/\s+/).slice(0, 200);
  const generatedWords = generated.toLowerCase().split(/\s+/);

  let matchingPhrases = 0;
  const phraseLength = 5; // Check for 5-word phrases

  for (let i = 0; i < originalWords.length - phraseLength; i++) {
    const phrase = originalWords.slice(i, i + phraseLength).join(' ');
    if (generated.toLowerCase().includes(phrase)) {
      matchingPhrases++;
    }
  }

  const similarity = (matchingPhrases / (originalWords.length - phraseLength)) * 100;
  return Math.max(0, 100 - similarity * 2); // Score decreases with similarity
}

/**
 * Check for original commentary indicators
 */
function checkForOriginalCommentary(script: string): boolean {
  const commentaryIndicators = [
    /let me/i,
    /i think/i,
    /in my opinion/i,
    /here's what/i,
    /what this means/i,
    /why this matters/i,
    /let's break down/i,
    /here's the thing/i,
    /you won't believe/i,
    /crazy part is/i,
    /game changer/i
  ];

  return commentaryIndicators.some(pattern => pattern.test(script));
}

/**
 * Check for source attribution
 */
function checkAttribution(script: string): boolean {
  const attributionPatterns = [
    /according to/i,
    /reports? (from|that)/i,
    /via /i,
    /source:/i,
    /(motor1|edmunds|housingwire|zillow|realtor|redfin)/i
  ];

  return attributionPatterns.some(pattern => pattern.test(script));
}

/**
 * Get source attribution text
 */
export function generateAttribution(sourceName: string, sourceUrl?: string): string {
  return `According to ${sourceName}${sourceUrl ? ` (link in description)` : ''}`;
}

/**
 * Copyright safety checklist for manual review
 */
export const COPYRIGHT_CHECKLIST = {
  beforePublishing: [
    '☐ Script uses facts only, not creative descriptions',
    '☐ Added substantial original commentary',
    '☐ Source is clearly credited',
    '☐ Video adds new value (not just summary)',
    '☐ Would not substitute for reading original',
    '☐ Transformative purpose (commentary/education)',
    '☐ Uses minimal necessary content',
    '☐ No direct quotes without attribution'
  ],

  fairUseFactors: [
    '1. Purpose: Commentary/Education (✓ Transformative)',
    '2. Nature: News/Factual (✓ Fair Use favored)',
    '3. Amount: Facts only, minimal use (✓ Limited)',
    '4. Effect: Drives traffic to source (✓ No substitute)'
  ]
};
