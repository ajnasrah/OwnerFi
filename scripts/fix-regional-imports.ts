/**
 * Fix regional imports - add ownerFinanceVerified and nearbyCities
 * so they appear in the buyer dashboard
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

async function fixRegionalImports() {
  console.log("=== FIX REGIONAL IMPORTS ===\n");

  // Find properties from regional-batch-import that are missing ownerFinanceVerified
  const snapshot = await db.collection("zillow_imports")
    .where("source", "==", "regional-batch-import")
    .get();

  console.log(`Found ${snapshot.size} regional imports\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Check what's missing
    const needsVerified = data.ownerFinanceVerified !== true;
    const needsNearbyCities = !data.nearbyCities || !Array.isArray(data.nearbyCities) || data.nearbyCities.length === 0;

    if (!needsVerified && !needsNearbyCities) {
      skipped++;
      continue;
    }

    const updateData: Record<string, any> = {};

    if (needsVerified) {
      updateData.ownerFinanceVerified = true;
    }

    if (needsNearbyCities) {
      const city = data.city?.split(",")[0]?.trim();
      const state = data.state;

      if (city && state) {
        const nearbyCities = getNearbyCityNamesForProperty(city, state, 35, 100);
        if (nearbyCities.length > 0) {
          updateData.nearbyCities = nearbyCities;
          updateData.nearbyCitiesSource = "fix-regional-imports";
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      try {
        await doc.ref.update(updateData);
        updated++;
        console.log(`✅ Fixed: ${data.address || data.fullAddress} (${data.city}, ${data.state})`);
        if (updateData.nearbyCities) {
          console.log(`   Added ${updateData.nearbyCities.length} nearby cities`);
        }
      } catch (err) {
        errors++;
        console.error(`❌ Error updating ${doc.id}:`, err);
      }
    }
  }

  console.log("\n=== RESULTS ===");
  console.log(`Updated: ${updated}`);
  console.log(`Already OK: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

fixRegionalImports().then(() => process.exit(0)).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
