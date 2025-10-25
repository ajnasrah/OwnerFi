// RSS Feed Source Configuration
// Carz Inc and OwnerFi feed sources

import { addFeedSource as addFeedSourceFirestore, type FeedSource, getAllFeedSources } from '@/lib/feed-store-firestore';

/**
 * CARZ INC FEEDS
 * Focus: Car reviews, market news, automotive industry updates
 */
export const CARZ_FEEDS: Omit<FeedSource, 'articlesProcessed'>[] = [
  // Car Reviews
  {
    id: 'carz-motor1-reviews',
    name: 'Motor1 - Car Reviews',
    url: 'https://www.motor1.com/rss/reviews/all/',
    category: 'carz',
    subcategory: 'reviews',
    enabled: true,
    fetchInterval: 60 // Every hour
  },
  {
    id: 'carz-caranddriver-reviews',
    name: 'Car and Driver - Reviews',
    url: 'https://www.caranddriver.com/rss/all.xml/',
    category: 'carz',
    subcategory: 'reviews',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-motortrend-reviews',
    name: 'MotorTrend - New Cars',
    url: 'https://www.motortrend.com/feed/',
    category: 'carz',
    subcategory: 'reviews',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-edmunds-reviews',
    name: 'Edmunds - Car Reviews',
    url: 'https://www.edmunds.com/feeds/rss/articles.xml',
    category: 'carz',
    subcategory: 'reviews',
    enabled: true,
    fetchInterval: 60
  },

  // Market News & Trends
  {
    id: 'carz-autoblog-news',
    name: 'Autoblog - News',
    url: 'https://www.autoblog.com/rss.xml',
    category: 'carz',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 30 // Every 30 minutes for news
  },
  {
    id: 'carz-theverge-transportation',
    name: 'The Verge - Transportation',
    url: 'https://www.theverge.com/rss/transportation/index.xml',
    category: 'carz',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 30
  },
  {
    id: 'carz-jalopnik',
    name: 'Jalopnik - Car News',
    url: 'https://jalopnik.com/rss',
    category: 'carz',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 30
  },
  {
    id: 'carz-automotive-news',
    name: 'Automotive News',
    url: 'https://www.autonews.com/rss.xml',
    category: 'carz',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },

  // Electric Vehicles & Innovation
  {
    id: 'carz-insideevs',
    name: 'InsideEVs - Electric Vehicle News',
    url: 'https://insideevs.com/rss/news/',
    category: 'carz',
    subcategory: 'electric',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-electrek',
    name: 'Electrek - Electric Vehicle News',
    url: 'https://electrek.co/feed/',
    category: 'carz',
    subcategory: 'electric',
    enabled: true,
    fetchInterval: 60
  }
];

/**
 * VASS DISTRO FEEDS
 * Focus: B2B vape wholesale, industry regulations, market trends, supplier news
 */
