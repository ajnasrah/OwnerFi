// RSS Feed Fetcher and Parser
// Fetches RSS feeds, parses articles, and stores them in the feed store

import { fetchWithTimeout, retry, TIMEOUTS } from './api-utils';
import { sanitizeHtml } from './validation';
import {
  addArticle,
  articleExists,
  updateFeedSource,
  type FeedSource,
  type Article
} from './feed-store-firestore';
import { randomUUID } from 'crypto';

interface RSSItem {
  title: string;
  description?: string;
  content?: string;
  link: string;
  pubDate?: string;
  author?: string;
  categories?: string[];
}

interface RSSFeed {
  title: string;
  description?: string;
  link: string;
  items: RSSItem[];
}

/**
 * Parse RSS XML to extract articles
 */
export function parseRSSFeed(xmlText: string): RSSFeed {
  // Extract feed metadata
  const feedTitleMatch = xmlText.match(/<title>(.*?)<\/title>/i);
  const feedDescMatch = xmlText.match(/<description>(.*?)<\/description>/i);
  const feedLinkMatch = xmlText.match(/<link>(.*?)<\/link>/i);

  const feed: RSSFeed = {
    title: feedTitleMatch ? sanitizeHtml(feedTitleMatch[1]) : 'Unknown Feed',
    description: feedDescMatch ? sanitizeHtml(feedDescMatch[1]) : '',
    link: feedLinkMatch ? feedLinkMatch[1].trim() : '',
    items: []
  };

  // Extract all items
  const itemsRegex = /<item>([\s\S]*?)<\/item>/gi;
  const items = xmlText.match(itemsRegex) || [];

  for (const itemXml of items) {
    try {
      const item = parseRSSItem(itemXml);
      if (item.title && item.link) {
        feed.items.push(item);
      }
    } catch (error) {
      console.error('Error parsing RSS item:', error);
    }
  }

  return feed;
}

/**
 * Parse a single RSS item
 */
function parseRSSItem(itemXml: string): RSSItem {
  const item: RSSItem = {
    title: '',
    link: '',
    categories: []
  };

  // Title
  const titleMatch = itemXml.match(/<title>(.*?)<\/title>/is);
  if (titleMatch) {
    item.title = sanitizeHtml(titleMatch[1]);
  }

  // Link
  const linkMatch = itemXml.match(/<link>(.*?)<\/link>/is);
  if (linkMatch) {
    item.link = linkMatch[1].trim();
  }

  // Description
  const descMatch = itemXml.match(/<description>(.*?)<\/description>/is);
  if (descMatch) {
    item.description = sanitizeHtml(descMatch[1]);
  }

  // Content (content:encoded or full content)
  const contentMatch = itemXml.match(/<content:encoded>(.*?)<\/content:encoded>/is) ||
                       itemXml.match(/<content>(.*?)<\/content>/is);
  if (contentMatch) {
    item.content = sanitizeHtml(contentMatch[1]);
  }

  // Pub date
  const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/is);
  if (pubDateMatch) {
    item.pubDate = pubDateMatch[1].trim();
  }

  // Author
  const authorMatch = itemXml.match(/<(?:dc:)?creator>(.*?)<\/(?:dc:)?creator>/is) ||
                      itemXml.match(/<author>(.*?)<\/author>/is);
  if (authorMatch) {
    item.author = sanitizeHtml(authorMatch[1]);
  }

  // Categories
  const categoryMatches = itemXml.match(/<category>(.*?)<\/category>/gis);
  if (categoryMatches) {
    item.categories = categoryMatches.map(cat => {
      const match = cat.match(/<category>(.*?)<\/category>/is);
      return match ? sanitizeHtml(match[1]) : '';
    }).filter(Boolean);
  }

  return item;
}

/**
 * Fetch and parse RSS feed with retry
 */
