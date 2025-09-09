import axios from 'axios';
import * as cheerio from 'cheerio';
import { logInfo, logError } from './logger';

export interface SearchCriteria {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  sortBy?: string;
}

export interface ScrapedProperty {
  url: string;
  address?: string;
  price?: string;
  bedrooms?: string;
  bathrooms?: string;
  squareFeet?: string;
}

export interface ScrapeResult {
  properties: ScrapedProperty[];
  totalFound: number;
  searchUrl: string;
  success: boolean;
  error?: string;
}

export class PropertyScraper {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };
  }

  private buildSearchUrl(criteria: SearchCriteria): string {
    const params = new URLSearchParams();
    
    if (criteria.location) params.append('location', criteria.location);
    if (criteria.minPrice) params.append('min_price', criteria.minPrice.toString());
    if (criteria.maxPrice) params.append('max_price', criteria.maxPrice.toString());
    if (criteria.bedrooms) params.append('beds', criteria.bedrooms.toString());
    if (criteria.bathrooms) params.append('baths', criteria.bathrooms.toString());
    if (criteria.propertyType) params.append('type', criteria.propertyType);
    if (criteria.sortBy) params.append('sort', criteria.sortBy);

    return `${this.baseUrl}/search?${params.toString()}`;
  }

  private extractPropertyUrls($: cheerio.CheerioAPI, baseUrl: string): ScrapedProperty[] {
    const properties: ScrapedProperty[] = [];

    // Common property card selectors - adjust based on target website
    const selectors = [
      '.property-card a',
      '.listing-card a',
      '.property-item a',
      '[data-testid="property-card"] a',
      '.property-link',
      '.listing-link'
    ];

    selectors.forEach(selector => {
      $(selector).each((_, element) => {
        const $element = $(element);
        let url = $element.attr('href');
        
        if (url) {
          // Convert relative URLs to absolute
          if (url.startsWith('/')) {
            url = new URL(url, baseUrl).href;
          } else if (!url.startsWith('http')) {
            url = new URL(url, baseUrl).href;
          }

          // Extract additional property info if available
          const propertyCard = $element.closest('.property-card, .listing-card, .property-item');
          
          const property: ScrapedProperty = {
            url,
            address: propertyCard.find('.address, .property-address, [data-testid="address"]').text().trim() || undefined,
            price: propertyCard.find('.price, .property-price, [data-testid="price"]').text().trim() || undefined,
            bedrooms: propertyCard.find('.beds, .bedrooms, [data-testid="beds"]').text().trim() || undefined,
            bathrooms: propertyCard.find('.baths, .bathrooms, [data-testid="baths"]').text().trim() || undefined,
            squareFeet: propertyCard.find('.sqft, .square-feet, [data-testid="sqft"]').text().trim() || undefined,
          };

          properties.push(property);
        }
      });
    });

    // Remove duplicates based on URL
    const uniqueProperties = properties.filter((property, index, arr) => 
      arr.findIndex(p => p.url === property.url) === index
    );

    return uniqueProperties;
  }

  async scrapeProperties(criteria: SearchCriteria, maxPages: number = 1): Promise<ScrapeResult> {
    try {
      const searchUrl = this.buildSearchUrl(criteria);
      await logInfo('Starting property scraping', {
        action: 'scrape_start',
        metadata: { searchUrl, criteria, maxPages }
      });

      const allProperties: ScrapedProperty[] = [];
      
      for (let page = 1; page <= maxPages; page++) {
        const pageUrl = page > 1 ? `${searchUrl}&page=${page}` : searchUrl;
        
        try {
          const response = await axios.get(pageUrl, {
            headers: this.headers,
            timeout: 30000,
            validateStatus: (status) => status < 500, // Don't throw on 4xx errors
          });

          if (response.status !== 200) {
            await logError('Failed to fetch search results', {
              action: 'scrape_page',
              metadata: { pageUrl, status: response.status }
            }, new Error(`HTTP ${response.status}`));
            continue;
          }

          const $ = cheerio.load(response.data);
          const baseUrl = new URL(pageUrl).origin;
          const pageProperties = this.extractPropertyUrls($, baseUrl);
          
          allProperties.push(...pageProperties);

          await logInfo(`Scraped page ${page}`, {
            action: 'scrape_page',
            metadata: { page, propertiesFound: pageProperties.length }
          });

          // Add delay between requests to be respectful
          if (page < maxPages) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          await logError(`Failed to scrape page ${page}`, {
            action: 'scrape_page',
            metadata: { page, pageUrl }
          }, error as Error);
        }
      }

      // Remove duplicates across all pages
      const uniqueProperties = allProperties.filter((property, index, arr) => 
        arr.findIndex(p => p.url === property.url) === index
      );

      const result: ScrapeResult = {
        properties: uniqueProperties,
        totalFound: uniqueProperties.length,
        searchUrl,
        success: true
      };

      await logInfo('Property scraping completed', {
        action: 'scrape_complete',
        metadata: { totalFound: uniqueProperties.length, pagesScraped: maxPages }
      });

      return result;

    } catch (error) {
      await logError('Property scraping failed', {
        action: 'scrape_error',
        metadata: { criteria }
      }, error as Error);

      return {
        properties: [],
        totalFound: 0,
        searchUrl: this.buildSearchUrl(criteria),
        success: false,
        error: (error as Error).message
      };
    }
  }

  // Method to scrape a specific property listing page for detailed info
  async scrapePropertyDetails(propertyUrl: string): Promise<any> {
    try {
      const response = await axios.get(propertyUrl, {
        headers: this.headers,
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      
      // Extract detailed property information
      return {
        url: propertyUrl,
        address: $('.address, .property-address').text().trim(),
        price: $('.price, .property-price').text().trim(),
        bedrooms: $('.beds, .bedrooms').text().trim(),
        bathrooms: $('.baths, .bathrooms').text().trim(),
        squareFeet: $('.sqft, .square-feet').text().trim(),
        lotSize: $('.lot-size').text().trim(),
        description: $('.description, .property-description').text().trim(),
        images: $('.property-images img').map((_, img) => $(img).attr('src')).get(),
        features: $('.features li, .amenities li').map((_, li) => $(li).text().trim()).get(),
      };
    } catch (error) {
      await logError('Failed to scrape property details', {
        action: 'scrape_property_details',
        metadata: { propertyUrl }
      }, error as Error);
      throw error;
    }
  }
}

// Factory function to create scrapers for different websites
export function createScraper(website: string): PropertyScraper {
  const scrapers = {
    'realtor.com': new PropertyScraper('https://www.realtor.com'),
    'zillow.com': new PropertyScraper('https://www.zillow.com'),
    'redfin.com': new PropertyScraper('https://www.redfin.com'),
    'trulia.com': new PropertyScraper('https://www.trulia.com'),
  };

  if (!(website in scrapers)) {
    throw new Error(`Unsupported website: ${website}. Supported sites: ${Object.keys(scrapers).join(', ')}`);
  }

  return scrapers[website as keyof typeof scrapers];
}