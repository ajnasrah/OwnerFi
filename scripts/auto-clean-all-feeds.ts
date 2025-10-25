#!/usr/bin/env tsx
// Automatically create a cleaned feed-sources.ts with ONLY working feeds

import * as fs from 'fs';
import * as path from 'path';

// GOOD feeds identified by audit (KEEP THESE ONLY)
const GOOD_FEEDS = {
  ownerfi: [
    'ownerfi-housingwire',
    'ownerfi-realtor-news',
    'ownerfi-zillow-research',
    'ownerfi-redfin-news',
    'ownerfi-theclose',
    'ownerfi-housingwire-realestate',
    'ownerfi-housingwire-mortgages',
    'ownerfi-familyhandyman',
    'ownerfi-homeadvisor-blog'
  ],
  carz: [
    'carz-chargedevs',
    'carz-evcentral'
  ],
  vassdistro: [
    'vassdistro-tobacco-reporter',
    'vassdistro-ukvia-news',
    'vassdistro-vapouround',
    'vassdistro-ecigclick',
    'vassdistro-vape-beat'
  ]
};

const newConfig = `// RSS Feed Source Configuration - AUTO-CLEANED
// Broken feeds removed - only working feeds with full content

import { addFeedSource as addFeedSourceFirestore, type FeedSource, getAllFeedSources } from '@/lib/feed-store-firestore';

/**
 * OWNERFI FEEDS (9 working feeds - 3000-9000 chars avg)
 */
export const OWNERFI_FEEDS: Omit<FeedSource, 'articlesProcessed'>[] = [
  {
    id: 'ownerfi-housingwire',
    name: 'HousingWire - Housing Market News',
    url: 'https://www.housingwire.com/feed/',
    category: 'ownerfi',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-realtor-news',
    name: 'Realtor.com - News & Insights',
    url: 'https://www.realtor.com/news/feed/',
    category: 'ownerfi',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-zillow-research',
    name: 'Zillow - Research & Insights',
    url: 'https://www.zillow.com/research/feed/',
    category: 'ownerfi',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-redfin-news',
    name: 'Redfin - Real Estate News',
    url: 'https://www.redfin.com/news/feed/',
    category: 'ownerfi',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-theclose',
    name: 'The Close - Real Estate News',
    url: 'https://theclose.com/feed/',
    category: 'ownerfi',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-housingwire-realestate',
    name: 'HousingWire - Real Estate',
    url: 'https://www.housingwire.com/category/real-estate/feed/',
    category: 'ownerfi',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-housingwire-mortgages',
    name: 'HousingWire - Mortgages',
    url: 'https://www.housingwire.com/category/mortgage/feed/',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-familyhandyman',
    name: 'Family Handyman',
    url: 'https://www.familyhandyman.com/feed/',
    category: 'ownerfi',
    subcategory: 'tips',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-homeadvisor-blog',
    name: 'HomeAdvisor - Home Tips',
    url: 'https://www.homeadvisor.com/r/feed/',
    category: 'ownerfi',
    subcategory: 'tips',
    enabled: true,
    fetchInterval: 120
  }
];

/**
 * CARZ FEEDS (2 working feeds - 2500-5000 chars avg)
 */
export const CARZ_FEEDS: Omit<FeedSource, 'articlesProcessed'>[] = [
  {
    id: 'carz-chargedevs',
    name: 'Charged EVs',
    url: 'https://chargedevs.com/feed/',
    category: 'carz',
    subcategory: 'electric',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-evcentral',
    name: 'EV Central',
    url: 'https://evcentral.com.au/feed/',
    category: 'carz',
    subcategory: 'electric',
    enabled: true,
    fetchInterval: 60
  }
];

/**
 * VASS DISTRO FEEDS (5 working feeds - 1000-8000 chars avg)
 */
export const VASSDISTRO_FEEDS: Omit<FeedSource, 'articlesProcessed'>[] = [
  {
    id: 'vassdistro-tobacco-reporter',
    name: 'Tobacco Reporter - Vapor News',
    url: 'https://tobaccoreporter.com/feed/',
    category: 'vassdistro',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'vassdistro-ukvia-news',
    name: 'UKVIA - Industry Association',
    url: 'https://ukvia.co.uk/feed/',
    category: 'vassdistro',
    subcategory: 'regulations',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'vassdistro-vapouround',
    name: 'Vapouround Magazine - Industry Updates',
    url: 'https://vapouround.co.uk/feed/',
    category: 'vassdistro',
    subcategory: 'trade',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'vassdistro-ecigclick',
    name: 'Ecigclick - Product News',
    url: 'https://ecigclick.co.uk/feed/',
    category: 'vassdistro',
    subcategory: 'products',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'vassdistro-vape-beat',
    name: 'Vape Beat - Industry Trends',
    url: 'https://vapebeat.com/feed/',
    category: 'vassdistro',
    subcategory: 'products',
    enabled: true,
    fetchInterval: 120
  }
];

/**
 * Initialize all feed sources in Firestore (only if they don't exist)
 */
export async function initializeFeedSources() {
  console.log('🚀 Initializing feed sources (CLEANED - only working feeds)...\\n');

  const existingFeeds = await getAllFeedSources();
  if (existingFeeds.length > 0) {
    console.log(\`✅ Feeds already initialized (\${existingFeeds.length} total)\`);
    return;
  }

  let totalCount = 0;

  // Add Carz feeds
  for (const feed of CARZ_FEEDS) {
    await addFeedSourceFirestore(feed);
    totalCount++;
  }

  // Add OwnerFi feeds
  for (const feed of OWNERFI_FEEDS) {
    await addFeedSourceFirestore(feed);
    totalCount++;
  }

  // Add Vass Distro feeds
  for (const feed of VASSDISTRO_FEEDS) {
    await addFeedSourceFirestore(feed);
    totalCount++;
  }

  console.log(\`\\n✅ Initialized \${CARZ_FEEDS.length} Carz feeds\`);
  console.log(\`✅ Initialized \${OWNERFI_FEEDS.length} OwnerFi feeds\`);
  console.log(\`✅ Initialized \${VASSDISTRO_FEEDS.length} Vass Distro feeds\`);
  console.log(\`📊 Total: \${totalCount} feed sources (CLEANED)\\n\`);
}

/**
 * Get feeds that need to be fetched (based on lastFetched + fetchInterval)
 */
export function getFeedsToFetch(allFeeds: FeedSource[]): FeedSource[] {
  const now = Date.now();
  return allFeeds.filter(feed => {
    if (!feed.enabled) return false;
    if (!feed.lastFetched) return true;

    const timeSinceLastFetch = now - feed.lastFetched;
    const intervalMs = feed.fetchInterval * 60 * 1000;

    return timeSinceLastFetch >= intervalMs;
  });
}
`;

