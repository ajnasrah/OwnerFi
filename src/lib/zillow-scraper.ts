import axios from 'axios';
import * as cheerio from 'cheerio';
import { logInfo, logError } from './logger';

export interface ZillowSearchCriteria {
  location: string;
  maxPrice?: number;
  minPrice?: number;
  homeTypes?: ('single-family' | 'condo' | 'townhouse' | 'multi-family')[];
  keywords?: string; // For "owner finance" searches
}

export interface ZillowScrapeResult {
  propertyUrls: string[];
  totalFound: number;
  searchUrl: string;
  success: boolean;
  error?: string;
}

export class ZillowScraper {
  private headers: Record<string, string>;

  constructor() {
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
    };
  }

  private buildZillowSearchUrl(criteria: ZillowSearchCriteria): string {
    // Start with base Zillow search URL - use the correct format
    let url = 'https://www.zillow.com/';
    
    // Add location to the path
    if (criteria.location) {
      // Clean location for URL
      const cleanLocation = criteria.location.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      url += `${cleanLocation}/`;
    }

    // Build filter parameters using Zillow's actual parameter names
    const params = new URLSearchParams();
    
    // Price filters
    if (criteria.minPrice) {
      params.append('price_min', criteria.minPrice.toString());
    }
    if (criteria.maxPrice) {
      params.append('price_max', criteria.maxPrice.toString());
    }

    // Home types - use Zillow's exact format
    if (criteria.homeTypes && criteria.homeTypes.length > 0) {
      const zillowTypes = criteria.homeTypes.map(type => {
        switch (type) {
          case 'single-family': return 'house';
          case 'condo': return 'condo';
          case 'townhouse': return 'townhouse';
          case 'multi-family': return 'multifamily';
          default: return 'house';
        }
      });
      params.append('home_type', zillowTypes.join(','));
    }

    // Keywords - this is where "owner finance" goes (from More dropdown)
    if (criteria.keywords) {
      params.append('keywords', criteria.keywords);
    }

    // Status - ensure we get active, for-sale properties
    params.append('searchQueryState', JSON.stringify({
      "pagination": {},
      "usersSearchTerm": criteria.location || "",
      "mapBounds": {},
      "isMapVisible": false,
      "filterState": {
        "sortSelection": {"value": "globalrelevanceex"},
        "isForSaleByAgent": {"value": false},
        "isForSaleByOwner": {"value": false},
        "isNewConstruction": {"value": false},
        "isComingSoon": {"value": false},
        "isAuction": {"value": false},
        "isForSaleForeclosure": {"value": false},
        "isAllHomes": {"value": true}
      },
      "isListVisible": true
    }));

    // Alternative simpler approach - use the direct search format
    const simpleParams = new URLSearchParams();
    
    // Price range
    if (criteria.minPrice) {
      simpleParams.append('price_min', criteria.minPrice.toString());
    }
    if (criteria.maxPrice) {
      simpleParams.append('price_max', criteria.maxPrice.toString());
    }

    // Home types
    if (criteria.homeTypes && criteria.homeTypes.length > 0) {
      const types = criteria.homeTypes.map(type => {
        switch (type) {
          case 'single-family': return 'house';
          case 'condo': return 'condo';
          case 'townhouse': return 'townhouse';
          case 'multi-family': return 'multifamily';
          default: return 'house';
        }
      });
      simpleParams.append('home_type', types.join(','));
    }

    // Keywords from More dropdown
    if (criteria.keywords) {
      simpleParams.append('keywords', encodeURIComponent(criteria.keywords));
    }

    // Use the simpler URL format that works better for scraping
    url = 'https://www.zillow.com/homes/for_sale/';
    if (criteria.location) {
      url += `${encodeURIComponent(criteria.location)}/`;
    }

    if (simpleParams.toString()) {
      url += `?${simpleParams.toString()}`;
    }

    return url;
  }

  private extractZillowPropertyUrls($: cheerio.CheerioAPI): string[] {
    const propertyUrls: string[] = [];

    // Updated Zillow-specific selectors for current website structure
    const selectors = [
      // Main property card links
      'a[data-test="property-card-link"]',
      'article[data-test="property-card"] a',
      '.property-card-link',
      // Direct homedetails links
      'a[href*="/homedetails/"]',
      // List view links
      '.list-card-link',
      '.list-card a[href*="/homedetails/"]',
      // Photo carousel links
      '.media-col a[href*="/homedetails/"]',
      // Alternative selectors
      '.zsg-photo-card-overlay-link',
      '.zsg-photo-card a'
    ];

    // Try each selector and collect URLs
    selectors.forEach(selector => {
      try {
        $(selector).each((_, element) => {
          const $element = $(element);
          let url = $element.attr('href');
          
          if (url && url.includes('/homedetails/')) {
            // Convert relative URLs to absolute
            if (url.startsWith('/')) {
              url = `https://www.zillow.com${url}`;
            }
            
            // Clean up the URL (remove query parameters and fragments)
            const cleanUrl = url.split('?')[0].split('#')[0];
            
            // Validate URL format
            if (cleanUrl.includes('/homedetails/') && cleanUrl.includes('_zpid')) {
              if (!propertyUrls.includes(cleanUrl)) {
                propertyUrls.push(cleanUrl);
              }
            }
          }
        });
      } catch (e) {
        // Continue if selector fails
      }
    });

    // If no URLs found with standard selectors, try broader search
    if (propertyUrls.length === 0) {
      $('a').each((_, element) => {
        const $element = $(element);
        const url = $element.attr('href');
        
        if (url && url.includes('/homedetails/') && url.includes('_zpid')) {
          let fullUrl = url;
          if (url.startsWith('/')) {
            fullUrl = `https://www.zillow.com${url}`;
          }
          
          const cleanUrl = fullUrl.split('?')[0].split('#')[0];
          if (!propertyUrls.includes(cleanUrl)) {
            propertyUrls.push(cleanUrl);
          }
        }
      });
    }

    return propertyUrls;
  }

  async scrapePropertyUrls(criteria: ZillowSearchCriteria, maxPages: number = 5): Promise<ZillowScrapeResult> {
    try {
      const searchUrl = this.buildZillowSearchUrl(criteria);
      
      await logInfo('Starting Zillow property URL scraping', {
        action: 'zillow_scrape_start',
        metadata: { searchUrl, criteria, maxPages }
      });

      let allPropertyUrls: string[] = [];
      
      for (let page = 1; page <= maxPages; page++) {
        let pageUrl = searchUrl;
        
        // Add pagination parameter for pages > 1
        if (page > 1) {
          const separator = searchUrl.includes('?') ? '&' : '?';
          pageUrl = `${searchUrl}${separator}p=${page}`;
        }
        
        try {
          const response = await axios.get(pageUrl, {
            headers: this.headers,
            timeout: 30000,
            validateStatus: (status) => status < 500,
          });

          if (response.status !== 200) {
            await logError(`Failed to fetch Zillow page ${page}`, {
              action: 'zillow_scrape_page',
              metadata: { pageUrl, status: response.status }
            }, new Error(`HTTP ${response.status}`));
            continue;
          }

          const $ = cheerio.load(response.data);
          const pagePropertyUrls = this.extractZillowPropertyUrls($);
          
          // If no properties found on this page, we might have reached the end
          if (pagePropertyUrls.length === 0) {
            await logInfo(`No properties found on page ${page}, stopping`, {
              action: 'zillow_scrape_page',
              metadata: { page }
            });
            break;
          }
          
          allPropertyUrls.push(...pagePropertyUrls);

          await logInfo(`Scraped Zillow page ${page}`, {
            action: 'zillow_scrape_page',
            metadata: { page, urlsFound: pagePropertyUrls.length }
          });

          // Add delay between requests to be respectful
          if (page < maxPages) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

        } catch (error) {
          await logError(`Failed to scrape Zillow page ${page}`, {
            action: 'zillow_scrape_page_error',
            metadata: { page, pageUrl }
          }, error as Error);
          
          // Continue with next page on error
          continue;
        }
      }

      // Remove duplicates
      const uniquePropertyUrls = [...new Set(allPropertyUrls)];

      const result: ZillowScrapeResult = {
        propertyUrls: uniquePropertyUrls,
        totalFound: uniquePropertyUrls.length,
        searchUrl,
        success: true
      };

      await logInfo('Zillow property URL scraping completed', {
        action: 'zillow_scrape_complete',
        metadata: { 
          totalFound: uniquePropertyUrls.length, 
          pagesScraped: maxPages,
          searchUrl 
        }
      });

      return result;

    } catch (error) {
      await logError('Zillow property URL scraping failed', {
        action: 'zillow_scrape_error',
        metadata: { criteria }
      }, error as Error);

      return {
        propertyUrls: [],
        totalFound: 0,
        searchUrl: this.buildZillowSearchUrl(criteria),
        success: false,
        error: (error as Error).message
      };
    }
  }
}

