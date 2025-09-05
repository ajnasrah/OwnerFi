import { NextRequest, NextResponse } from 'next/server';
import { 
  ZillowScraper, 
  scrapeStateOwnerFinance, 
  scrapeTennesseeOwnerFinance,
  ZillowSearchCriteria 
} from '@/lib/zillow-scraper';
import { logError, logInfo } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      type = 'owner-finance',  // 'owner-finance', 'state', 'custom'
      state,
      location,
      maxPrice = 700000,
      maxPages = 50,
      criteria 
    } = body;

    await logInfo('Starting Zillow scraping request', {
      action: 'zillow_scrape_request',
      metadata: { type, state, location, maxPrice, maxPages }
    });

    let result;
    let searchType;

    switch (type) {
      case 'tennessee':
        searchType = 'Tennessee Owner Finance';
        const tennesseeUrls = await scrapeTennesseeOwnerFinance(maxPrice, maxPages);
        result = {
          propertyUrls: tennesseeUrls,
          totalFound: tennesseeUrls.length,
          searchUrl: `https://www.zillow.com/homes/for_sale/Tennessee/?price_max=${maxPrice}&home_type=house%2Ccondo%2Ctownhouse&keywords=owner%20finance&status=for_sale`,
          success: true
        };
        break;

      case 'state':
        if (!state) {
          return NextResponse.json(
            { error: 'State is required for state-wide scraping' },
            { status: 400 }
          );
        }
        searchType = `${state} Owner Finance`;
        const stateResult = await scrapeStateOwnerFinance(state, maxPrice, maxPages);
        result = {
          propertyUrls: stateResult.allUrls,
          totalFound: stateResult.totalFound,
          searchUrl: stateResult.searchUrl,
          success: true
        };
        break;

      case 'custom':
        if (!criteria) {
          return NextResponse.json(
            { error: 'Custom criteria is required for custom scraping' },
            { status: 400 }
          );
        }
        searchType = 'Custom Search';
        const scraper = new ZillowScraper();
        result = await scraper.scrapePropertyUrls(criteria as ZillowSearchCriteria, maxPages);
        break;

      case 'owner-finance':
      default:
        if (!location) {
          return NextResponse.json(
            { error: 'Location is required for owner finance scraping' },
            { status: 400 }
          );
        }
        searchType = `${location} Owner Finance`;
        const ofScraper = new ZillowScraper();
        const ofCriteria: ZillowSearchCriteria = {
          location,
          maxPrice,
          homeTypes: ['single-family', 'condo', 'townhouse'],
          keywords: 'owner finance'
        };
        result = await ofScraper.scrapePropertyUrls(ofCriteria, maxPages);
        break;
    }

    if (!result.success) {
      return NextResponse.json(
        { error: 'Scraping failed', details: result.error },
        { status: 500 }
      );
    }

    await logInfo('Zillow scraping completed successfully', {
      action: 'zillow_scrape_success',
      metadata: { 
        searchType,
        totalFound: result.totalFound,
        searchUrl: result.searchUrl 
      }
    });

    return NextResponse.json({
      success: true,
      searchType,
      data: {
        propertyUrls: result.propertyUrls,
        totalFound: result.totalFound,
        searchUrl: result.searchUrl,
        maxPrice,
        maxPages
      }
    });

  } catch (error) {
    await logError('Zillow scraping API error', {
      action: 'zillow_scrape_api_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');

  const examples = {
    tennessee: {
      description: 'Scrape all owner finance properties in Tennessee (up to $700K)',
      endpoint: 'POST /api/scraper/zillow',
      body: {
        type: 'tennessee',
        maxPrice: 700000,
        maxPages: 50
      }
    },
    state: {
      description: 'Scrape owner finance properties in any state',
      endpoint: 'POST /api/scraper/zillow',
      body: {
        type: 'state',
        state: 'Texas',
        maxPrice: 700000,
        maxPages: 50
      }
    },
    location: {
      description: 'Scrape owner finance properties in specific location',
      endpoint: 'POST /api/scraper/zillow',
      body: {
        type: 'owner-finance',
        location: 'Nashville, TN',
        maxPrice: 700000,
        maxPages: 10
      }
    },
    custom: {
      description: 'Custom search with full criteria control',
      endpoint: 'POST /api/scraper/zillow',
      body: {
        type: 'custom',
        maxPages: 20,
        criteria: {
          location: 'Memphis, TN',
          maxPrice: 500000,
          homeTypes: ['single-family', 'condo'],
          keywords: 'owner finance'
        }
      }
    }
  };

  if (type && type in examples) {
    return NextResponse.json(examples[type as keyof typeof examples]);
  }

  return NextResponse.json({
    message: 'Zillow Property URL Scraper API',
    description: 'Extract property URLs from Zillow searches, optimized for owner finance properties',
    usage: 'Send POST request with search parameters',
    examples,
    notes: [
      'Designed specifically for extracting property URLs to use with Apify',
      'Supports state-wide scraping for comprehensive coverage',
      'Tennessee scraping is pre-configured for your use case',
      'Rate-limited and respectful scraping with delays between requests',
      'All URLs are cleaned and deduplicated'
    ]
  });
}