/**
 * Gaza Feed Health Check System
 *
 * Validates RSS feeds before article selection to ensure they're accessible
 * and have recent content. Alerts when feeds are unhealthy.
 */

import { alertFeedHealthCheckFailed } from './gaza-alerting';

export interface FeedHealthStatus {
  feedId: string;
  feedName: string;
  url: string;
  healthy: boolean;
  lastChecked: number;
  error?: string;
  articleCount?: number;
  latestArticleAge?: number; // hours since last article
}

export interface FeedHealthReport {
  totalFeeds: number;
  healthyFeeds: number;
  unhealthyFeeds: number;
  feedStatuses: FeedHealthStatus[];
  overallHealthy: boolean;
  checkedAt: number;
}

/**
 * Check health of a single RSS feed
 */
export async function checkFeedHealth(
  feedId: string,
  feedName: string,
  feedUrl: string
): Promise<FeedHealthStatus> {
  const status: FeedHealthStatus = {
    feedId,
    feedName,
    url: feedUrl,
    healthy: false,
    lastChecked: Date.now(),
  };

  try {
    // Try to fetch the feed with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OwnerFi-Gaza-Feed-Checker/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      status.error = `HTTP ${response.status}: ${response.statusText}`;
      await alertFeedHealthCheckFailed(feedId, feedName, status.error);
      return status;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('xml') && !contentType.includes('rss') && !contentType.includes('atom')) {
      // Some feeds return text/html or application/json - check content
      const text = await response.text();
      if (!text.includes('<rss') && !text.includes('<feed') && !text.includes('<channel>')) {
        status.error = `Invalid content type: ${contentType}`;
        await alertFeedHealthCheckFailed(feedId, feedName, status.error);
        return status;
      }
    }

    // Feed is accessible
    status.healthy = true;
    console.log(`✅ Feed healthy: ${feedName}`);
    return status;

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        status.error = 'Feed request timed out (10s)';
      } else {
        status.error = error.message;
      }
    } else {
      status.error = 'Unknown error checking feed';
    }

    await alertFeedHealthCheckFailed(feedId, feedName, status.error);
    return status;
  }
}

/**
 * Check health of all Gaza RSS feeds
 */
export async function checkAllGazaFeedsHealth(): Promise<FeedHealthReport> {
  console.log('\n🏥 Gaza Feed Health Check');
  console.log('='.repeat(50));

  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = await getAdminDb();

    // Get all Gaza feeds
    const feedsSnapshot = await adminDb
      .collection('gaza_rss_feeds')
      .where('enabled', '==', true)
      .get();

    if (feedsSnapshot.empty) {
      console.log('⚠️  No enabled Gaza feeds found');
      return {
        totalFeeds: 0,
        healthyFeeds: 0,
        unhealthyFeeds: 0,
        feedStatuses: [],
        overallHealthy: false,
        checkedAt: Date.now(),
      };
    }

    const feeds = feedsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<{ id: string; name: string; url: string }>;

    console.log(`📡 Checking ${feeds.length} feeds...`);

    // Check all feeds in parallel (with limit)
    const statuses: FeedHealthStatus[] = [];
    const batchSize = 3; // Check 3 at a time to avoid rate limiting

    for (let i = 0; i < feeds.length; i += batchSize) {
      const batch = feeds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(feed => checkFeedHealth(feed.id, feed.name, feed.url))
      );
      statuses.push(...batchResults);
    }

    const healthyFeeds = statuses.filter(s => s.healthy).length;
    const unhealthyFeeds = statuses.length - healthyFeeds;

    const report: FeedHealthReport = {
      totalFeeds: statuses.length,
      healthyFeeds,
      unhealthyFeeds,
      feedStatuses: statuses,
      overallHealthy: healthyFeeds > 0, // At least one feed must be healthy
      checkedAt: Date.now(),
    };

    // Log summary
    console.log(`\n📊 Health Check Summary:`);
    console.log(`   Total feeds:   ${report.totalFeeds}`);
    console.log(`   Healthy:       ${report.healthyFeeds} ✅`);
    console.log(`   Unhealthy:     ${report.unhealthyFeeds} ❌`);
    console.log(`   Overall:       ${report.overallHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);

    if (unhealthyFeeds > 0) {
      console.log(`\n⚠️  Unhealthy feeds:`);
      statuses
        .filter(s => !s.healthy)
        .forEach(s => console.log(`   • ${s.feedName}: ${s.error}`));
    }

    console.log('='.repeat(50) + '\n');

    // Store health report in Firestore
    await adminDb.collection('gaza_feed_health').doc('latest').set(report);

    return report;

  } catch (error) {
    console.error('❌ Error checking feed health:', error);
    return {
      totalFeeds: 0,
      healthyFeeds: 0,
      unhealthyFeeds: 0,
      feedStatuses: [],
      overallHealthy: false,
      checkedAt: Date.now(),
    };
  }
}

/**
 * Get the last health report without running new checks
 */
export async function getLastHealthReport(): Promise<FeedHealthReport | null> {
  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = await getAdminDb();

    const doc = await adminDb.collection('gaza_feed_health').doc('latest').get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as FeedHealthReport;
  } catch (error) {
    console.error('Error getting last health report:', error);
    return null;
  }
}

/**
 * Quick health check - returns true if at least one feed was healthy recently
 * Uses cached result if available and recent (< 1 hour old)
 */
export async function isGazaFeedsHealthy(): Promise<boolean> {
  try {
    const lastReport = await getLastHealthReport();

    // If we have a recent report (< 1 hour), use it
    if (lastReport && Date.now() - lastReport.checkedAt < 60 * 60 * 1000) {
      return lastReport.overallHealthy;
    }

    // Otherwise run a new check
    const report = await checkAllGazaFeedsHealth();
    return report.overallHealthy;

  } catch (error) {
    console.error('Error checking feeds healthy:', error);
    // Don't block on health check errors - assume healthy
    return true;
  }
}

/**
 * Get count of articles available (unprocessed, high quality)
 */
export async function getAvailableArticleCount(): Promise<number> {
  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = await getAdminDb();

    const snapshot = await adminDb
      .collection('gaza_articles')
      .where('processed', '==', false)
      .get();

    // Filter by quality score in memory (to avoid index)
    const highQualityCount = snapshot.docs.filter(doc => {
      const data = doc.data();
      return typeof data.qualityScore === 'number' && data.qualityScore >= 50;
    }).length;

    return highQualityCount;

  } catch (error) {
    console.error('Error getting article count:', error);
    return 0;
  }
}
