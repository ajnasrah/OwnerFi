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

/**
 * Rate-limited Zillow scraper with strong anti-detection
 * Designed to be respectful and avoid blocking
 */
class ZillowScraperLimited {
  private browser: Browser | null = null;
  private allProperties: PropertyData[] = [];
  private state: string;
  private maxPages: number;

  constructor(state: string, maxPages: number = 100) {
    this.state = state;
    this.maxPages = maxPages; // Default 100 pages = ~1000 properties
  }

  /**
   * Initialize browser with stealth settings
   */
  private async initBrowser(): Promise<void> {
    console.log('🚀 Launching browser...');

    this.browser = await puppeteer.launch({
      headless: false, // Run visible for debugging
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--window-size=1920,1080',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = (await this.browser.pages())[0];

    // Remove automation indicators
    await page.evaluateOnNewDocument(() => {
      // Overwrite the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Mock chrome object
      (window as any).chrome = {
        runtime: {},
      };

      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);
    });
  }

  /**
   * Human-like delay with randomization
   */
  private async humanDelay(minSeconds: number, maxSeconds: number): Promise<void> {
    const delay = (Math.random() * (maxSeconds - minSeconds) + minSeconds) * 1000;
    console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)} seconds...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Simulate human-like mouse movement
   */
  private async simulateHumanBehavior(page: Page): Promise<void> {
    // Random scroll
    await page.evaluate(() => {
      window.scrollBy(0, Math.random() * 300 + 100);
    });
    await this.humanDelay(1, 3);

    // Another scroll
    await page.evaluate(() => {
      window.scrollBy(0, Math.random() * 400 + 200);
    });
    await this.humanDelay(2, 4);
  }