export const VASSDISTRO_FEEDS: Omit<FeedSource, 'articlesProcessed'>[] = [
  // Vape Industry News
  {
    id: 'vassdistro-vaping360',
    name: 'Vaping360 - Industry News',
    url: 'https://vaping360.com/feed/',
    category: 'vassdistro',
    subcategory: 'news',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'vassdistro-vapingpost',
    name: 'Vaping Post - Business News',
    url: 'https://www.vapingpost.com/feed/',
    category: 'vassdistro',
    subcategory: 'news',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'vassdistro-ecigintelligence',
    name: 'ECigIntelligence - Market Analysis',
    url: 'https://ecigintelligence.com/feed/',
    category: 'vassdistro',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'vassdistro-tobacco-reporter',
    name: 'Tobacco Reporter - Vapor News',
    url: 'https://tobaccoreporter.com/feed/',
    category: 'vassdistro',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 120
  },

  // Regulations & Compliance
  {
    id: 'vassdistro-fda-tobacco',
    name: 'FDA Tobacco News',
    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/tobacco-products/rss.xml',
    category: 'vassdistro',
    subcategory: 'regulations',
    enabled: true,
    fetchInterval: 120
  },

  // Wholesale & Business
  {
    id: 'vassdistro-vaping-insider',
    name: 'Vaping Insider - Trade News',
    url: 'https://vapinginsider.com/feed/',
    category: 'vassdistro',
    subcategory: 'trade',
    enabled: true,
    fetchInterval: 60
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

  // Market Trends & Innovation
  {
    id: 'vassdistro-planet-of-vapes',
    name: 'Planet of the Vapes - Product News',
    url: 'https://www.planetofthevapes.co.uk/feed/',
    category: 'vassdistro',
    subcategory: 'products',
    enabled: true,
    fetchInterval: 120
  }
];

/**
 * OWNERFI FEEDS
 * Focus: Housing market, mortgages, homeowner savings, real estate tools
 */
export const OWNERFI_FEEDS: Omit<FeedSource, 'articlesProcessed'>[] = [
  // Housing Market News
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
    fetchInterval: 120 // Every 2 hours (research updates less frequently)
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

  // Mortgage News & Rates
  {
    id: 'ownerfi-mortgage-news-daily',
    name: 'Mortgage News Daily',
    url: 'https://www.mortgagenewsdaily.com/rss',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 30 // More frequent for rate updates
  },
  {
    id: 'ownerfi-mortgage-reports',
    name: 'The Mortgage Reports',
    url: 'https://themortgagereports.com/feed',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-bankrate-mortgages',
    name: 'Bankrate - Mortgages',
    url: 'https://www.bankrate.com/mortgages/feed/',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 60
  },

  // Homeowner Tips & Money Saving
  {
    id: 'ownerfi-nerdwallet-mortgages',
    name: 'NerdWallet - Mortgages & Homeownership',
    url: 'https://www.nerdwallet.com/blog/mortgages/feed/',
    category: 'ownerfi',
    subcategory: 'tips',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-this-old-house',
    name: 'This Old House - Home Improvement',
    url: 'https://www.thisoldhouse.com/feed',
    category: 'ownerfi',
    subcategory: 'tips',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-bob-vila',
    name: 'Bob Vila - Home Improvement Tips',
    url: 'https://www.bobvila.com/feed/',
    category: 'ownerfi',
    subcategory: 'tips',
    enabled: true,
    fetchInterval: 120
  },

  // Real Estate Technology & Tools
  {
    id: 'ownerfi-inman-news',
    name: 'Inman - Real Estate Tech News',
    url: 'https://www.inman.com/feed/',
    category: 'ownerfi',
    subcategory: 'tools',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-proptech-insider',
    name: 'PropTech Insider',
    url: 'https://www.proptechinsider.com/feed/',
    category: 'ownerfi',
    subcategory: 'tools',
    enabled: true,
    fetchInterval: 120
  }
];

/**
 * Initialize all feed sources in Firestore (only if they don't exist)
 */
export async function initializeFeedSources() {
  console.log('🚀 Initializing feed sources...\n');

  // Check if feeds already exist in Firestore
  const existingFeeds = await getAllFeedSources();
  if (existingFeeds.length > 0) {
    console.log(`✅ Feeds already initialized (${existingFeeds.length} total)`);
    return;
  }

  // Add Carz feeds
  let carzCount = 0;
  for (const feed of CARZ_FEEDS) {
    await addFeedSourceFirestore(feed);
    carzCount++;
  }

  // Add OwnerFi feeds
  let ownerfiCount = 0;
  for (const feed of OWNERFI_FEEDS) {
    await addFeedSourceFirestore(feed);
    ownerfiCount++;
  }

  // Add Vass Distro feeds
  let vassdistroCount = 0;
  for (const feed of VASSDISTRO_FEEDS) {
    await addFeedSourceFirestore(feed);
    vassdistroCount++;
  }

  console.log(`\n✅ Initialized ${carzCount} Carz feeds`);
  console.log(`✅ Initialized ${ownerfiCount} OwnerFi feeds`);
  console.log(`✅ Initialized ${vassdistroCount} Vass Distro feeds`);
  console.log(`📊 Total: ${carzCount + ownerfiCount + vassdistroCount} feed sources\n`);
}

/**
 * Get feeds that need to be fetched (based on lastFetched + fetchInterval)
 */
export function getFeedsToFetch(allFeeds: FeedSource[]): FeedSource[] {
  const now = Date.now();
  return allFeeds.filter(feed => {
    if (!feed.enabled) return false;
    if (!feed.lastFetched) return true; // Never fetched

    const timeSinceLastFetch = now - feed.lastFetched;
    const intervalMs = feed.fetchInterval * 60 * 1000;

    return timeSinceLastFetch >= intervalMs;
  });
}
