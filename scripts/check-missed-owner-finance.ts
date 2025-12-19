import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { hasStrictOwnerFinancing } from "../src/lib/owner-financing-filter-strict";

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

async function checkDatabase() {
  // Get recent cash_houses - these failed owner finance but passed cash deals
  const cash = await db.collection("cash_houses").orderBy("createdAt", "desc").limit(50).get();

  console.log("=== CHECKING CASH_HOUSES FOR MISSED OWNER FINANCE ===");
  console.log("Total recent cash_houses:", cash.size);

  let missedCount = 0;
  const missed: any[] = [];

  for (const doc of cash.docs) {
    const d = doc.data();
    const desc = d.description || "";
    const lower = desc.toLowerCase();

    // Check if mentions owner/seller + financing words
    const hasOwnerSeller = lower.includes("owner") || lower.includes("seller");
    const hasFinancingWords = lower.includes("financ") || lower.includes("carry") || lower.includes("terms");

    if (hasOwnerSeller && hasFinancingWords) {
      const result = hasStrictOwnerFinancing(desc);
      if (!result.passes) {
        missedCount++;
        missed.push({
          address: d.fullAddress,
          price: d.price,
          description: desc
        });
      }
    }
  }

  console.log("\nProperties mentioning owner/seller + financing but FAILED our filter:", missedCount);

  if (missed.length > 0) {
    console.log("\n=== POTENTIAL FALSE NEGATIVES ===\n");
    for (let i = 0; i < missed.length; i++) {
      const m = missed[i];
      console.log(`${i+1}. ${m.address} ($${m.price})`);
      console.log(`   Description: ${m.description.substring(0, 400)}`);
      console.log("");
    }
  } else {
    console.log("\n✅ No false negatives found - filter is working correctly!");
  }

  // Also check zillow_imports to see what DID pass
  const imports = await db.collection("zillow_imports").where("source", "==", "scraper-v2").limit(10).get();

  console.log("\n=== PROPERTIES THAT PASSED OWNER FINANCE FILTER ===");
  console.log("Count:", imports.size);

  for (const doc of imports.docs) {
    const d = doc.data();
    console.log(`\n✅ ${d.fullAddress}`);
    console.log(`   Price: $${d.price}`);
    console.log(`   Desc: ${(d.description || "").substring(0, 200)}...`);
  }
}

checkDatabase().then(() => process.exit(0));
