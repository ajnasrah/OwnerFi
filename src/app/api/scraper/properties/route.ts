import { NextRequest, NextResponse } from 'next/server';
import { createScraper, SearchCriteria } from '@/lib/property-scraper';
import { logError, logInfo } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { website, criteria, maxPages = 1 } = body;

    // Validate required fields
    if (!website) {
      return NextResponse.json(
        { error: 'Website is required' },
        { status: 400 }
      );
    }

    if (!criteria) {
      return NextResponse.json(
        { error: 'Search criteria is required' },
        { status: 400 }
      );
    }

    await logInfo('Starting property scraping request', {
      action: 'scrape_request',
      metadata: { website, criteria, maxPages }
    });

    // Create scraper for the specified website
    let scraper;
    try {
      scraper = createScraper(website);
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 400 }
      );
    }

    // Execute scraping
    const result = await scraper.scrapeProperties(criteria as SearchCriteria, maxPages);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Scraping failed', details: result.error },
        { status: 500 }
      );
    }

    await logInfo('Property scraping completed successfully', {
      action: 'scrape_success',
      metadata: { 
        website, 
        totalFound: result.totalFound,
        searchUrl: result.searchUrl 
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        properties: result.properties,
        totalFound: result.totalFound,
        searchUrl: result.searchUrl,
        website,
        criteria
      }
    });

  } catch (error) {
    await logError('Property scraping API error', {
      action: 'scrape_api_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const website = url.searchParams.get('website');

  if (!website) {
    return NextResponse.json({
      message: 'Property URL Scraper API',
      usage: {
        method: 'POST',
        endpoint: '/api/scraper/properties',
        body: {
          website: 'realtor.com | zillow.com | redfin.com | trulia.com',
          criteria: {
            location: 'City, State or ZIP code',
            minPrice: 'number (optional)',
            maxPrice: 'number (optional)',
            bedrooms: 'number (optional)',
            bathrooms: 'number (optional)',
            propertyType: 'string (optional)',
            sortBy: 'string (optional)'
          },
          maxPages: 'number (optional, default: 1)'
        }
      },
      supportedWebsites: [
        'realtor.com',
        'zillow.com', 
        'redfin.com',
        'trulia.com'
      ]
    });
  }

  // Return supported search parameters for a specific website
  const searchParameters = {
    'realtor.com': {
      location: 'City, State or ZIP code',
      minPrice: 'Minimum price',
      maxPrice: 'Maximum price',
      bedrooms: 'Number of bedrooms',
      bathrooms: 'Number of bathrooms',
      propertyType: 'single-family-home | condo | townhome | multi-family',
      sortBy: 'price-low | price-high | newest | oldest'
    },
    'zillow.com': {
      location: 'City, State or ZIP code',
      minPrice: 'Minimum price',
      maxPrice: 'Maximum price',
      bedrooms: 'Number of bedrooms',
      bathrooms: 'Number of bathrooms',
      propertyType: 'houses | condos | townhomes | apartments',
      sortBy: 'price_asc | price_desc | date_new | date_old'
    },
    'redfin.com': {
      location: 'City, State or ZIP code',
      minPrice: 'Minimum price',
      maxPrice: 'Maximum price',
      bedrooms: 'Number of bedrooms',
      bathrooms: 'Number of bathrooms',
      propertyType: 'house | condo | townhouse | multi-family',
      sortBy: 'price-asc | price-desc | date-desc | date-asc'
    },
    'trulia.com': {
      location: 'City, State or ZIP code',
      minPrice: 'Minimum price',
      maxPrice: 'Maximum price',
      bedrooms: 'Number of bedrooms',
      bathrooms: 'Number of bathrooms',
      propertyType: 'single_family_home | condo | townhome | multi_family',
      sortBy: 'price_asc | price_desc | date_desc | date_asc'
    }
  };

  const params = searchParameters[website as keyof typeof searchParameters];
  
  if (!params) {
    return NextResponse.json(
      { error: `Unsupported website: ${website}` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    website,
    supportedParameters: params,
    example: {
      website,
      criteria: {
        location: 'Austin, TX',
        minPrice: 200000,
        maxPrice: 500000,
        bedrooms: 3,
        bathrooms: 2,
        propertyType: Object.values(params)[5]?.split(' | ')[0],
        sortBy: Object.values(params)[6]?.split(' | ')[0]
      },
      maxPages: 3
    }
  });
}