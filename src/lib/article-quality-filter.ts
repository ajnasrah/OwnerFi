// AI Article Quality Filter
// Uses OpenAI to evaluate if an article is worth making a video about

import { fetchWithTimeout, retry, TIMEOUTS, rateLimiters, checkRateLimit } from './api-utils';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface QualityScore {
  score: number; // 0-100
  reasoning: string;
  shouldMakeVideo: boolean;
  redFlags?: string[];
  strengths?: string[];
}

/**
 * Evaluate article quality using AI
 * Returns a score and reasoning for whether to make a video
 */
export async function evaluateArticleQuality(
  title: string,
  content: string,
  category: 'carz' | 'ownerfi' | 'vassdistro' | 'gaza'
): Promise<QualityScore> {
  // Pre-check: Reject articles with insufficient content BEFORE calling OpenAI
  const contentLength = content?.trim().length || 0;

  if (contentLength < 100) {
    return {
      score: 0,
      reasoning: `Article has insufficient content (${contentLength} chars)`,
      shouldMakeVideo: false,
      redFlags: ['Insufficient content', 'Too short for video']
    };
  }

  if (contentLength < 200) {
    return {
      score: 30,
      reasoning: `Article content is very short (${contentLength} chars)`,
      shouldMakeVideo: false,
      redFlags: ['Short content', 'May lack substance']
    };
  }

  if (!OPENAI_API_KEY) {
    console.warn('⚠️  OpenAI API key not configured, skipping quality filter');
    return {
      score: 50,
      reasoning: 'Quality filter disabled - no API key',
      shouldMakeVideo: true
    };
  }

  try {
    const prompt = buildQualityPrompt(title, content, category);

    return await retry(
      async () => {
        const response = await fetchWithTimeout(
          'https://api.openai.com/v1/chat/completions',
          {
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
                  content: prompt.system
                },
                {
                  role: 'user',
                  content: prompt.user
                }
              ],
              temperature: 0.3, // Low temperature for consistent evaluation
              max_tokens: 300
            })
          },
          TIMEOUTS.OPENAI_GENERATE
        );

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const result = data.choices[0]?.message?.content?.trim() || '';

        return parseQualityResponse(result);
      },
      {
        maxAttempts: 2,
        backoff: 'exponential',
        onRetry: (attempt, error) => {
          console.log(`Quality filter retry ${attempt}:`, error.message);
        }
      }
    );
  } catch (error) {
    console.error('❌ Error evaluating article quality:', error);
    // On error, allow the article through (fail open)
    return {
      score: 50,
      reasoning: 'Error during evaluation',
      shouldMakeVideo: true
    };
  }
}

/**
 * Build the AI prompt for quality evaluation
 */
