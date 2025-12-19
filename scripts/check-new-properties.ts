/**
 * Check NEW properties from existing Apify run against our database
 * Uses EXISTING run data - does NOT run new scraper
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

// Use the run that just completed
const RUN_ID = "9OELPiMAvaH4kZpCx";

async function checkNewProperties() {
  console.log("=== CHECKING NEW PROPERTIES FROM EXISTING RUN ===\n");
  console.log(`Using run ID: ${RUN_ID}\n`);

  // Step 1: Get run info and dataset
  const run = await apify.run(RUN_ID).get();
  console.log(`Run status: ${run?.status}`);
  console.log(`Dataset ID: ${run?.defaultDatasetId}\n`);

  if (!run?.defaultDatasetId) {
    console.log("No dataset found");
    return;
  }

  // Step 2: Fetch search results
  console.log("Step 1: Fetching search results from Apify...\n");
  const { items: searchResults } = await apify.dataset(run.defaultDatasetId).listItems();
  console.log(`Found ${searchResults.length} properties from search\n`);

  // Step 3: Get all ZPIDs from our database
  console.log("Step 2: Checking existing ZPIDs in database...\n");

  const existingZpids = new Set<number>();

  // Check zillow_imports
  const imports = await db.collection("zillow_imports").select("zpid").get();
  imports.docs.forEach(doc => {
    const zpid = doc.data().zpid;
    if (zpid) existingZpids.add(Number(zpid));
  });
  console.log(`  zillow_imports: ${imports.size} documents`);

  // Check cash_houses
  const cash = await db.collection("cash_houses").select("zpid").get();
  cash.docs.forEach(doc => {
    const zpid = doc.data().zpid;
    if (zpid) existingZpids.add(Number(zpid));
  });
  console.log(`  cash_houses: ${cash.size} documents`);

  console.log(`  Total unique ZPIDs in DB: ${existingZpids.size}\n`);

  // Step 4: Find NEW properties
  console.log("Step 3: Finding NEW properties...\n");

  const newProperties: any[] = [];
  let noZpidCount = 0;

  for (const prop of searchResults as any[]) {
    const zpid = Number(prop.zpid);
    if (!zpid) {
      noZpidCount++;
      continue;
    }
    if (!existingZpids.has(zpid)) {
      newProperties.push(prop);
    }
  }

  console.log(`=== RESULTS ===`);
  console.log(`Total properties from search: ${searchResults.length}`);
  console.log(`Properties without ZPID: ${noZpidCount}`);
  console.log(`Already in database: ${searchResults.length - newProperties.length - noZpidCount}`);
  console.log(`NEW properties not in DB: ${newProperties.length}`);
  console.log(`\n`);

  if (newProperties.length > 0) {
    console.log("Sample of NEW properties:");
    for (let i = 0; i < Math.min(20, newProperties.length); i++) {
      const p = newProperties[i];
      console.log(`  ${i+1}. zpid=${p.zpid} - ${p.address || p.streetAddress} - $${p.price}`);
    }
    if (newProperties.length > 20) {
      console.log(`  ... and ${newProperties.length - 20} more`);
    }
  }
}

checkNewProperties().then(() => process.exit(0));