export async function fetchRSSFeed(url: string): Promise<RSSFeed> {
  return retry(
    async () => {
      // Add proper headers to avoid 403 Forbidden / 404 errors from RSS feeds
      const response = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OwnerFi/1.0; +https://ownerfi.ai)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      }, TIMEOUTS.RSS_FETCH);

      if (!response.ok) {
        throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
      }

      const xmlText = await response.text();
      return parseRSSFeed(xmlText);
    },
    {
      maxAttempts: 3,
      backoff: 'exponential',
      onRetry: (attempt, error) => {
        console.log(`RSS fetch retry ${attempt} for ${url}:`, error.message);
      }
    }
  );
}

/**
 * Process a feed source and store new articles
 * Only processes articles published AFTER the last fetch time (ignores old articles)
 */
export async function processFeedSource(feedSource: FeedSource): Promise<{
  success: boolean;
  newArticles: number;
  error?: string;
}> {
  console.log(`🔄 Processing feed: ${feedSource.name}`);

  try {
    const feed = await fetchRSSFeed(feedSource.url);
    let newArticles = 0;

    // Get the cutoff time - only process articles published after this
    const cutoffTime = feedSource.lastFetched || Date.now();

    for (const item of feed.items) {
      // Parse article publication date
      const articlePubDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();

      // REAL-TIME FILTER: Skip articles published before our last check
      if (feedSource.lastFetched && articlePubDate <= feedSource.lastFetched) {
        continue; // Ignore old articles
      }

      // Skip if article already exists
      const exists = await articleExists(item.link, feedSource.category);
      if (exists) {
        continue;
      }

      // Use RSS content as-is (quality filter will reject insufficient content later)
      // Web scraping is unreliable in serverless environments and adds latency
      const content = item.content || item.description || '';

      // Create article (only include author if it exists)
      const article: Omit<Article, 'createdAt'> = {
        id: randomUUID(),
        feedId: feedSource.id,
        title: item.title,
        description: item.description || '',
        content,
        link: item.link,
        pubDate: articlePubDate,
        ...(item.author && { author: item.author }),
        categories: item.categories || [],
        processed: false,
        videoGenerated: false
      };

      // Add article to database (AI scoring will happen in batch job later)
      await addArticle(article, feedSource.category);
      newArticles++;
    }

    // Note: AI scoring removed from here - now handled by dedicated batch cron job
    // This reduces costs by scoring all articles once per day instead of real-time

    // Update feed source with current timestamp (don't pass lastError at all to clear it)
    const now = Date.now();
    const { lastError, ...feedWithoutError } = feedSource;
    await updateFeedSource({
      ...feedWithoutError,
      lastFetched: now,
      articlesProcessed: feedSource.articlesProcessed + newArticles
    });

    if (newArticles > 0) {
      console.log(`✅ Found ${newArticles} NEW articles from ${feedSource.name} (published after ${new Date(cutoffTime).toLocaleString()})`);
    } else {
      console.log(`✅ No new articles from ${feedSource.name}`);
    }

    return {
      success: true,
      newArticles
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error processing feed ${feedSource.name}:`, errorMessage);

    // Update feed source with error
    await updateFeedSource({
      ...feedSource,
      lastFetched: Date.now(),
      lastError: errorMessage
    });

    return {
      success: false,
      newArticles: 0,
      error: errorMessage
    };
  }
}

/**
 * Process multiple feed sources in parallel
 */
export async function processFeedSources(feedSources: FeedSource[]): Promise<{
  totalProcessed: number;
  totalNewArticles: number;
  errors: Array<{ feedId: string; error: string }>;
}> {
  const results = await Promise.allSettled(
    feedSources.map(feed => processFeedSource(feed))
  );

  let totalNewArticles = 0;
  const errors: Array<{ feedId: string; error: string }> = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      totalNewArticles += result.value.newArticles;
      if (result.value.error) {
        errors.push({
          feedId: feedSources[index].id,
          error: result.value.error
        });
      }
    } else {
      errors.push({
        feedId: feedSources[index].id,
        error: result.reason.message || 'Unknown error'
      });
    }
  });

  return {
    totalProcessed: feedSources.length,
    totalNewArticles,
    errors
  };
}
