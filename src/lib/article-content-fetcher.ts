// Article Content Fetcher - Extract full article text from URLs
// Uses Mozilla Readability to parse article content from HTML

import { fetchWithTimeout, TIMEOUTS } from './api-utils';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export interface ArticleContent {
  title: string;
  content: string;
  textContent: string;
  length: number;
  excerpt: string;
  byline?: string;
  siteName?: string;
}

/**
 * Fetch and extract full article content from a URL
 * Uses Mozilla Readability for accurate content extraction
 */
export async function fetchFullArticleContent(url: string): Promise<ArticleContent | null> {
  try {
    console.log(`📄 Fetching full content from: ${url}`);

    // Fetch the HTML
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OwnerFiBot/1.0; +https://ownerfi.ai)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      },
      TIMEOUTS.WEB_SCRAPE || 15000
    );

    if (!response.ok) {
      console.error(`❌ Failed to fetch article: HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Parse with JSDOM
    const dom = new JSDOM(html, { url });

    // Extract article using Readability
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      console.error('❌ Readability failed to extract article content');
      return null;
    }

    // Clean up content - remove extra whitespace
    const cleanContent = article.textContent
      .replace(/\s+/g, ' ')
      .trim();

    console.log(`✅ Extracted ${cleanContent.length} chars from article`);

    return {
      title: article.title,
      content: article.content, // HTML content
      textContent: cleanContent, // Plain text
      length: cleanContent.length,
      excerpt: article.excerpt || cleanContent.substring(0, 200),
      byline: article.byline || undefined,
      siteName: article.siteName || undefined
    };

  } catch (error) {
    console.error(`❌ Error fetching article content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * Check if content is sufficient for video generation
 */
export function hassufficientContent(content: string, minLength: number = 200): boolean {
  return content && content.trim().length >= minLength;
}

/**
 * Extract the best available content from RSS item + optional web fetch
 */
export async function getBestAvailableContent(
  rssContent: string,
  rssDescription: string,
  articleUrl: string,
  minLength: number = 200
): Promise<string> {
  // First check if RSS content is sufficient
  const rssFullContent = rssContent || rssDescription || '';

  if (hassufficientContent(rssFullContent, minLength)) {
    console.log(`✅ RSS content sufficient (${rssFullContent.length} chars)`);
    return rssFullContent;
  }

  // If RSS content is insufficient, fetch from URL
  console.log(`⚠️  RSS content too short (${rssFullContent.length} chars), fetching from URL...`);

  const webContent = await fetchFullArticleContent(articleUrl);

  if (webContent && hassufficientContent(webContent.textContent, minLength)) {
    console.log(`✅ Web fetch successful (${webContent.textContent.length} chars)`);
    return webContent.textContent;
  }

  // Fallback to whatever we have
  console.log(`⚠️  Using fallback content (${rssFullContent.length} chars)`);
  return rssFullContent;
}
