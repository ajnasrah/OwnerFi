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
  category: 'carz' | 'ownerfi'
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
function buildQualityPrompt(title: string, content: string, category: 'carz' | 'ownerfi'): {
  system: string;
  user: string;
} {
  const categoryContext = category === 'carz'
    ? `This is for a CARZ INC video channel focused on car reviews, automotive news, and vehicle market updates.
       GOOD CONTENT: New car releases, test drives, buying guides, EV news, industry changes, price drops, recalls, comparisons.
       BAD CONTENT: Generic listicles, celebrity car collections, clickbait, opinion pieces without substance, pure advertisements.`
    : `This is for an OWNERFI video channel focused on helping homeowners save money and stay informed about housing.
       GOOD CONTENT: Mortgage rate changes, housing market trends, money-saving tips, new homeowner tools, tax benefits, insurance tips, market predictions.
       BAD CONTENT: Generic advice, celebrity homes, pure real estate listings, clickbait, content irrelevant to current homeowners.`;

  return {
    system: `You are an expert content curator evaluating articles for viral short-form video content.

${categoryContext}

Evaluate the article and respond ONLY with this exact format:
SCORE: [0-100 number]
REASONING: [one sentence explanation]
SHOULD_MAKE_VIDEO: [YES or NO]
RED_FLAGS: [comma-separated issues, or NONE]
STRENGTHS: [comma-separated positive points, or NONE]

Scoring criteria:
90-100: MUST-MAKE content (breaking news, major announcements, highly actionable, substantive content)
70-89: Great content (interesting, informative, good engagement potential, sufficient detail)
50-69: Decent content (okay but not exciting, may lack depth)
30-49: Weak content (generic, boring, low value, or insufficient detail)
0-29: Reject (clickbait, ads, irrelevant, poor quality, or very short/superficial)

IMPORTANT:
- Articles with less than 200 characters should automatically score below 50
- Articles that are just headlines or snippets without substance should score 0-29
- Only recommend videos for scores 70+ with substantive, detailed content

Threshold: Only recommend videos for scores 70+.`,

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
  articles: Array<{ title: string; content: string; category: 'carz' | 'ownerfi' | 'vassdistro' }>,
  maxConcurrent: number = 3
): Promise<QualityScore[]> {
  const results: QualityScore[] = [];

  // Process in batches to avoid rate limits
  for (let i = 0; i < articles.length; i += maxConcurrent) {
    const batch = articles.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(article => evaluateArticleQuality(article.title, article.content, article.category as 'carz' | 'ownerfi'))
    );
    results.push(...batchResults);

    // Small delay between batches to respect rate limits
    if (i + maxConcurrent < articles.length) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Reduced from 1000ms for faster processing
    }
  }

  return results;
}
