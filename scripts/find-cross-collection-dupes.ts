import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

interface PropRecord {
  collection: string;
  docId: string;
  zpid: string;
  address: string;
  source: string;
  createdAt: Date | null;
}

function extractZpid(doc: FirebaseFirestore.DocumentSnapshot): string {
  const data = doc.data();
  if (!data) return "";

  // Try various zpid field names
  if (data.zpid) return String(data.zpid);
  if (data.zillowId) return String(data.zillowId);

  // Extract from doc ID
  if (doc.id.startsWith("zpid_")) return doc.id.replace("zpid_", "");
  if (doc.id.match(/^\d+$/)) return doc.id;

  return "";
}

function extractAddress(data: any): string {
  if (!data) return "";

  if (typeof data.fullAddress === "string") return data.fullAddress.toLowerCase().trim();
  if (typeof data.address === "string") return data.address.toLowerCase().trim();
  if (typeof data.streetAddress === "string") {
    return [data.streetAddress, data.city, data.state].filter(Boolean).join(", ").toLowerCase().trim();
  }

  return "";
}

async function analyze() {
  console.log("=== CROSS-COLLECTION DUPLICATE ANALYSIS ===\n");

  const collections = ["properties", "zillow_imports", "cash_houses"];
  const allRecords: PropRecord[] = [];

  // Fetch all records from each collection
  for (const collName of collections) {
    console.log(`Fetching ${collName}...`);
    const snap = await db.collection(collName).get();
    console.log(`  Found: ${snap.size}`);

    snap.docs.forEach(doc => {
      const data = doc.data();
      allRecords.push({
        collection: collName,
        docId: doc.id,
        zpid: extractZpid(doc),
        address: extractAddress(data),
        source: data?.source || data?.importSource || "unknown",
        createdAt: data?.createdAt?.toDate?.() || null,
      });
    });
  }

  console.log(`\nTotal records across all collections: ${allRecords.length}`);

  // Group by ZPID
  const byZpid = new Map<string, PropRecord[]>();
  allRecords.forEach(rec => {
    if (rec.zpid) {
      if (!byZpid.has(rec.zpid)) byZpid.set(rec.zpid, []);
      byZpid.get(rec.zpid)!.push(rec);
    }
  });

  console.log(`Unique ZPIDs: ${byZpid.size}`);

  // Find cross-collection duplicates
  const crossDupes: [string, PropRecord[]][] = [];
  const sameDupes: [string, PropRecord[]][] = [];

  byZpid.forEach((records, zpid) => {
    if (records.length > 1) {
      const uniqueCollections = new Set(records.map(r => r.collection));
      if (uniqueCollections.size > 1) {
        crossDupes.push([zpid, records]);
      } else {
        sameDupes.push([zpid, records]);
      }
    }
  });

  console.log(`\n=== CROSS-COLLECTION DUPLICATES (same ZPID in multiple collections) ===`);
  console.log(`Count: ${crossDupes.length}`);

  // Show breakdown
  const crossBreakdown: Record<string, number> = {};
  crossDupes.forEach(([_, records]) => {
    const key = [...new Set(records.map(r => r.collection))].sort().join(" + ");
    crossBreakdown[key] = (crossBreakdown[key] || 0) + 1;
  });

  console.log("\nBreakdown by collection combination:");
  Object.entries(crossBreakdown).sort((a, b) => b[1] - a[1]).forEach(([combo, count]) => {
    console.log(`  ${combo}: ${count}`);
  });

  // Show some examples
  console.log("\nFirst 15 examples:");
  crossDupes.slice(0, 15).forEach(([zpid, records]) => {
    console.log(`\n  ZPID ${zpid}:`);
    records.forEach(r => {
      console.log(`    - ${r.collection} | ${r.docId} | src: ${r.source}`);
    });
  });

  // Same-collection duplicates
  console.log(`\n=== SAME-COLLECTION DUPLICATES ===`);
  console.log(`Count: ${sameDupes.length}`);
  if (sameDupes.length > 0) {
    sameDupes.slice(0, 10).forEach(([zpid, records]) => {
      console.log(`\n  ZPID ${zpid} (${records[0].collection}):`);
      records.forEach(r => {
        console.log(`    - ${r.docId} | src: ${r.source}`);
      });
    });
  }

  // Calculate totals
  const totalDuplicateRecords = crossDupes.reduce((sum, [_, recs]) => sum + recs.length - 1, 0) +
                                 sameDupes.reduce((sum, [_, recs]) => sum + recs.length - 1, 0);

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total records: ${allRecords.length}`);
  console.log(`Unique ZPIDs: ${byZpid.size}`);
  console.log(`Cross-collection duplicate ZPIDs: ${crossDupes.length}`);
  console.log(`Same-collection duplicate ZPIDs: ${sameDupes.length}`);
  console.log(`Total extra/duplicate records: ${totalDuplicateRecords}`);
  console.log(`If deduplicated: ${byZpid.size} unique properties`);
}

analyze().catch(console.error);