function buildQualityPrompt(title: string, content: string, category: 'carz' | 'ownerfi' | 'vassdistro' | 'gaza'): {
  system: string;
  user: string;
} {
  const categoryContext = category === 'gaza'
    ? `This is for a PRO-GAZA humanitarian news channel supporting Palestine and Gaza civilians.

       TARGET AUDIENCE:
       - People who support Gaza and Palestine
       - Pro-Palestine advocates and activists
       - Humanitarian donors interested in helping Gaza
       - Those concerned about the Gaza humanitarian crisis
       - Social justice advocates

       RATE HIGHLY (80-100) - PRO-GAZA CONTENT:
       - Articles sympathetic to Palestinian civilians and their suffering
       - Humanitarian crisis coverage showing the human cost in Gaza
       - Stories about aid workers, relief efforts, and donations helping Gaza
       - Coverage of protests and movements supporting Palestine worldwide
       - Articles critical of actions harming Gaza civilians
       - Personal stories of Gaza families, children, and survivors
       - Coverage of international support for Gaza/Palestine
       - Breaking news about Gaza humanitarian situation
       - Updates on ceasefire efforts and peace negotiations

       RATE POORLY (0-40) - NOT PRO-GAZA:
       - Articles with anti-Palestine or anti-Gaza framing
       - Pro-occupation perspectives or justifications
       - Articles that minimize civilian suffering in Gaza
       - Content that dehumanizes Palestinians
       - Propaganda against humanitarian aid to Gaza
       - Articles completely unrelated to Gaza/Palestine

       NEUTRAL (50-70):
       - Balanced reporting without clear humanitarian focus
       - General Middle East news not specifically about Gaza
       - Technical/political analysis without human angle

       The goal is to amplify voices that support Gaza civilians and the humanitarian cause.
       Every video should make viewers want to help Gaza.`
    : category === 'carz'
    ? `This is for a CARZ INC video channel targeting 30-year-old adults interested in cars and automotive news.

       TARGET AUDIENCE (30-year-olds):
       - Young professionals considering their next car purchase
       - Interested in practical value, not just luxury/exotics
       - Care about EV transition, gas prices, reliability
       - Use TikTok/Instagram for quick, actionable car info
       - Want honest reviews, not corporate press releases

       GOOD CONTENT (will watch & enjoy):
       - New affordable EVs under $40k, best value cars, hidden gems
       - "Should you buy now or wait?" market timing advice
       - Real-world test drives, honest pros/cons
       - Gas vs EV cost comparisons, maintenance hacks
       - Recalls that actually matter, price drops on popular models
       - Tech features that are actually useful (not gimmicks)

       BAD CONTENT (will scroll past):
       - $200k+ supercars, celebrity car collections
       - Generic "top 10" listicles with no new info
       - Pure brand advertisements disguised as news
       - Luxury cars they can't afford
       - Overly technical deep-dives on obscure models`
    : category === 'vassdistro'
    ? `This is for a VASS DISTRO channel targeting vape shop owners and distributors (30-40 year old entrepreneurs).

       TARGET AUDIENCE:
       - Vape shop owners managing margins and inventory
       - Distributors looking for competitive advantages
       - Concerned about regulations impacting their business
       - Need actionable wholesale/B2B insights
       - Want insider info to stay profitable

       GOOD CONTENT (will watch & enjoy):
       - FDA regulations affecting inventory/sales
       - New wholesale price drops, margin opportunities
       - Brand approvals/bans with business impact
       - Market trends affecting retail demand
       - Supplier advantages, bulk deal alerts
       - Compliance tips to avoid fines

       BAD CONTENT (will scroll past):
       - Consumer vaping tips (not B2B)
       - Generic health debates
       - Individual product reviews (not wholesale-focused)
       - Content irrelevant to shop owners/distributors`
    : `This is for an OWNERFI video channel targeting 30-year-old adults navigating homeownership and housing decisions.

       TARGET AUDIENCE (30-year-olds):
       - First-time homebuyers trying to enter the market
       - Recent homeowners (1-3 years) learning the ropes
       - Renters considering buying vs renting
       - Care about saving money, building equity
       - Use social media for financial education
       - Want practical, actionable advice

       GOOD CONTENT (will watch & enjoy):
       - Mortgage rate changes affecting affordability
       - "Rent vs buy" math for current market
       - Creative financing options (owner financing, down payment assistance)
       - Money-saving home hacks, tax benefits
       - Market timing: "Should I buy now or wait?"
       - First-time buyer programs, hidden costs to expect
       - Home insurance/property tax saving tips
       - Real market data (not real estate agent fluff)

       BAD CONTENT (will scroll past):
       - Luxury mansion tours, celebrity homes
       - Generic Pinterest-style decorating tips
       - Real estate agent promotional content
       - Content for experienced investors (not first-timers)
       - Overly complex financial jargon
       - Clickbait with no actionable takeaways`;

  return {
    system: `You are an expert content curator evaluating articles for viral short-form video content on TikTok and Instagram.

${categoryContext}

YOUR TASK: Rate this article based on how likely a 30-year-old adult would stop scrolling, watch the video, and find it valuable.

Ask yourself:
- Would a 30-year-old care about this RIGHT NOW?
- Is it actionable or does it help them make a decision?
- Is it relevant to their life stage (buying cars/homes, managing money)?
- Would they share this with friends or save it?
- Or would they immediately scroll past?

Evaluate the article and respond ONLY with this exact format:
SCORE: [0-100 number]
REASONING: [one sentence from a 30-year-old's perspective]
SHOULD_MAKE_VIDEO: [YES or NO]
RED_FLAGS: [comma-separated issues, or NONE]
STRENGTHS: [comma-separated positive points, or NONE]

Scoring criteria (from a 30-year-old viewer's perspective):
90-100: "This is exactly what I needed!" (immediately actionable, affects my wallet/decisions)
70-89: "Actually useful, I'm watching this" (relevant, informative, shareable)
50-69: "Mildly interesting but not for me" (okay info but not compelling)
30-49: "Why did this show up on my feed?" (generic, boring, not relatable)
0-29: "Instant scroll" (clickbait, irrelevant, luxury flex, or just a headline)

IMPORTANT FILTERS:
- Articles with less than 200 characters = score below 50 (not enough substance)
- Headlines/snippets without real content = score 0-29 (no value)
- Content not relevant to 30-year-olds' financial/lifestyle decisions = score below 50
- Luxury/celebrity content with no practical value = score 0-29
- Generic advice found anywhere = score 30-49

ENGAGEMENT FACTORS (boost score):
+ Saves money or time
+ Helps with a major life decision
+ Timely/breaking news that affects them
+ Practical how-to or insider tip
+ Data-driven (not just opinions)

SCROLL TRIGGERS (lower score):
- Feels like an ad
- Too complicated/technical
- Not relatable to average 30-year-old
- Clickbait headline with no substance
- Luxury content they can't afford

Threshold: Only recommend videos for scores 70+ (content a 30-year-old would genuinely watch).`,

    user: `Title: ${title}

Content: ${content.substring(0, 1500)}

Evaluate this article.`
  };
}

