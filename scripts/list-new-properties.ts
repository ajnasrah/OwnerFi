/**
 * List NEW properties from existing search - NO new API calls
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

// Existing run - NO new scraping
const RUN_ID = "9OELPiMAvaH4kZpCx";

async function listNewProperties() {
  console.log("=== NEW PROPERTIES NOT IN DATABASE ===\n");

  // Get existing search results
  const run = await apify.run(RUN_ID).get();
  const { items: searchResults } = await apify.dataset(run!.defaultDatasetId).listItems();

  // Get all ZPIDs from DB
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

  // Find new properties
  const newProperties: any[] = [];
  for (const prop of searchResults as any[]) {
    const zpid = Number(prop.zpid);
    if (zpid && !existingZpids.has(zpid)) {
      newProperties.push(prop);
    }
  }

  console.log(`Search results: ${searchResults.length}`);
  console.log(`Already in DB: ${existingZpids.size}`);
  console.log(`NEW properties: ${newProperties.length}\n`);

  // Group by price range
  const priceRanges = {
    "50k-100k": [] as any[],
    "100k-150k": [] as any[],
    "150k-200k": [] as any[],
    "200k-300k": [] as any[],
    "300k-400k": [] as any[],
    "400k-500k": [] as any[],
  };

  for (const p of newProperties) {
    const price = Number(p.price) || 0;
    if (price >= 50000 && price < 100000) priceRanges["50k-100k"].push(p);
    else if (price >= 100000 && price < 150000) priceRanges["100k-150k"].push(p);
    else if (price >= 150000 && price < 200000) priceRanges["150k-200k"].push(p);
    else if (price >= 200000 && price < 300000) priceRanges["200k-300k"].push(p);
    else if (price >= 300000 && price < 400000) priceRanges["300k-400k"].push(p);
    else if (price >= 400000 && price <= 500000) priceRanges["400k-500k"].push(p);
  }

  console.log("=== BY PRICE RANGE ===");
  for (const [range, props] of Object.entries(priceRanges)) {
    console.log(`${range}: ${props.length} properties`);
  }

  // Group by state/city
  const byCity: Record<string, number> = {};
  for (const p of newProperties) {
    const city = p.city || p.address?.split(",")[1]?.trim() || "Unknown";
    byCity[city] = (byCity[city] || 0) + 1;
  }

  console.log("\n=== TOP CITIES ===");
  const sortedCities = Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [city, count] of sortedCities) {
    console.log(`${city}: ${count}`);
  }

  // Sample of new properties
  console.log("\n=== SAMPLE NEW PROPERTIES ===\n");
  for (let i = 0; i < Math.min(50, newProperties.length); i++) {
    const p = newProperties[i];
    console.log(`${i+1}. $${p.price?.toLocaleString()} - ${p.address || p.streetAddress}`);
    console.log(`   ZPID: ${p.zpid} | ${p.bedrooms || "?"}bd/${p.bathrooms || "?"}ba | ${p.livingArea || "?"}sqft`);
    if (p.zestimate) console.log(`   Zestimate: $${p.zestimate?.toLocaleString()}`);
    console.log("");
  }
}

listNewProperties().then(() => process.exit(0));
