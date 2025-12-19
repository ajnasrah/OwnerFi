/**
 * Check all fields in properties missing images
 */

import { getAdminDb } from '../src/lib/firebase-admin';

async function main() {
  const db = await getAdminDb();
  if (!db) {
    console.log("DB not initialized");
    return;
  }

  const zpids = [70589260, 42308812, 42297568];

  for (const zpid of zpids) {
    console.log(`\n=== ZPID: ${zpid} ===`);

    // Find by zpid
    const snapshot = await db.collection("zillow_imports")
      .where("zpid", "==", zpid)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log("Not found in zillow_imports");
      continue;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    console.log("Doc ID:", doc.id);
    console.log("\nAll fields:");
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'object' && !Array.isArray(value)) {
        console.log(`  ${key}: [object]`);
      } else if (Array.isArray(value)) {
        console.log(`  ${key}: [array of ${value.length}]`);
      } else if (typeof value === 'string' && value.length > 100) {
        console.log(`  ${key}: "${value.substring(0, 100)}..."`);
      } else {
        console.log(`  ${key}:`, value);
      }
    }

    // Check if we have a URL or hdpUrl
    console.log("\n--- URL Fields ---");
    console.log("url:", data.url || "MISSING");
    console.log("hdpUrl:", data.hdpUrl || "MISSING");
    console.log("detailUrl:", data.detailUrl || "MISSING");
    console.log("zillowUrl:", data.zillowUrl || "MISSING");

    // Build Zillow URL from zpid
    const zillowUrl = `https://www.zillow.com/homedetails/${zpid}_zpid/`;
    console.log("\nBuilt Zillow URL:", zillowUrl);
  }
}

main();
