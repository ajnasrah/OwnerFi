/**
 * Check Zillow status for properties missing images - from Firestore data
 */

import { getAdminDb } from '../src/lib/firebase-admin';

const MISSING_ZPIDS = [
  42212704, 94726151, 2057637761, 161591197, 42325513,
  62863412, 2053587663, 339863700, 42274392, 89195344,
  42142862, 2057609639, 301965, 291337, 450678102,
  458491460, 42323347, 55302375
];

async function main() {
  const db = await getAdminDb();
  if (!db) {
    console.log("DB not initialized");
    return;
  }

  console.log('=== CHECKING PROPERTY STATUS ===\n');

  for (const zpid of MISSING_ZPIDS) {
    // Find in zillow_imports
    const snapshot = await db.collection("zillow_imports")
      .where("zpid", "==", zpid)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log(`zpid ${zpid}: NOT IN DATABASE`);
      console.log(`  Zillow: https://www.zillow.com/homedetails/${zpid}_zpid/`);
      console.log();
      continue;
    }

    const data = snapshot.docs[0].data();
    const zillowUrl = `https://www.zillow.com/homedetails/${zpid}_zpid/`;

    console.log(`${data.address || data.streetAddress}, ${data.city}`);
    console.log(`  zpid: ${zpid}`);
    console.log(`  homeStatus: ${data.homeStatus || 'NOT SET'}`);
    console.log(`  daysOnZillow: ${data.daysOnZillow || 'N/A'}`);
    console.log(`  price: $${data.price?.toLocaleString() || 'N/A'}`);
    console.log(`  imgSrc: ${data.imgSrc ? 'HAS IMAGE' : 'MISSING'}`);
    console.log(`  ownerFinanceVerified: ${data.ownerFinanceVerified || false}`);
    console.log(`  source: ${data.source || 'unknown'}`);
    console.log(`  Zillow: ${zillowUrl}`);
    console.log();
  }
}

main().catch(console.error);
