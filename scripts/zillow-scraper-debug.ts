import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Debug script to inspect Zillow's actual HTML structure
 */
async function debugZillow() {
  console.log('🔍 Zillow Scraper Debug Mode\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
    ],
  });

  const page = await browser.newPage();

  // Set a realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  });

  // Try different URL formats
  const urls = [
    'https://www.zillow.com/tx/',
    'https://www.zillow.com/homes/Texas_rb/',
    'https://www.zillow.com/homes/for_sale/Texas/',
    'https://www.zillow.com/tx/houses/',
  ];

  for (const testUrl of urls) {
    console.log(`\nTesting URL: ${testUrl}`);
    console.log('-'.repeat(60));

    try {
      const response = await page.goto(testUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      console.log(`Status: ${response?.status()}`);

      // Wait a bit for any JavaScript to load
      await page.waitForTimeout(5000);

      // Take a screenshot
      const screenshotPath = path.join(
        process.cwd(),
        'scraper-output',
        `zillow-debug-${Date.now()}.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`Screenshot saved: ${screenshotPath}`);

      // Check what's on the page
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          bodyText: document.body?.innerText?.substring(0, 500),
          hasPropertyCards: !!document.querySelector('article[data-test="property-card"]'),
          hasListCards: !!document.querySelector('[class*="list-card"]'),
          hasSearchResults: !!document.querySelector('[class*="search-result"]'),
          hasPropertyList: !!document.querySelector('[class*="property"]'),
          allDataTestAttributes: Array.from(document.querySelectorAll('[data-test]'))
            .map(el => el.getAttribute('data-test'))
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 20),
          commonClasses: Array.from(document.querySelectorAll('article, [class*="card"], [class*="list"]'))
            .map(el => el.className)
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 20),
          links: Array.from(document.querySelectorAll('a[href*="/homedetails/"]'))
            .map(a => (a as HTMLAnchorElement).href)
            .slice(0, 5),
        };
      });

      console.log('\nPage Info:');
      console.log(`  Title: ${pageInfo.title}`);
      console.log(`  Final URL: ${pageInfo.url}`);
      console.log(`  Has Property Cards: ${pageInfo.hasPropertyCards}`);
      console.log(`  Has List Cards: ${pageInfo.hasListCards}`);
      console.log(`  Has Search Results: ${pageInfo.hasSearchResults}`);
      console.log(`  Has Property Elements: ${pageInfo.hasPropertyList}`);

      if (pageInfo.allDataTestAttributes.length > 0) {
        console.log('\ndata-test attributes found:');
        pageInfo.allDataTestAttributes.forEach(attr => console.log(`  - ${attr}`));
      }

      if (pageInfo.commonClasses.length > 0) {
        console.log('\nCommon classes found:');
        pageInfo.commonClasses.forEach(cls => console.log(`  - ${cls}`));
      }

      if (pageInfo.links.length > 0) {
        console.log('\nProperty links found:');
        pageInfo.links.forEach(link => console.log(`  - ${link}`));
      }

      console.log('\nBody text preview:');
      console.log(pageInfo.bodyText);

      // Save HTML for inspection
      const html = await page.content();
      const htmlPath = path.join(
        process.cwd(),
        'scraper-output',
        `zillow-debug-${Date.now()}.html`
      );
      fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
      fs.writeFileSync(htmlPath, html);
      console.log(`\nHTML saved: ${htmlPath}`);

    } catch (error) {
      console.error(`Error: ${error}`);
    }

    console.log('\nWaiting 5 seconds before next URL...\n');
    await page.waitForTimeout(5000);
  }

  console.log('\n✅ Debug complete. Check the scraper-output directory for screenshots and HTML files.');
  console.log('Press Ctrl+C to close the browser when ready.\n');

  // Keep browser open for manual inspection
  await new Promise(() => {});
}

debugZillow().catch(console.error);
