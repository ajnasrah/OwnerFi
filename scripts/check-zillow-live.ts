/**
 * Check live Zillow status using Apify detail scraper
 */

import { ApifyClient } from 'apify-client';
import { getAdminDb } from '../src/lib/firebase-admin';
import Typesense from 'typesense';

const MISSING_ZPIDS = [
  42212704, 94726151, 2057637761, 161591197, 42325513,
  42274392, 2057609639, 301965, 291337, 450678102
];

async function main() {
  const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });
  const db = await getAdminDb();
  const typesense = new Typesense.Client({
    nodes: [{ host: process.env.TYPESENSE_HOST || "", port: 443, protocol: "https" }],
    apiKey: process.env.TYPESENSE_API_KEY || "",
  });

  console.log('=== CHECKING LIVE ZILLOW STATUS ===\n');

  // Build URLs
  const urls = MISSING_ZPIDS.map(zpid => `https://www.zillow.com/homedetails/${zpid}_zpid/`);

  console.log(`Fetching ${urls.length} properties via Apify detail scraper...\n`);

  try {
    const run = await apify.actor('maxcopell/zillow-detail-scraper').call({
      urls: urls,
      downloadImages: false,
    }, { timeout: 300 });

    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    console.log(`Got ${items.length} results\n`);

    let updated = 0;

    for (const item of items as any[]) {
      const zpid = item.zpid;
      console.log(`\nzpid: ${zpid}`);
      console.log(`  Address: ${item.streetAddress}, ${item.city}`);
      console.log(`  Status: ${item.homeStatus || 'UNKNOWN'}`);
      console.log(`  Price: $${item.price?.toLocaleString() || 'N/A'}`);
      console.log(`  Image: ${item.imgSrc ? 'YES' : 'NO'}`);

      if (item.imgSrc && db) {
        // Update Firestore
        const snapshot = await db.collection("zillow_imports")
          .where("zpid", "==", typeof zpid === 'string' ? parseInt(zpid) : zpid)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          await db.collection("zillow_imports").doc(snapshot.docs[0].id).update({
            imgSrc: item.imgSrc,
            firstPropertyImage: item.imgSrc,
            homeStatus: item.homeStatus,
            imageUpdatedAt: new Date().toISOString()
          });
          console.log(`  ✓ Updated Firestore`);

          // Update Typesense
          for (const tsId of [String(zpid), snapshot.docs[0].id]) {
            try {
              await typesense.collections("properties").documents(tsId).update({
                primaryImage: item.imgSrc,
                homeStatus: item.homeStatus
              });
              console.log(`  ✓ Updated Typesense: ${tsId}`);
              updated++;
              break;
            } catch { }
          }
        }
      }
    }

    // Check for properties not returned (might be off-market)
    const returnedZpids = new Set((items as any[]).map(i => String(i.zpid)));
    for (const zpid of MISSING_ZPIDS) {
      if (!returnedZpids.has(String(zpid))) {
        console.log(`\nzpid ${zpid}: NOT FOUND BY SCRAPER (likely off-market/sold)`);
      }
    }

    console.log(`\n=== COMPLETE ===`);
    console.log(`Updated: ${updated}`);

  } catch (error: any) {
    console.error(`Scraper failed: ${error.message}`);
  }
}

main().catch(console.error);