// Convenience function for your specific use case
export async function scrapeOwnerFinanceProperties(location: string, maxPrice: number = 700000, maxPages: number = 10): Promise<string[]> {
  const scraper = new ZillowScraper();
  
  const criteria: ZillowSearchCriteria = {
    location,
    maxPrice,
    homeTypes: ['single-family', 'condo', 'townhouse'],
    keywords: 'owner finance'
  };

  const result = await scraper.scrapePropertyUrls(criteria, maxPages);
  
  if (result.success) {
    return result.propertyUrls;
  } else {
    throw new Error(`Failed to scrape properties: ${result.error}`);
  }
}

// Function to scrape entire state for owner finance properties
export async function scrapeStateOwnerFinance(state: string, maxPrice: number = 700000, maxPages: number = 50): Promise<{
  allUrls: string[];
  totalFound: number;
  searchUrl: string;
}> {
  const scraper = new ZillowScraper();
  
  await logInfo('Starting state-wide owner finance scraping', {
    action: 'state_scrape_start',
    metadata: { state, maxPrice, maxPages }
  });
  
  const criteria: ZillowSearchCriteria = {
    location: state,
    maxPrice,
    homeTypes: ['single-family', 'condo', 'townhouse'],
    keywords: 'owner finance'
  };

  const result = await scraper.scrapePropertyUrls(criteria, maxPages);
  
  if (result.success) {
    await logInfo('State-wide scraping completed', {
      action: 'state_scrape_complete',
      metadata: { 
        state, 
        totalUrls: result.propertyUrls.length,
        searchUrl: result.searchUrl 
      }
    });
    
    return {
      allUrls: result.propertyUrls,
      totalFound: result.propertyUrls.length,
      searchUrl: result.searchUrl
    };
  } else {
    throw new Error(`Failed to scrape ${state}: ${result.error}`);
  }
}

// Tennessee-specific scraping function
export async function scrapeTennesseeOwnerFinance(maxPrice: number = 700000, maxPages: number = 50): Promise<string[]> {
  const result = await scrapeStateOwnerFinance('Tennessee', maxPrice, maxPages);
  return result.allUrls;
}