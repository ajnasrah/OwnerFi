import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

interface PropertyDoc {
  id: string;
  zpid: string;
  address: string;
  source: string;
  createdAt: any;
  data: any;
}

async function analyze() {
  console.log("Fetching all properties...\n");

  // Get all properties
  const snapshot = await db.collection("properties").get();
  console.log("Total properties:", snapshot.size);

  // Group by zpid
  const byZpid = new Map<string, PropertyDoc[]>();
  const byAddress = new Map<string, PropertyDoc[]>();

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const zpid = String(data.zpid || doc.id.replace("zpid_", ""));

    // Handle address that might be an object
    let address = "";
    if (typeof data.fullAddress === "string") {
      address = data.fullAddress.toLowerCase().trim();
    } else if (typeof data.address === "string") {
      address = data.address.toLowerCase().trim();
    } else if (data.address && typeof data.address === "object") {
      address = [data.address.streetAddress, data.address.city, data.address.state]
        .filter(Boolean).join(", ").toLowerCase().trim();
    }

    const source = data.source || data.importSource || "unknown";
    const createdAt = data.createdAt;

    const entry: PropertyDoc = { id: doc.id, zpid, address, source, createdAt, data };

    if (!byZpid.has(zpid)) byZpid.set(zpid, []);
    byZpid.get(zpid)!.push(entry);

    if (address && address.length > 10) {
      if (!byAddress.has(address)) byAddress.set(address, []);
      byAddress.get(address)!.push(entry);
    }
  });

  // Find zpid duplicates
  const zpidDupes = [...byZpid.entries()].filter(([_, docs]) => docs.length > 1);
  console.log("\n=== ZPID DUPLICATES ===");
  console.log("Count:", zpidDupes.length);

  if (zpidDupes.length > 0) {
    console.log("\nFirst 20 ZPID duplicates:");
    zpidDupes.slice(0, 20).forEach(([zpid, docs]) => {
      console.log(`\n  ZPID ${zpid}: ${docs.length} documents`);
      docs.forEach(d => {
        console.log(`    - ${d.id} | source: ${d.source} | addr: ${d.address.substring(0, 40)}`);
      });
    });
  }

  // Find address duplicates (different zpids, same address)
  const addrDupes = [...byAddress.entries()].filter(([_, docs]) => {
    if (docs.length <= 1) return false;
    // Check if they have different zpids
    const uniqueZpids = new Set(docs.map(d => d.zpid));
    return uniqueZpids.size > 1;
  });

  console.log("\n=== ADDRESS DUPLICATES (different ZPIDs) ===");
  console.log("Count:", addrDupes.length);

  if (addrDupes.length > 0) {
    console.log("\nFirst 20 address duplicates:");
    addrDupes.slice(0, 20).forEach(([addr, docs]) => {
      console.log(`\n  "${addr.substring(0, 60)}"`);
      docs.forEach(d => {
        console.log(`    - ${d.id} | zpid: ${d.zpid} | source: ${d.source}`);
      });
    });
  }

  // Check document ID patterns
  const idPatterns: Record<string, number> = {};
  snapshot.docs.forEach(doc => {
    if (doc.id.startsWith("zpid_")) {
      idPatterns["zpid_*"] = (idPatterns["zpid_*"] || 0) + 1;
    } else if (doc.id.match(/^\d+$/)) {
      idPatterns["numeric"] = (idPatterns["numeric"] || 0) + 1;
    } else {
      idPatterns["other"] = (idPatterns["other"] || 0) + 1;
    }
  });
  console.log("\n=== DOCUMENT ID PATTERNS ===");
  Object.entries(idPatterns).forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count}`);
  });

  // Source breakdown
  const bySrc: Record<string, number> = {};
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const src = data.source || data.importSource || "unknown";
    bySrc[src] = (bySrc[src] || 0) + 1;
  });
  console.log("\n=== SOURCE BREAKDOWN ===");
  Object.entries(bySrc).sort((a, b) => b[1] - a[1]).forEach(([src, count]) => {
    console.log(`  ${src}: ${count}`);
  });

  // Summary
  console.log("\n=== SUMMARY ===");
  console.log("Total properties:", snapshot.size);
  console.log("Unique ZPIDs:", byZpid.size);
  console.log("ZPID duplicates (same zpid, multiple docs):", zpidDupes.length);
  console.log("Address duplicates (same address, different zpids):", addrDupes.length);

  const totalDupeCount = zpidDupes.reduce((sum, [_, docs]) => sum + docs.length - 1, 0);
  console.log("Extra docs from ZPID dupes:", totalDupeCount);
}

analyze().catch(console.error);
