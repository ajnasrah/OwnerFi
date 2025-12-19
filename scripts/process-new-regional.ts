/**
 * Process NEW regional properties through detail scraper + filters
 * - Gets descriptions via detail scraper
 * - Applies owner finance filter → zillow_imports
 * - Applies cash deals filter → cash_houses
 * - NO GHL sends
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ApifyClient } from "apify-client";
import { runUnifiedFilter, logFilterStats, calculateFilterStats, FilterResult } from "../src/lib/scraper-v2/unified-filter";
import { getNearbyCityNamesForProperty } from "../src/lib/comprehensive-cities";

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

const DETAIL_ACTOR = "maxcopell/zillow-detail-scraper";
const SEARCH_RUN_ID = "9OELPiMAvaH4kZpCx";

// Process in batches
const BATCH_SIZE = 250;
const MAX_BATCHES = 20; // Process all properties

async function processNewProperties() {
  console.log("=== PROCESS NEW REGIONAL PROPERTIES ===\n");
  console.log("NO GHL SENDS - just finding owner finance and cash deals\n");

  // Step 1: Get search results and find new properties
  console.log("Step 1: Getting new property URLs...\n");

  const run = await apify.run(SEARCH_RUN_ID).get();
  const { items: searchResults } = await apify.dataset(run!.defaultDatasetId).listItems();

  // Get existing ZPIDs
  const existingZpids = new Set<number>();
  const [imports, cash] = await Promise.all([
    db.collection("zillow_imports").select("zpid").get(),
    db.collection("cash_houses").select("zpid").get()
  ]);

  imports.docs.forEach(doc => {
    const zpid = doc.data().zpid;
    if (zpid) existingZpids.add(Number(zpid));
  });
  cash.docs.forEach(doc => {
    const zpid = doc.data().zpid;
    if (zpid) existingZpids.add(Number(zpid));
  });

  // Find new properties with valid URLs
  const newProperties: any[] = [];
  for (const prop of searchResults as any[]) {
    const zpid = Number(prop.zpid);
    const url = prop.detailUrl || prop.url;
    if (zpid && !existingZpids.has(zpid) && url && url.includes("zillow.com")) {
      newProperties.push({ ...prop, url });
    }
  }

  console.log(`Total in search: ${searchResults.length}`);
  console.log(`Already in DB: ${existingZpids.size}`);
  console.log(`New properties with URLs: ${newProperties.length}\n`);

  if (newProperties.length === 0) {
    console.log("No new properties to process!");
    return;
  }

  // Step 2: Process in batches
  const totalToProcess = Math.min(newProperties.length, BATCH_SIZE * MAX_BATCHES);
  const numBatches = Math.ceil(totalToProcess / BATCH_SIZE);

  console.log(`Step 2: Processing ${totalToProcess} properties in ${numBatches} batches...\n`);

  const allFilterResults: FilterResult[] = [];
  let savedToZillowImports = 0;
  let savedToCashHouses = 0;
  let duplicatesSkipped = 0;

  for (let batchNum = 0; batchNum < numBatches; batchNum++) {
    const start = batchNum * BATCH_SIZE;
    const batchProps = newProperties.slice(start, start + BATCH_SIZE);
    const batchUrls = batchProps.map(p => p.url);

    console.log(`\n--- Batch ${batchNum + 1}/${numBatches} (${batchUrls.length} properties) ---\n`);

    // Run detail scraper
    console.log(`Running detail scraper on ${batchUrls.length} URLs...`);

    const detailRun = await apify.actor(DETAIL_ACTOR).start({
      startUrls: batchUrls.map(url => ({ url })),
    });

    const finishedRun = await apify.run(detailRun.id).waitForFinish({
      waitSecs: 300
    });

    if (finishedRun.status !== "SUCCEEDED") {
      console.error(`Batch ${batchNum + 1} failed: ${finishedRun.status}`);
      continue;
    }

    const { items: detailResults } = await apify.dataset(finishedRun.defaultDatasetId).listItems();
    console.log(`Got details for ${detailResults.length} properties\n`);

    // Process each property through filters
    for (const prop of detailResults as any[]) {
      const zpid = Number(prop.zpid);
      const description = prop.description || "";
      const price = Number(prop.price) || 0;
      const zestimate = Number(prop.zestimate) || 0;

      // Extract address - handle both string and object formats
      let address = "Unknown";
      if (typeof prop.address === "string") {
        address = prop.address;
      } else if (typeof prop.address === "object" && prop.address) {
        address = prop.address.streetAddress || prop.address.full || JSON.stringify(prop.address);
      } else if (prop.streetAddress) {
        address = `${prop.streetAddress}, ${prop.city || ""} ${prop.state || ""} ${prop.zipcode || ""}`.trim();
      }

      // Double-check not already in DB (could have been added during processing)
      if (existingZpids.has(zpid)) {
        duplicatesSkipped++;
        continue;
      }

      // Run unified filter
      const filterResult = runUnifiedFilter(description, price, zestimate);
      allFilterResults.push(filterResult);

      // Extract street address for DB
      const streetAddress = prop.streetAddress || (typeof prop.address === "object" ? prop.address?.streetAddress : address);

      // Calculate nearby cities for dashboard queries
      const city = prop.city || "";
      const state = prop.state || "";
      const nearbyCities = city && state
        ? getNearbyCityNamesForProperty(city.split(",")[0].trim(), state, 35, 100)
        : [];

      // Prepare property data - ensure no undefined values
      const propertyData = {
        zpid,
        url: prop.url || prop.detailUrl || "",
        fullAddress: address,
        address: streetAddress || address,
        city,
        state,
        zipcode: prop.zipcode || prop.zipCode || "",
        price,
        zestimate,
        bedrooms: prop.bedrooms ?? null,
        bathrooms: prop.bathrooms ?? null,
        livingArea: prop.livingArea ?? null,
        lotSize: prop.lotSize ?? null,
        yearBuilt: prop.yearBuilt ?? null,
        homeType: prop.homeType || "",
        description: description || "",
        imgSrc: prop.imgSrc || prop.photos?.[0] || "",
        latitude: prop.latitude ?? null,
        longitude: prop.longitude ?? null,
        nearbyCities,
        nearbyCitiesSource: "regional-batch-import",
        createdAt: new Date(),
        source: "regional-batch-import",
        sentToGHL: false,
      };

      // Save to zillow_imports if passes owner finance
      if (filterResult.passesOwnerFinance) {
        await db.collection("zillow_imports").add({
          ...propertyData,
          ownerFinanceVerified: true,  // Required for dashboard visibility
          ownerFinanceKeywords: filterResult.ownerFinanceKeywords || [],
          primaryKeyword: filterResult.primaryOwnerFinanceKeyword || "",
          financingType: filterResult.financingType?.financingType || "unknown",
        });
        savedToZillowImports++;
        console.log(`  ✅ OWNER FINANCE: ${address} - $${price.toLocaleString()}`);
        console.log(`     Keywords: ${filterResult.ownerFinanceKeywords.join(", ")}`);
      }

      // Save to cash_houses if passes cash deal
      if (filterResult.passesCashDeal) {
        await db.collection("cash_houses").add({
          ...propertyData,
          cashDealReason: filterResult.cashDealReason || "unknown",
          discountPercentage: filterResult.discountPercentage ?? null,
          eightyPercentOfZestimate: filterResult.eightyPercentOfZestimate ?? null,
          needsWork: filterResult.needsWork || false,
          needsWorkKeywords: filterResult.needsWorkKeywords || [],
        });
        savedToCashHouses++;
        if (filterResult.cashDealReason === "discount") {
          console.log(`  💰 CASH DEAL: ${address} - ${filterResult.discountPercentage?.toFixed(1)}% off`);
        } else {
          console.log(`  🔧 CASH DEAL (needs work): ${address}`);
        }
      }

      // Mark as processed
      existingZpids.add(zpid);
    }
  }

  // Final stats
  console.log("\n\n========== FINAL RESULTS ==========\n");
  console.log(`Properties processed: ${allFilterResults.length}`);
  console.log(`Duplicates skipped: ${duplicatesSkipped}`);
  console.log(`Saved to zillow_imports: ${savedToZillowImports}`);
  console.log(`Saved to cash_houses: ${savedToCashHouses}`);
  console.log(`Sent to GHL: 0 (disabled)`);

  if (allFilterResults.length > 0) {
    const stats = calculateFilterStats(allFilterResults);
    logFilterStats(stats);
  }

  const remaining = newProperties.length - (BATCH_SIZE * MAX_BATCHES);
  if (remaining > 0) {
    console.log(`\n⚠️  ${remaining} properties remaining. Run again to process more.`);
  }
}

processNewProperties().then(() => process.exit(0)).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
