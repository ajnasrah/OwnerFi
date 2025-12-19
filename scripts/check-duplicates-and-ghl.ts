/**
 * Check entire database for duplicates and GHL sends
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
  console.log("=== DATABASE DUPLICATE & GHL CHECK ===\n");

  // Get ALL documents from both collections
  const [importsSnap, cashSnap] = await Promise.all([
    db.collection("zillow_imports").get(),
    db.collection("cash_houses").get()
  ]);

  console.log(`zillow_imports: ${importsSnap.size} documents`);
  console.log(`cash_houses: ${cashSnap.size} documents`);
  console.log(`Total: ${importsSnap.size + cashSnap.size} documents\n`);

  // Track ZPIDs
  const zpidMap = new Map<number, { collection: string; docId: string; address: string }[]>();

  // Process zillow_imports
  for (const doc of importsSnap.docs) {
    const data = doc.data();
    const zpid = Number(data.zpid);
    if (zpid) {
      if (!zpidMap.has(zpid)) zpidMap.set(zpid, []);
      zpidMap.get(zpid)!.push({
        collection: "zillow_imports",
        docId: doc.id,
        address: data.fullAddress || data.address || "Unknown"
      });
    }
  }

  // Process cash_houses
  for (const doc of cashSnap.docs) {
    const data = doc.data();
    const zpid = Number(data.zpid);
    if (zpid) {
      if (!zpidMap.has(zpid)) zpidMap.set(zpid, []);
      zpidMap.get(zpid)!.push({
        collection: "cash_houses",
        docId: doc.id,
        address: data.fullAddress || data.address || "Unknown"
      });
    }
  }

  // Find duplicates
  const duplicates: { zpid: number; entries: typeof zpidMap extends Map<number, infer V> ? V : never }[] = [];

  for (const [zpid, entries] of zpidMap) {
    if (entries.length > 1) {
      duplicates.push({ zpid, entries });
    }
  }

  console.log("=== DUPLICATES ===");
  console.log(`Found ${duplicates.length} ZPIDs with multiple entries\n`);

  if (duplicates.length > 0) {
    // Categorize duplicates
    const withinImports = duplicates.filter(d =>
      d.entries.every(e => e.collection === "zillow_imports")
    );
    const withinCash = duplicates.filter(d =>
      d.entries.every(e => e.collection === "cash_houses")
    );
    const crossCollection = duplicates.filter(d =>
      d.entries.some(e => e.collection === "zillow_imports") &&
      d.entries.some(e => e.collection === "cash_houses")
    );

    console.log(`  Duplicates within zillow_imports: ${withinImports.length}`);
    console.log(`  Duplicates within cash_houses: ${withinCash.length}`);
    console.log(`  Cross-collection (in BOTH): ${crossCollection.length}\n`);

    if (crossCollection.length > 0) {
      console.log("Cross-collection duplicates (first 20):");
      for (let i = 0; i < Math.min(20, crossCollection.length); i++) {
        const d = crossCollection[i];
        console.log(`  ZPID ${d.zpid}: ${d.entries[0].address}`);
        for (const e of d.entries) {
          console.log(`    - ${e.collection} (${e.docId})`);
        }
      }
      console.log("");
    }

    if (withinImports.length > 0) {
      console.log("Duplicates within zillow_imports (first 10):");
      for (let i = 0; i < Math.min(10, withinImports.length); i++) {
        const d = withinImports[i];
        console.log(`  ZPID ${d.zpid}: ${d.entries.length} copies - ${d.entries[0].address}`);
      }
      console.log("");
    }

    if (withinCash.length > 0) {
      console.log("Duplicates within cash_houses (first 10):");
      for (let i = 0; i < Math.min(10, withinCash.length); i++) {
        const d = withinCash[i];
        console.log(`  ZPID ${d.zpid}: ${d.entries.length} copies - ${d.entries[0].address}`);
      }
      console.log("");
    }
  }

  // Check GHL sends
  console.log("\n=== GHL WEBHOOK SENDS ===\n");

  let ghlSentImports = 0;
  let ghlSentCash = 0;
  const ghlSentProperties: { address: string; collection: string; sentAt: any }[] = [];

  for (const doc of importsSnap.docs) {
    const data = doc.data();
    if (data.sentToGHL || data.ghlSent) {
      ghlSentImports++;
      ghlSentProperties.push({
        address: data.fullAddress || data.address || "Unknown",
        collection: "zillow_imports",
        sentAt: data.ghlSentAt || data.sentToGHLAt || "unknown"
      });
    }
  }

  for (const doc of cashSnap.docs) {
    const data = doc.data();
    if (data.sentToGHL || data.ghlSent) {
      ghlSentCash++;
      ghlSentProperties.push({
        address: data.fullAddress || data.address || "Unknown",
        collection: "cash_houses",
        sentAt: data.ghlSentAt || data.sentToGHLAt || "unknown"
      });
    }
  }

  console.log(`Properties sent to GHL from zillow_imports: ${ghlSentImports}`);
  console.log(`Properties sent to GHL from cash_houses: ${ghlSentCash}`);
  console.log(`Total sent to GHL: ${ghlSentImports + ghlSentCash}\n`);

  if (ghlSentProperties.length > 0) {
    console.log("Recent GHL sends (last 20):");
    const sorted = ghlSentProperties.slice(-20);
    for (const p of sorted) {
      console.log(`  [${p.collection}] ${p.address}`);
    }
  }

  // Check for source field distribution
  console.log("\n=== SOURCE DISTRIBUTION ===\n");

  const sourceCount: Record<string, number> = {};

  for (const doc of importsSnap.docs) {
    const source = doc.data().source || "unknown";
    sourceCount[source] = (sourceCount[source] || 0) + 1;
  }

  for (const doc of cashSnap.docs) {
    const source = doc.data().source || "unknown";
    sourceCount[source] = (sourceCount[source] || 0) + 1;
  }

  console.log("Sources:");
  for (const [source, count] of Object.entries(sourceCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source}: ${count}`);
  }
}

checkDatabase().then(() => process.exit(0));
