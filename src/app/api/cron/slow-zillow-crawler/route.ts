import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

// ========================================
// 🐢 SLOW CRAWLER CONFIGURATION
// ========================================
const CRAWLER_CONFIG = {
  // 📋 YOUR ZILLOW SEARCH URL
  searchUrls: [
    // Your custom search: USA-wide, $100k-$750k, 1+ bed/bath, owner financing keywords, 14 days
    'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-129.09672800572204%2C%22east%22%3A-50.522509255722056%2C%22south%22%3A-25.100328170509652%2C%22north%22%3A64.2375265423478%7D%2C%22mapZoom%22%3A4%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A100000%2C%22max%22%3A750000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A3750%7D%2C%22beds%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22tow%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22apco%22%3A%7B%22value%22%3Afalse%7D%2C%22lot%22%3A%7B%22min%22%3Anull%2C%22max%22%3A435600%2C%22units%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%2214%22%7D%2C%22att%22%3A%7B%22value%22%3A%22%5C%22owner%20financing%5C%22%20%2C%20%5C%22seller%20financing%5C%22%20%2C%20%5C%22owner%20carry%5C%22%20%2C%20%5C%22seller%20carry%5C%22%20%2C%20%5C%22financing%20available%2Foffered%5C%22%20%2C%20%5C%22creative%20financing%5C%22%20%2C%20%5C%22flexible%20financing%5C%22%2C%20%5C%22terms%20available%5C%22%2C%20%5C%22owner%20terms%5C%22%22%7D%7D%2C%22isListVisible%22%3Atrue%7D',

    // Add more search URLs here if you want to crawl multiple searches
  ],

  // Timing (VERY SLOW - looks human)
  pageLoadDelay: [180000, 300000],      // 3-5 minutes between pages
  scrollDelay: [2000, 5000],            // 2-5 seconds between scrolls
  propertyProcessDelay: [800, 2000],    // 0.8-2 seconds per property

  // Limits
  maxPagesPerRun: 1,                    // Only process 1 page per cron run
  maxPropertiesPerPage: 42,             // Zillow shows ~40 per page
};

// ========================================
// 🔧 UTILITY FUNCTIONS
// ========================================

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addPageToUrl(baseUrl: string, page: number): string {
  try {
    const url = new URL(baseUrl);
    const searchQueryState = url.searchParams.get('searchQueryState');

    if (searchQueryState) {
      const parsed = JSON.parse(searchQueryState);
      parsed.pagination = { currentPage: page };
      url.searchParams.set('searchQueryState', JSON.stringify(parsed));
      return url.toString();
    }

    // If no searchQueryState, just return original URL
    return baseUrl;
  } catch (error) {
    console.error('Error modifying URL:', error);
    return baseUrl;
  }
}

// ========================================
// 🎯 CRAWLER STATE MANAGEMENT
// ========================================

async function getCrawlerState() {
  const stateDoc = await db.collection('crawler_state').doc('zillow_slow_crawler').get();

  if (!stateDoc.exists) {
    // Initialize new crawler state
    const initialState = {
      currentUrlIndex: 0,      // Which URL from the list
      currentPage: 1,          // Which page of that URL
      lastRunAt: null,
      totalPagesProcessed: 0,
      totalPropertiesFound: 0,
      status: 'initialized',
    };

    await db.collection('crawler_state').doc('zillow_slow_crawler').set(initialState);
    return initialState;
  }

  return stateDoc.data();
}

async function updateCrawlerState(updates: any) {
  await db.collection('crawler_state').doc('zillow_slow_crawler').update({
    ...updates,
    lastRunAt: new Date(),
  });
}

// ========================================
// 🤖 MAIN CRAWLER FUNCTION
// ========================================