function cleanFeeds() {
  const feedSourcesPath = path.join(__dirname, '../src/config/feed-sources.ts');
  const backupPath = path.join(__dirname, '../src/config/feed-sources.ts.backup-' + Date.now());

  console.log('🧹 AUTO-CLEANING ALL BRAND FEEDS...\n');

  // Backup original
  fs.copyFileSync(feedSourcesPath, backupPath);
  console.log(`📦 Backed up original to: ${path.basename(backupPath)}`);

  // Write new config
  fs.writeFileSync(feedSourcesPath, newConfig, 'utf-8');

  console.log('\n✅ CLEANED FEED CONFIG:');
  console.log('   - OwnerFi: 9 feeds (removed 19 broken)');
  console.log('   - Carz: 2 feeds (removed 28 broken)');
  console.log('   - Vass Distro: 5 feeds (removed 17 broken)');
  console.log('   - Total: 16 feeds (removed 64 broken)\n');

  console.log('📝 NEXT STEPS:');
  console.log('   1. Review: git diff src/config/feed-sources.ts');
  console.log('   2. Clean DB: npx tsx scripts/cleanup-empty-articles.ts');
  console.log('   3. Fetch: curl https://ownerfi.ai/api/cron/fetch-feeds');
  console.log('   4. Rate: curl https://ownerfi.ai/api/cron/rate-articles');
  console.log('   5. Test: POST /api/workflow/complete-viral\n');
}

cleanFeeds();
