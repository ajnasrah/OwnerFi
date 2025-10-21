import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface PropertyData {
  url: string;
  address: string;
  price: string;
  state: string;
  description?: string;
}

interface ScraperConfig {
  maxPrice: number;
  keywords: string[];
  daysListed: number;
  propertyType: string;
  states: string[];
  headless: boolean;
  delayBetweenPages: number;
  delayBetweenStates: number;
  maxRetries: number;
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New-Hampshire', 'New-Jersey', 'New-Mexico', 'New-York',
  'North-Carolina', 'North-Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode-Island', 'South-Carolina', 'South-Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West-Virginia', 'Wisconsin', 'Wyoming'
];

class ZillowScraper {
  private config: ScraperConfig;
  private browser: Browser | null = null;
  private allProperties: PropertyData[] = [];

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = {
      maxPrice: config.maxPrice || 1000000,
      keywords: config.keywords || ['owner finance', 'owner financing', 'seller financing'],
      daysListed: config.daysListed || 30,
      propertyType: config.propertyType || 'single-family',
      states: config.states || US_STATES,
      headless: config.headless !== false,
      delayBetweenPages: config.delayBetweenPages || 3000,
      delayBetweenStates: config.delayBetweenStates || 5000,
      maxRetries: config.maxRetries || 3,
    };
  }

  /**
   * Build Zillow search URL with filters
   */
  private buildSearchUrl(state: string, pageNumber: number = 1): string {
    // Zillow URL structure for state-wide search
    // Example: https://www.zillow.com/homes/Alabama_rb/
    const baseUrl = `https://www.zillow.com/${state}_rb`;

    // Build filter string
    // Format: price_max, days on market, property type
    const filters: string[] = [];

    // Price filter (price max)
    filters.push(`price:0-${this.config.maxPrice}`);

    // Days listed filter
    filters.push(`days:${this.config.daysListed}`);

    // Property type filter (single family home)
    if (this.config.propertyType === 'single-family') {
      filters.push('sf');
    }

    // Pagination
    if (pageNumber > 1) {
      filters.push(`${pageNumber}_p`);
    }

    // Combine filters
    const filterString = filters.join('_');
    return `${baseUrl}/${filterString}`;
  }

  /**
   * Initialize browser
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      console.log('Launching browser...');
      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
        ],
      });
    }
  }

  /**
   * Close browser
   */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Random delay to avoid detection
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Check if property description contains keywords
   */
  private containsKeywords(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.config.keywords.some(keyword =>
      lowerText.includes(keyword.toLowerCase())
    );
  }

  /**
   * Scrape properties from a single page
   */
  private async scrapePage(page: Page, state: string, pageNumber: number): Promise<PropertyData[]> {
    const url = this.buildSearchUrl(state, pageNumber);
    console.log(`\nScraping: ${url}`);

    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      // Wait for property listings to load
      await page.waitForSelector('article[data-test="property-card"]', { timeout: 10000 });

      // Extract property data
      const properties = await page.evaluate(() => {
        const propertyCards = document.querySelectorAll('article[data-test="property-card"]');
        const results: any[] = [];

        propertyCards.forEach((card) => {
          try {
            // Get property link
            const link = card.querySelector('a[data-test="property-card-link"]');
            const url = link?.getAttribute('href') || '';

            // Get address
            const addressEl = card.querySelector('address');
            const address = addressEl?.textContent?.trim() || '';

            // Get price
            const priceEl = card.querySelector('[data-test="property-card-price"]');
            const price = priceEl?.textContent?.trim() || '';

            if (url && address) {
              results.push({
                url: url.startsWith('http') ? url : `https://www.zillow.com${url}`,
                address,
                price,
              });
            }
          } catch (err) {
            console.error('Error extracting property:', err);
          }
        });

        return results;
      });

      console.log(`Found ${properties.length} properties on page ${pageNumber}`);

      // Add state to each property
      const propertiesWithState = properties.map(prop => ({
        ...prop,
        state,
      }));

      return propertiesWithState;

    } catch (error) {
      console.error(`Error scraping page ${pageNumber} for ${state}:`, error);
      return [];
    }
  }

  /**
   * Check property details page for keywords
   */
  private async checkPropertyForKeywords(page: Page, propertyUrl: string): Promise<boolean> {
    try {
      await page.goto(propertyUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Extract description text
      const description = await page.evaluate(() => {
        // Look for description in various possible locations
        const selectors = [
          '[data-test="description"]',
          '.home-description',
          '[class*="description"]',
          '[class*="Description"]',
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element?.textContent) {
            return element.textContent;
          }
        }

        // Fallback: get all text from body
        return document.body.textContent || '';
      });

      return this.containsKeywords(description);
    } catch (error) {
      console.error(`Error checking property ${propertyUrl}:`, error);
      return false;
    }
  }

  /**
   * Scrape all pages for a state
   */
  private async scrapeState(state: string): Promise<PropertyData[]> {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Starting scrape for ${state}`);
    console.log('='.repeat(50));

    const stateProperties: PropertyData[] = [];
    let pageNumber = 1;
    let hasMorePages = true;

    await this.initBrowser();
    if (!this.browser) return stateProperties;

    const page = await this.browser.newPage();

    // Set user agent to avoid detection
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    try {
      while (hasMorePages && pageNumber <= 20) { // Limit to 20 pages per state
        const properties = await this.scrapePage(page, state, pageNumber);

        if (properties.length === 0) {
          console.log(`No more properties found for ${state}`);
          hasMorePages = false;
          break;
        }

        // Filter properties by checking descriptions for keywords
        console.log('Checking properties for keywords...');
        const filteredProperties: PropertyData[] = [];

        for (const property of properties) {
          await this.randomDelay(1000, 3000);

          const hasKeywords = await this.checkPropertyForKeywords(page, property.url);
          if (hasKeywords) {
            console.log(`✓ Found matching property: ${property.address}`);
            filteredProperties.push(property);
          }
        }

        stateProperties.push(...filteredProperties);
        console.log(`Page ${pageNumber} complete: ${filteredProperties.length} matching properties`);

        pageNumber++;
        await this.randomDelay(
          this.config.delayBetweenPages,
          this.config.delayBetweenPages + 2000
        );
      }
    } catch (error) {
      console.error(`Error scraping ${state}:`, error);
    } finally {
      await page.close();
    }

    console.log(`\nCompleted ${state}: ${stateProperties.length} total matching properties`);
    return stateProperties;
  }

  /**
   * Run scraper for all states
   */
  async scrapeAllStates(): Promise<void> {
    console.log('\n🚀 Starting Zillow Scraper');
    console.log(`Configuration:`);
    console.log(`  - Max Price: $${this.config.maxPrice.toLocaleString()}`);
    console.log(`  - Keywords: ${this.config.keywords.join(', ')}`);
    console.log(`  - Days Listed: ${this.config.daysListed}`);
    console.log(`  - Property Type: ${this.config.propertyType}`);
    console.log(`  - States: ${this.config.states.length}`);
    console.log('\n');

    for (const state of this.config.states) {
      try {
        const properties = await this.scrapeState(state);
        this.allProperties.push(...properties);

        // Save progress after each state
        this.saveToFile('zillow-scraper-progress.json');

        // Delay between states
        if (state !== this.config.states[this.config.states.length - 1]) {
          console.log(`\nWaiting before next state...`);
          await this.randomDelay(
            this.config.delayBetweenStates,
            this.config.delayBetweenStates + 3000
          );
        }
      } catch (error) {
        console.error(`Failed to scrape ${state}:`, error);
        continue;
      }
    }

    await this.closeBrowser();

    console.log('\n✅ Scraping Complete!');
    console.log(`Total properties found: ${this.allProperties.length}`);

    // Save final results
    this.saveToFile('zillow-scraper-results.json');
    this.saveToCSV('zillow-scraper-results.csv');
  }

  /**
   * Save results to JSON file
   */
  private saveToFile(filename: string): void {
    const outputPath = path.join(process.cwd(), 'scraper-output', filename);

    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(this.allProperties, null, 2));
    console.log(`\n💾 Saved results to: ${outputPath}`);
  }

  /**
   * Save results to CSV file
   */
  private saveToCSV(filename: string): void {
    const outputPath = path.join(process.cwd(), 'scraper-output', filename);

    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create CSV content
    const headers = ['State', 'Address', 'Price', 'URL'];
    const rows = this.allProperties.map(prop => [
      prop.state,
      prop.address,
      prop.price,
      prop.url,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    fs.writeFileSync(outputPath, csvContent);
    console.log(`💾 Saved CSV to: ${outputPath}`);
  }

  /**
   * Get current results
   */
  getResults(): PropertyData[] {
    return this.allProperties;
  }
}

// Main execution
async function main() {
  const scraper = new ZillowScraper({
    maxPrice: 1000000,
    keywords: ['owner finance', 'owner financing', 'seller financing'],
    daysListed: 30,
    propertyType: 'single-family',
    states: US_STATES, // Run for all states
    headless: true, // Set to false to see browser
    delayBetweenPages: 3000,
    delayBetweenStates: 5000,
  });

  await scraper.scrapeAllStates();
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { ZillowScraper, ScraperConfig, PropertyData };