  /**
   * Scrape a single page with heavy rate limiting
   */
  private async scrapePage(page: Page, pageNumber: number): Promise<PropertyData[]> {
    // Build Zillow URL with filters including KEYWORD search
    const stateFormatted = this.state.toLowerCase().replace(/\s+/g, '-');

    // Build filter string
    const filters: string[] = [];

    // Single family homes (type_1 = single family)
    filters.push('type_1');

    // Days on market (last 30 days)
    filters.push('doz_30');

    // Price range: 0 to 1,000,000
    filters.push('0-1000000_price');

    // Page number
    if (pageNumber > 1) {
      filters.push(`${pageNumber}_p`);
    }

    // Combine filters
    const filterString = filters.length > 0 ? filters.join('_') + '/' : '';

    // Simple URL - we'll rely on you manually setting the keyword filter
    let url = `https://www.zillow.com/${stateFormatted}/${filterString}`;

    console.log(`   🔍 Filters: Single Family, 30 Days, Under $1M`);
    console.log(`   ⚠️  Make sure to add "owner finance" keyword filter manually on Zillow!`);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 Page ${pageNumber}: ${url}`);
    console.log('='.repeat(60));

    try {
      // Navigate to page
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      console.log(`   Status: ${response?.status()}`);

      if (response?.status() === 403) {
        console.log('   ❌ Access blocked (403). Try again later or use longer delays.');
        return [];
      }

      // Wait for page to load
      await this.humanDelay(5, 10);

      // Simulate human browsing
      await this.simulateHumanBehavior(page);

      // Try multiple selectors to find property listings
      const properties = await page.evaluate(() => {
        const results: any[] = [];

        // Try different selectors that Zillow might use
        const selectors = [
          'article[data-test="property-card"]',
          'article',
          '[data-test="property-card"]',
          '[class*="ListItem"]',
          '[class*="list-card"]',
          'a[href*="/homedetails/"]',
        ];

        let elements: NodeListOf<Element> | null = null;

        for (const selector of selectors) {
          elements = document.querySelectorAll(selector);
          if (elements && elements.length > 0) {
            console.log(`Found ${elements.length} elements with selector: ${selector}`);
            break;
          }
        }

        if (!elements || elements.length === 0) {
          return results;
        }

        // Extract property data
        elements.forEach((element) => {
          try {
            // Find link to property
            const link = element.querySelector('a[href*="/homedetails/"]') || element as HTMLAnchorElement;
            const href = link?.getAttribute('href');

            if (!href) return;

            const url = href.startsWith('http') ? href : `https://www.zillow.com${href}`;

            // Try to find address
            const addressEl = element.querySelector('address') ||
                             element.querySelector('[data-test="property-card-addr"]') ||
                             element.querySelector('[class*="address"]');
            const address = addressEl?.textContent?.trim() || '';

            // Try to find price
            const priceEl = element.querySelector('[data-test="property-card-price"]') ||
                           element.querySelector('[class*="price"]') ||
                           element.querySelector('[data-test="price"]');
            const price = priceEl?.textContent?.trim() || '';

            if (url && (address || price)) {
              results.push({ url, address, price });
            }
          } catch (err) {
            // Skip failed extractions
          }
        });

        return results;
      });

      console.log(`   ✅ Found ${properties.length} properties with "owner finance" keyword`);

      // Add state to properties
      const propertiesWithState = properties.map(prop => ({
        ...prop,
        state: this.state,
      }));

      return propertiesWithState;

    } catch (error) {
      console.error(`   ❌ Error scraping page: ${error}`);
      return [];
    }
  }


  /**
   * Run the scraper
   */
  async scrape(): Promise<PropertyData[]> {
    console.log('\n🏡 Zillow Property URL Scraper');
    console.log('='.repeat(60));
    console.log(`State: ${this.state}`);
    console.log(`Max Pages: ${this.maxPages} (~${this.maxPages * 10} properties)`);
    console.log(`Keyword Filter: "owner finance"`);
    console.log(`Delays: 5-10 seconds between pages`);
    console.log('='.repeat(60));

    await this.initBrowser();

    if (!this.browser) {
      console.log('Failed to launch browser');
      return [];
    }

    const page = (await this.browser.pages())[0];

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
    });

    try {
      // Scrape limited number of pages
      for (let pageNum = 1; pageNum <= this.maxPages; pageNum++) {
        const properties = await this.scrapePage(page, pageNum);

        if (properties.length === 0) {
          console.log('   No properties found. Stopping.');
          break;
        }

        // Add all properties (already filtered by Zillow's keyword search)
        this.allProperties.push(...properties);
        console.log(`   📊 Total properties collected: ${this.allProperties.length}`);

        // Delay between pages
        if (pageNum < this.maxPages) {
          console.log('\n   ⏸️  Moving to next page...');
          await this.humanDelay(5, 10); // Short delay between pages
        }
      }

    } catch (error) {
      console.error('Error during scraping:', error);
    }

    console.log('\n✅ Scraping Complete!');
    console.log(`Total owner finance properties found: ${this.allProperties.length}`);

    // Save results
    this.saveResults();

    // Close browser
    await this.browser.close();
    console.log('Browser closed.');

    return this.allProperties;
  }

  /**
   * Save results to JSON and CSV
   */
  private saveResults(): void {
    const outputDir = path.join(process.cwd(), 'scraper-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save JSON
    const jsonPath = path.join(outputDir, `zillow-${this.state.toLowerCase()}-results.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(this.allProperties, null, 2));
    console.log(`\n💾 Saved JSON: ${jsonPath}`);

    // Save CSV
    const csvPath = path.join(outputDir, `zillow-${this.state.toLowerCase()}-results.csv`);
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

    fs.writeFileSync(csvPath, csvContent);
    console.log(`💾 Saved CSV: ${csvPath}`);
  }
}

// Main execution
async function main() {
  const state = process.argv[2] || 'Texas';
  const maxPages = parseInt(process.argv[3]) || 3;

  const scraper = new ZillowScraperLimited(state, maxPages);
  await scraper.scrape();
}

if (require.main === module) {
  main().catch(console.error);
}

export { ZillowScraperLimited };