/**
 * Parse AI response into QualityScore
 */
function parseQualityResponse(response: string): QualityScore {
  const scoreMatch = response.match(/SCORE:\s*(\d+)/i);
  const reasoningMatch = response.match(/REASONING:\s*(.+?)(?=\n|$)/i);
  const shouldMakeMatch = response.match(/SHOULD_MAKE_VIDEO:\s*(YES|NO)/i);
  const redFlagsMatch = response.match(/RED_FLAGS:\s*(.+?)(?=\n|$)/i);
  const strengthsMatch = response.match(/STRENGTHS:\s*(.+?)(?=\n|$)/i);

  const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided';
  const shouldMakeVideo = shouldMakeMatch ? shouldMakeMatch[1].toUpperCase() === 'YES' : score >= 70;

  const redFlagsText = redFlagsMatch ? redFlagsMatch[1].trim() : '';
  const redFlags = redFlagsText && redFlagsText !== 'NONE'
    ? redFlagsText.split(',').map(s => s.trim())
    : undefined;

  const strengthsText = strengthsMatch ? strengthsMatch[1].trim() : '';
  const strengths = strengthsText && strengthsText !== 'NONE'
    ? strengthsText.split(',').map(s => s.trim())
    : undefined;

  return {
    score,
    reasoning,
    shouldMakeVideo,
    redFlags,
    strengths
  };
}

/**
 * Batch evaluate multiple articles
 *
 * COST OPTIMIZATION:
 * - Uses GPT-4o-mini (~$0.00015 per article)
 * - Processes in concurrent batches to reduce total time
 * - Default: 3 concurrent, can be increased to 10-15 for faster processing
 * - Typical daily cost with 90 feeds: ~$5-10/month
 *
 * @param articles - Array of articles to evaluate
 * @param maxConcurrent - Number of concurrent API calls (default: 3, recommended: 10 for batch jobs)
 */
export async function evaluateArticlesBatch(
  articles: Array<{ title: string; content: string; category: 'carz' | 'ownerfi' | 'vassdistro' | 'gaza' }>,
  maxConcurrent: number = 15 // PERFORMANCE FIX: Increased from 3 to 15 for 5x faster processing
): Promise<QualityScore[]> {
  const results: QualityScore[] = [];

  // Process in batches to avoid rate limits
  for (let i = 0; i < articles.length; i += maxConcurrent) {
    const batch = articles.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(article => evaluateArticleQuality(article.title, article.content, article.category))
    );
    results.push(...batchResults);

    // Small delay between batches to respect rate limits
    if (i + maxConcurrent < articles.length) {
      await new Promise(resolve => setTimeout(resolve, 100)); // PERFORMANCE FIX: Reduced from 500ms to 100ms
    }
  }

  return results;
}
