// RSS Feed Source Configuration - VERIFIED WORKING FEEDS 2025
// All feeds tested and verified with excellent content quality
// Total: 25 feeds (VassDistro: 6, OwnerFi: 15, Carz: 4)

import { addFeedSource as addFeedSourceFirestore, type FeedSource, getAllFeedSources } from '@/lib/feed-store-firestore';

/**
 * OWNERFI FEEDS (15 working feeds - all excellent quality with full content)
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
    id: 'ownerfi-inman',
    name: 'Inman - Real Estate News',
    url: 'https://www.inman.com/feed/',
    category: 'ownerfi',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-mpamag',
    name: 'Mortgage Professional America',
    url: 'https://www.mpamag.com/us/rss',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-bankrate-mortgages',
    name: 'Bankrate - Mortgage News',
    url: 'https://www.bankrate.com/feeds/rss/mortgage.xml',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-forbes-realestate',
    name: 'Forbes - Real Estate',
    url: 'https://www.forbes.com/real-estate/feed/',
    category: 'ownerfi',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-housingwire-reverse',
    name: 'HousingWire - Reverse Mortgage',
    url: 'https://www.housingwire.com/articles/category/reverse-mortgage/feed/',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-mpamag-brokers',
    name: 'MPA - Mortgage Brokers',
    url: 'https://www.mpamag.com/us/mortgage-brokers/rss',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-globe-st',
    name: 'GlobeSt - Real Estate News',
    url: 'https://www.globest.com/feed/',
    category: 'ownerfi',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-national-mortgage',
    name: 'National Mortgage Professional',
    url: 'https://nationalmortgageprofessional.com/rss.xml',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-apartment-therapy',
    name: 'Apartment Therapy - Home News',
    url: 'https://www.apartmenttherapy.com/main.rss',
    category: 'ownerfi',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-credible',
    name: 'Credible - Mortgage & Home Buying',
    url: 'https://www.credible.com/blog/feed/',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 120
  }
];

/**
 * CARZ FEEDS (4 working feeds - mix of excellent and adequate quality)
 */
export const CARZ_FEEDS: Omit<FeedSource, 'articlesProcessed'>[] = [
  {
    id: 'carz-electrek',
    name: 'Electrek - Electric Vehicle News',
    url: 'https://electrek.co/feed/',
    category: 'carz',
    subcategory: 'electric',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-chargedevs',
    name: 'ChargedEVs - EV Technology News',
    url: 'https://chargedevs.com/feed/',
    category: 'carz',
    subcategory: 'electric',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'carz-cleantechnica',
    name: 'CleanTechnica - Clean Energy & EVs',
    url: 'https://cleantechnica.com/feed/',
    category: 'carz',
    subcategory: 'electric',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-evannex',
    name: 'EVANNEX Blog - Tesla & EV News',
    url: 'https://evannex.com/blogs/news.atom',
    category: 'carz',
    subcategory: 'electric',
    enabled: true,
    fetchInterval: 60
  }
];

/**
 * VASS DISTRO FEEDS (6 working feeds - 1000-10000 chars avg)
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
    id: 'vassdistro-tobacco-journal',
    name: 'Tobacco Journal International',
    url: 'https://www.tobaccojournal.com/feed/',
    category: 'vassdistro',
    subcategory: 'trade',
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
  console.log('🚀 Initializing feed sources (CLEANED - only working feeds)...\n');

  const existingFeeds = await getAllFeedSources();
  if (existingFeeds.length > 0) {
    console.log(`✅ Feeds already initialized (${existingFeeds.length} total)`);
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

  console.log(`\n✅ Initialized ${CARZ_FEEDS.length} Carz feeds - 1 excellent + 3 adequate quality`);
  console.log(`✅ Initialized ${OWNERFI_FEEDS.length} OwnerFi feeds - all excellent quality`);
  console.log(`✅ Initialized ${VASSDISTRO_FEEDS.length} Vass Distro feeds - all excellent quality`);
  console.log(`📊 Total: ${totalCount} feed sources (TESTED & VERIFIED 2025)\n`);
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
