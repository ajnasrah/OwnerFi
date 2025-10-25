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
    id: 'carz-motor1-news',
    name: 'Motor1 - News',
    url: 'https://www.motor1.com/rss/news/',
    category: 'carz',
    subcategory: 'reviews',
    enabled: true,
    fetchInterval: 60
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
    name: 'Edmunds - Car News',
    url: 'https://www.edmunds.com/feeds/rss/articles/all.xml',
    category: 'carz',
    subcategory: 'reviews',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-autoweek',
    name: 'Autoweek - Car News',
    url: 'https://www.autoweek.com/rss/',
    category: 'carz',
    subcategory: 'reviews',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-carconnection',
    name: 'The Car Connection - Reviews',
    url: 'https://feeds.highgearmedia.com/tcc/news',
    category: 'carz',
    subcategory: 'reviews',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-roadandtrack',
    name: 'Road & Track',
    url: 'https://www.roadandtrack.com/rss/all.xml/',
    category: 'carz',
    subcategory: 'reviews',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-carthrottle',
    name: 'Car Throttle',
    url: 'https://www.carthrottle.com/rss/',
    category: 'carz',
    subcategory: 'reviews',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-thedrive-news',
    name: 'The Drive - News',
    url: 'https://www.thedrive.com/rss/news',
    category: 'carz',
    subcategory: 'reviews',
    enabled: true,
    fetchInterval: 60
  },

  // Market News & Trends
  {
    id: 'carz-autoblog-news',
    name: 'Autoblog - News',
    url: 'https://www.autoblog.com/rss/full/',
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
    name: 'Automotive News Daily Drive',
    url: 'https://feeds.buzzsprout.com/2447022.rss',
    category: 'carz',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-cnet-roadshow',
    name: 'CNET Roadshow',
    url: 'https://www.cnet.com/rss/roadshow/',
    category: 'carz',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-forbes-autos',
    name: 'Forbes - Autos',
    url: 'https://www.forbes.com/autos/feed/',
    category: 'carz',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-topgear',
    name: 'Top Gear',
    url: 'https://www.topgear.com/rss',
    category: 'carz',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-pistonheads',
    name: 'PistonHeads - News',
    url: 'https://www.pistonheads.com/xml/news091.asp',
    category: 'carz',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-wardsauto',
    name: 'WardsAuto',
    url: 'https://www.wardsauto.com/rss.xml',
    category: 'carz',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-automotivedive',
    name: 'Automotive Dive',
    url: 'https://www.automotivedive.com/feeds/news/',
    category: 'carz',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },

  // Electric Vehicles & Innovation
  {
    id: 'carz-insideevs',
    name: 'InsideEVs - Electric Vehicle News',
    url: 'https://insideevs.com/rss/articles/all/',
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
  },
  {
    id: 'carz-greencarreports',
    name: 'Green Car Reports',
    url: 'https://feeds.highgearmedia.com/green-car-reports/news',
    category: 'carz',
    subcategory: 'electric',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-cleantechnica',
    name: 'CleanTechnica - EVs',
    url: 'https://cleantechnica.com/feed/',
    category: 'carz',
    subcategory: 'electric',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-evannex',
    name: 'EVANNEX - EV News',
    url: 'https://evannex.com/blogs/news.atom',
    category: 'carz',
    subcategory: 'electric',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-hybridcars',
    name: 'Hybrid Cars',
    url: 'https://www.hybridcars.com/feed/',
    category: 'carz',
    subcategory: 'electric',
    enabled: true,
    fetchInterval: 60
  },
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
    id: 'carz-evobsession',
    name: 'EV Obsession',
    url: 'https://evobsession.com/feed/',
    category: 'carz',
    subcategory: 'electric',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'carz-plugincars',
    name: 'Plug In Cars',
    url: 'https://www.plugincars.com/rss.xml',
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
  {
    id: 'vassdistro-vapebiz',
    name: 'Vape Biz - Industry News',
    url: 'https://vapebiz.net/feed/',
    category: 'vassdistro',
    subcategory: 'news',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'vassdistro-vaping-links',
    name: 'Vaping Links - News',
    url: 'https://vapinglinks.com/feed/',
    category: 'vassdistro',
    subcategory: 'news',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'vassdistro-ecigarette-reviewed',
    name: 'E-Cigarette Reviewed',
    url: 'https://ecigarettereviewed.com/feed/',
    category: 'vassdistro',
    subcategory: 'news',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'vassdistro-vaping-daily',
    name: 'Vaping Daily',
    url: 'https://vapingdaily.com/feed/',
    category: 'vassdistro',
    subcategory: 'news',
    enabled: true,
    fetchInterval: 60
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
  {
    id: 'vassdistro-tobacco-asia',
    name: 'Tobacco Asia - Regulations',
    url: 'https://www.tobaccoasia.com/feed/',
    category: 'vassdistro',
    subcategory: 'regulations',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'vassdistro-smokefree-action',
    name: 'Smokefree Action Coalition',
    url: 'https://smokefreepolicy.org/feed/',
    category: 'vassdistro',
    subcategory: 'regulations',
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
  {
    id: 'vassdistro-vapingbusiness',
    name: 'Vaping Business Magazine',
    url: 'https://vapingbusinessmagazine.com/feed/',
    category: 'vassdistro',
    subcategory: 'trade',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'vassdistro-vaperanger-news',
    name: 'Vape Ranger - Wholesale News',
    url: 'https://vaperanger.com/blogs/news.atom',
    category: 'vassdistro',
    subcategory: 'trade',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'vassdistro-gotvape-blog',
    name: 'Got Vape Wholesale Blog',
    url: 'https://www.gotvapewholesale.com/blogs/smoke-shop-business-blog.atom',
    category: 'vassdistro',
    subcategory: 'trade',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'vassdistro-mipod-news',
    name: 'MiPod Wholesale News',
    url: 'https://mipodwholesale.com/blogs/news.atom',
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
  },
  {
    id: 'vassdistro-vaping-hardware',
    name: 'Vaping Hardware Reviews',
    url: 'https://vaping.com/blog/feed/',
    category: 'vassdistro',
    subcategory: 'products',
    enabled: true,
    fetchInterval: 120
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
  {
    id: 'ownerfi-biggerpockets',
    name: 'BiggerPockets - Real Estate News',
    url: 'https://www.biggerpockets.com/blog/feed/',
    category: 'ownerfi',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-nar-newsroom',
    name: 'NAR Newsroom',
    url: 'https://www.nar.realtor/newsroom/rss',
    category: 'ownerfi',
    subcategory: 'market',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-realestate-us-news',
    name: 'US News - Real Estate',
    url: 'https://www.usnews.com/rss/news/articles/real-estate',
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
    id: 'ownerfi-rismedia',
    name: 'RISMedia - Real Estate News',
    url: 'https://www.rismedia.com/feed/',
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
    id: 'ownerfi-mba-news',
    name: 'MBA - Mortgage Bankers News',
    url: 'https://www.mba.org/news-and-research/rss-feeds',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-forbes-mortgages',
    name: 'Forbes - Mortgages',
    url: 'https://www.forbes.com/real-estate/feed/',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-lendingtree-mortgages',
    name: 'LendingTree - Mortgages',
    url: 'https://www.lendingtree.com/home/mortgage/feed/',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 60
  },
  {
    id: 'ownerfi-freddiemac-news',
    name: 'Freddie Mac - News',
    url: 'https://www.freddiemac.com/rss/news.xml',
    category: 'ownerfi',
    subcategory: 'mortgage',
    enabled: true,
    fetchInterval: 120
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
    enabled: false,
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
    id: 'ownerfi-houselogic',
    name: 'HouseLogic - Homeowner Tips',
    url: 'https://www.houselogic.com/feed/',
    category: 'ownerfi',
    subcategory: 'tips',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-thebalancemoney-homebuying',
    name: 'The Balance - Home Buying',
    url: 'https://www.thebalancemoney.com/homebuying-4073993/feed/',
    category: 'ownerfi',
    subcategory: 'tips',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-moneywise-homeownership',
    name: 'MoneyWise - Homeownership',
    url: 'https://moneywise.com/homeownership/feed',
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
    enabled: false,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-realestatetechnology',
    name: 'Real Estate Technology News',
    url: 'https://www.realestatetechnology.com/feed/',
    category: 'ownerfi',
    subcategory: 'tools',
    enabled: true,
    fetchInterval: 120
  },
  {
    id: 'ownerfi-geekestatelady',
    name: 'The Geek Estate - PropTech',
    url: 'https://thegeekestate.com/feed/',
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
