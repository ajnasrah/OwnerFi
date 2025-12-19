/**
 * Debug - check what data we're getting from detail scraper
 */
import { ApifyClient } from "apify-client";

const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

const DETAIL_ACTOR = "maxcopell/zillow-detail-scraper";

// Test with just 5 URLs
const TEST_URLS = [
  "https://www.zillow.com/homedetails/8652-Branson-Dr-Bartlett-TN-38133/161759489_zpid/",
  "https://www.zillow.com/homedetails/5116-Nancy-Ct-Little-Rock-AR-72204/99417563_zpid/",
  "https://www.zillow.com/homedetails/17142-S-Alexander-Rd-Alexander-AR-72002/378445_zpid/",
  "https://www.zillow.com/homedetails/3590-Thomas-St-Memphis-TN-38127/457209239_zpid/",
  "https://www.zillow.com/homedetails/5877-Hickory-Cmns-Memphis-TN-38141/42336201_zpid/"
];

async function debugDetailScraper() {
  console.log("=== DEBUG DETAIL SCRAPER ===\n");
  console.log(`Testing with ${TEST_URLS.length} URLs...\n`);

  const run = await apify.actor(DETAIL_ACTOR).start({
    startUrls: TEST_URLS.map(url => ({ url })),
  });

  console.log(`Run ID: ${run.id}`);
  console.log("Waiting for completion...\n");

  const finishedRun = await apify.run(run.id).waitForFinish({ waitSecs: 120 });

  console.log(`Status: ${finishedRun.status}\n`);

  const { items } = await apify.dataset(finishedRun.defaultDatasetId).listItems();

  console.log(`Got ${items.length} results\n`);

  for (let i = 0; i < items.length; i++) {
    const prop = items[i] as any;
    console.log(`\n--- Property ${i + 1} ---`);
    console.log(`ZPID: ${prop.zpid}`);
    console.log(`Address: ${JSON.stringify(prop.address)}`);
    console.log(`Street: ${prop.streetAddress}`);
    console.log(`City: ${prop.city}`);
    console.log(`Price: ${prop.price}`);
    console.log(`Zestimate: ${prop.zestimate}`);
    console.log(`Description length: ${prop.description?.length || 0}`);
    console.log(`Description preview: ${prop.description?.substring(0, 200) || "NO DESCRIPTION"}...`);
    console.log(`Has bedrooms: ${prop.bedrooms}`);
    console.log(`Has bathrooms: ${prop.bathrooms}`);
  }
}

debugDetailScraper().then(() => process.exit(0));