export async function GET(request: NextRequest) {
  console.log('🐢 [SLOW CRAWLER] Starting human-like Zillow crawler');

  const startTime = Date.now();
  const metrics = {
    propertiesFound: 0,
    propertiesAdded: 0,
    propertiesDuplicate: 0,
    pagesProcessed: 0,
    currentUrlIndex: 0,
    currentPage: 0,
    searchUrl: '',
  };

  try {
    // Get current crawler state
    const state = await getCrawlerState();
    const currentUrlIndex = state.currentUrlIndex;
    const currentPage = state.currentPage;

    metrics.currentUrlIndex = currentUrlIndex;
    metrics.currentPage = currentPage;

    // Get the base URL from config
    const baseUrl = CRAWLER_CONFIG.searchUrls[currentUrlIndex];

    if (!baseUrl) {
      throw new Error(`No URL found at index ${currentUrlIndex}. Check your CRAWLER_CONFIG.searchUrls`);
    }

    // Add page number to URL
    const searchUrl = addPageToUrl(baseUrl, currentPage);
    metrics.searchUrl = searchUrl;

    console.log(`📍 [SLOW CRAWLER] Processing URL #${currentUrlIndex + 1}, Page ${currentPage}`);
    console.log(`🔗 [SLOW CRAWLER] URL: ${searchUrl}`);

    // ========================================
    // 🌐 PUPPETEER: Simulate Real Browser (Local + Serverless)
    // ========================================
    const isLocal = process.env.NODE_ENV === 'development';

    let browser;

    if (isLocal) {
      // Local development: use puppeteer-extra with stealth
      console.log('🚀 [SLOW CRAWLER] Launching browser (LOCAL + STEALTH)...');
      const puppeteerExtra = await import('puppeteer-extra');
      const StealthPlugin = await import('puppeteer-extra-plugin-stealth');

      puppeteerExtra.default.use(StealthPlugin.default());

      browser = await puppeteerExtra.default.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
        ignoreHTTPSErrors: true,
      });
    } else {
      // Production/Vercel: use serverless chromium
      console.log('🚀 [SLOW CRAWLER] Launching browser (SERVERLESS)...');
      const puppeteer = await import('puppeteer-core');
      const chromium = await import('@sparticuz/chromium');
      browser = await puppeteer.default.launch({
        args: chromium.default.args,
        defaultViewport: chromium.default.defaultViewport,
        executablePath: await chromium.default.executablePath(),
        headless: chromium.default.headless,
      });
    }

    const page = await browser.newPage();

    // 🎭 STEALTH: Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 🎭 STEALTH: Remove webdriver flag
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    console.log('📄 [SLOW CRAWLER] Navigating to Zillow...');

    // Navigate to page with realistic timeout
    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    console.log('⏳ [SLOW CRAWLER] Waiting for page to settle (like a human reading)...');
    await new Promise(resolve => setTimeout(resolve, randomDelay(5000, 8000)));

    // ========================================
    // 🤖 CAPTCHA BYPASS: Press & Hold Button
    // ========================================
    console.log('🔍 [SLOW CRAWLER] Checking for CAPTCHA...');

    const hasCaptcha = await page.evaluate(() => {
      // Check if page contains "Press & Hold" text anywhere
      const bodyText = document.body.innerText || '';
      return bodyText.includes('Press & Hold') || bodyText.includes('confirm you are');
    });

    if (hasCaptcha) {
      console.log('🤖 [CAPTCHA] Detected Press & Hold challenge - simulating human press...');

      try {
        // Find the button using page.evaluate and click it
        const buttonClicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const pressButton = buttons.find(btn =>
            btn.textContent?.includes('Press') || btn.textContent?.includes('Hold')
          );

          if (pressButton) {
            // Get button position for logging
            const rect = pressButton.getBoundingBox();

            // Simulate mousedown and mouseup events (press and hold)
            pressButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            setTimeout(() => {
              pressButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              pressButton.click();
            }, 2500); // Hold for 2.5 seconds

            return true;
          }
          return false;
        });

        if (buttonClicked) {
          console.log('   ✅ Clicked Press & Hold button');

          // Wait for page to load after CAPTCHA
          await new Promise(resolve => setTimeout(resolve, randomDelay(5000, 7000)));

          console.log('✅ [CAPTCHA] Bypassed successfully!');
        } else {
          console.log('   ⚠️  Could not find Press & Hold button');
        }
      } catch (error) {
        console.error('❌ [CAPTCHA] Failed to bypass:', error);
      }
    } else {
      console.log('✅ [CAPTCHA] No CAPTCHA detected');
    }

    // ========================================
    // 🐢 SLOW SCROLL: Like a Human
    // ========================================
    console.log('📜 [SLOW CRAWLER] Scrolling slowly to load all properties...');

    await page.evaluate(async () => {
      const scrollDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const totalHeight = document.body.scrollHeight;
      let currentPosition = 0;
      const scrollStep = 300; // Scroll 300px at a time

      while (currentPosition < totalHeight) {
        window.scrollBy(0, scrollStep);
        currentPosition += scrollStep;

        // Random pause between scrolls (2-5 seconds)
        await scrollDelay(2000 + Math.random() * 3000);
      }

      // Scroll back up a bit (humans do this)
      window.scrollBy(0, -500);
      await scrollDelay(1000);
    });

    console.log('✅ [SLOW CRAWLER] Finished scrolling');

    // ========================================
    // 🏠 EXTRACT PROPERTIES
    // ========================================
    console.log('🔍 [SLOW CRAWLER] Extracting property data...');

    // 🐛 DEBUG: Take screenshot to see what the page looks like
    if (isLocal) {
      try {
        await page.screenshot({ path: 'zillow-debug.png', fullPage: true });
        console.log('📸 [DEBUG] Screenshot saved to zillow-debug.png');
      } catch (error) {
        console.log('⚠️  [DEBUG] Could not save screenshot');
      }
    }

    // Also log the page HTML to see the structure
    const htmlSample = await page.evaluate(() => {
      return document.body.innerHTML.substring(0, 500);
    });
    console.log('📄 [DEBUG] Page HTML sample:', htmlSample);

    const properties = await page.evaluate(() => {
      const propertyLinks = document.querySelectorAll('a[href*="/homedetails/"]');
      const urls = new Set<string>();
      const results: Array<{ url: string; address: string; price: string }> = [];

      propertyLinks.forEach((link) => {
        const url = (link as HTMLAnchorElement).href;

        if (!urls.has(url)) {
          urls.add(url);

          const card = link.closest('article') || link.closest('[data-test="property-card"]');

          let address = '';
          let price = '';

          if (card) {
            const addressEl = card.querySelector('address');
            if (addressEl) address = addressEl.textContent?.trim() || '';

            const priceEl = card.querySelector('[data-test="property-card-price"]');
            if (priceEl) price = priceEl.textContent?.trim() || '';
          }

          results.push({ url, address, price });
        }
      });

      return results;
    });

    metrics.propertiesFound = properties.length;
    console.log(`🏘️  [SLOW CRAWLER] Found ${properties.length} properties`);

    // Close browser
    await browser.close();

    // ========================================
    // 💾 SAVE TO FIREBASE QUEUE
    // ========================================
    console.log('💾 [SLOW CRAWLER] Saving to scraper queue...');

    for (const property of properties) {
      // 🐢 SLOW: Add delay between property processing
      await new Promise(resolve =>
        setTimeout(resolve, randomDelay(...CRAWLER_CONFIG.propertyProcessDelay))
      );

      // Check for duplicates
      const existingInQueue = await db
        .collection('scraper_queue')
        .where('url', '==', property.url)
        .limit(1)
        .get();

      const existingInImports = await db
        .collection('zillow_imports')
        .where('url', '==', property.url)
        .limit(1)
        .get();

      if (existingInQueue.empty && existingInImports.empty) {
        // Add to queue
        await db.collection('scraper_queue').add({
          url: property.url,
          address: property.address,
          price: property.price,
          source: 'slow_crawler',
          searchUrlIndex: currentUrlIndex,
          page: currentPage,
          status: 'pending',
          addedAt: new Date(),
        });

        metrics.propertiesAdded++;
        console.log(`  ✅ Added: ${property.address}`);
      } else {
        metrics.propertiesDuplicate++;
        console.log(`  ⏭️  Skipped (duplicate): ${property.address}`);
      }
    }

    metrics.pagesProcessed = 1;

    // ========================================
    // 🔄 UPDATE CRAWLER STATE
    // ========================================

    // Move to next page
    const nextPage = currentPage + 1;

    // Check if we should move to next URL (after 35 pages or no properties found)
    const shouldMoveToNextUrl = nextPage > 35 || metrics.propertiesFound === 0;

    if (shouldMoveToNextUrl) {
      const nextUrlIndex = (currentUrlIndex + 1) % CRAWLER_CONFIG.searchUrls.length;

      await updateCrawlerState({
        currentUrlIndex: nextUrlIndex,
        currentPage: 1,
        totalPagesProcessed: state.totalPagesProcessed + 1,
        totalPropertiesFound: state.totalPropertiesFound + metrics.propertiesFound,
        status: 'active',
      });

      console.log(
        `🔄 [SLOW CRAWLER] Completed URL #${currentUrlIndex + 1}. Moving to URL #${nextUrlIndex + 1}`
      );
    } else {
      await updateCrawlerState({
        currentPage: nextPage,
        totalPagesProcessed: state.totalPagesProcessed + 1,
        totalPropertiesFound: state.totalPropertiesFound + metrics.propertiesFound,
        status: 'active',
      });

      console.log(`📄 [SLOW CRAWLER] Moving to page ${nextPage}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n📊 ============ SLOW CRAWLER METRICS ============`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📍 URL: #${metrics.currentUrlIndex + 1} (Page ${metrics.currentPage})`);
    console.log(`🏘️  Properties Found: ${metrics.propertiesFound}`);
    console.log(`✅ Properties Added: ${metrics.propertiesAdded}`);
    console.log(`⏭️  Duplicates Skipped: ${metrics.propertiesDuplicate}`);
    console.log(`📄 Pages Processed: ${metrics.pagesProcessed}`);
    console.log(`========================================\n`);

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      metrics,
      nextRun: {
        urlIndex: shouldMoveToNextUrl
          ? (currentUrlIndex + 1) % CRAWLER_CONFIG.searchUrls.length
          : currentUrlIndex,
        page: shouldMoveToNextUrl ? 1 : nextPage,
      },
    });
  } catch (error: any) {
    console.error('❌ [SLOW CRAWLER] Error:', error);

    return NextResponse.json(
      {
        error: error.message,
        metrics,
      },
      { status: 500 }
    );
  }
}
