/**
 * Smart Regional Scrape - Only gets NEW properties we don't have
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ApifyClient } from "apify-client";

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();
const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

const SEARCH_URL = "https://www.zillow.com/homes/for_sale/?category=SEMANTIC&searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-92.99000177924067%2C%22east%22%3A-88.13404474799067%2C%22south%22%3A32.78475428845203%2C%22north%22%3A37.68144784914341%7D%2C%22mapZoom%22%3A8%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%225f8096924aX1-CR1i1r231i2qe0e_1276cg%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A500000%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%7D%2C%22isListVisible%22%3Atrue%7D";

async function smartScrape() {
  console.log("=== SMART REGIONAL SCRAPE ===\n");
  console.log("Step 1: Running search scraper to get property list...\n");

  // Step 1: Get all property ZPIDs from search (cheap operation)
  const searchRun = await apify.actor("maxcopell/zillow-scraper").call({
    searchUrls: [{ url: SEARCH_URL }],
    maxResults: 5000,
    mode: "pagination"
  }, { waitSecs: 300 });

  const { items: searchResults } = await apify.dataset(searchRun.defaultDatasetId).listItems();

  console.log(`Found ${searchResults.length} total properties in search\n`);

  // Step 2: Get all ZPIDs we already have in DB
  console.log("Step 2: Checking which ZPIDs we already have...\n");

  const existingZpids = new Set<number>();

  // Check zillow_imports
  const imports = await db.collection("zillow_imports").select("zpid").get();
  imports.docs.forEach(doc => {
    const zpid = doc.data().zpid;
    if (zpid) existingZpids.add(Number(zpid));
  });

  // Check cash_houses
  const cash = await db.collection("cash_houses").select("zpid").get();
  cash.docs.forEach(doc => {
    const zpid = doc.data().zpid;
    if (zpid) existingZpids.add(Number(zpid));
  });

  console.log(`Already have ${existingZpids.size} properties in database\n`);

  // Step 3: Find NEW properties
  const newProperties: any[] = [];

  for (const prop of searchResults as any[]) {
    const zpid = Number(prop.zpid);
    if (!existingZpids.has(zpid)) {
      newProperties.push(prop);
    }
  }

  console.log(`NEW properties not in DB: ${newProperties.length}\n`);

  if (newProperties.length === 0) {
    console.log("✅ No new properties to scrape!");
    return;
  }

  // Step 4: Only detail-scrape NEW properties (saves credits!)
  const MAX_TO_SCRAPE = 100; // Limit to control costs
  const toScrape = newProperties.slice(0, MAX_TO_SCRAPE);

  console.log(`Step 3: Detail-scraping ${toScrape.length} new properties...\n`);

  const urls = toScrape.map((p: any) => ({ url: p.detailUrl || p.url })).filter((u: any) => u.url);

  if (urls.length === 0) {
    console.log("No valid URLs to scrape");
    return;
  }

  // Show what we're about to scrape
  console.log("Properties to scrape:");
  for (let i = 0; i < Math.min(10, toScrape.length); i++) {
    const p = toScrape[i];
    console.log(`  ${i+1}. ${p.address || p.streetAddress} - $${p.price}`);
  }
  if (toScrape.length > 10) {
    console.log(`  ... and ${toScrape.length - 10} more`);
  }

  console.log(`\n⚠️  About to use Apify credits for ${urls.length} detail scrapes.`);
  console.log("Saved ~" + (searchResults.length - urls.length) + " detail scrapes by checking DB first!\n");
}

smartScrape().then(() => process.exit(0));
