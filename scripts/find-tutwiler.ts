/**
 * Find "1739 Tutwiler Ave, Memphis, TN 38112" (zpid 42150064) across all data stores.
 *
 * 1. Firestore `properties` — query city=Memphis, scan for "tutwiler" in address fields
 * 2. Firestore `properties` — full-collection scan for "tutwiler" (in case city field differs)
 * 3. Firestore `agent_outreach_queue` — scan for "tutwiler"
 * 4. Typesense `properties` — search for "tutwiler"
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import Typesense from 'typesense';

dotenv.config({ path: '.env.local' });

// ── Firebase ──────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});
const db = admin.firestore();

// ── Typesense ─────────────────────────────────────────────
const tsClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST!,
      port: parseInt(process.env.TYPESENSE_PORT || '443'),
      protocol: process.env.TYPESENSE_PROTOCOL || 'https',
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY!,
  connectionTimeoutSeconds: 5,
});

// ── Helpers ───────────────────────────────────────────────
function containsTutwiler(doc: FirebaseFirestore.DocumentData): boolean {
  const fields = [
    doc.address,
    doc.streetAddress,
    doc.fullAddress,
    doc.title,
    doc.slug,
    doc.url,
  ];
  return fields.some(
    (f) => typeof f === 'string' && f.toLowerCase().includes('tutwiler')
  );
}

function printDoc(label: string, id: string, d: FirebaseFirestore.DocumentData) {
  console.log(`\n  [${label}] doc id: ${id}`);
  console.log(`    address       : ${d.address || d.streetAddress || '(none)'}`);
  console.log(`    fullAddress   : ${d.fullAddress || '(none)'}`);
  console.log(`    city/state/zip: ${d.city || '?'}, ${d.state || '?'} ${d.zipCode || '?'}`);
  console.log(`    zpid          : ${d.zpid || '(none)'}`);
  console.log(`    isActive      : ${d.isActive}`);
  console.log(`    homeStatus    : ${d.homeStatus || '(none)'}`);
  console.log(`    dealTypes     : ${JSON.stringify(d.dealTypes || [])}`);
  console.log(`    isCashDeal    : ${d.isCashDeal}`);
  console.log(`    isOwnerfinance: ${d.isOwnerfinance}`);
  console.log(`    isAuction     : ${d.isAuction}`);
  console.log(`    isForeclosure : ${d.isForeclosure}`);
  console.log(`    price         : ${d.price ?? d.listPrice ?? '(none)'}`);
  console.log(`    zestimate     : ${d.zestimate ?? '(none)'}`);
  console.log(`    createdAt     : ${d.createdAt?.toDate?.()?.toISOString?.() || d.createdAt || '(none)'}`);
  console.log(`    updatedAt     : ${d.updatedAt?.toDate?.()?.toISOString?.() || d.updatedAt || '(none)'}`);
  console.log(`    lastScrapedAt : ${d.lastScrapedAt?.toDate?.()?.toISOString?.() || d.lastScrapedAt || '(none)'}`);
  console.log(`    source        : ${d.source || '(none)'}`);
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  let totalFound = 0;

  // ─── 1. Exact doc lookup ────────────────────────────────
  console.log('\n========== 1. EXACT DOC LOOKUP: zpid_42150064 ==========');
  const exactSnap = await db.collection('properties').doc('zpid_42150064').get();
  if (exactSnap.exists) {
    totalFound++;
    printDoc('properties', exactSnap.id, exactSnap.data()!);
  } else {
    console.log('  NOT FOUND at properties/zpid_42150064');
  }

  // ─── 2. Firestore properties — city = Memphis scan ──────
  console.log('\n========== 2. FIRESTORE properties — city=Memphis scan ==========');
  const memphisSnap = await db
    .collection('properties')
    .where('city', '==', 'Memphis')
    .get();
  console.log(`  Total Memphis docs: ${memphisSnap.size}`);
  let memphisHits = 0;
  for (const doc of memphisSnap.docs) {
    if (containsTutwiler(doc.data())) {
      memphisHits++;
      totalFound++;
      printDoc('properties/Memphis', doc.id, doc.data());
    }
  }
  if (memphisHits === 0) console.log('  No "tutwiler" match among Memphis docs.');

  // ─── 3. Firestore properties — zpid field query ─────────
  console.log('\n========== 3. FIRESTORE properties — zpid=42150064 query ==========');
  const zpidSnap = await db
    .collection('properties')
    .where('zpid', '==', '42150064')
    .get();
  if (zpidSnap.empty) {
    // Also try numeric
    const zpidSnapNum = await db
      .collection('properties')
      .where('zpid', '==', 42150064)
      .get();
    if (zpidSnapNum.empty) {
      console.log('  NOT FOUND by zpid field (string or number)');
    } else {
      for (const doc of zpidSnapNum.docs) {
        totalFound++;
        printDoc('properties/zpid-num', doc.id, doc.data());
      }
    }
  } else {
    for (const doc of zpidSnap.docs) {
      totalFound++;
      printDoc('properties/zpid-str', doc.id, doc.data());
    }
  }

  // ─── 4. Firestore agent_outreach_queue ──────────────────
  console.log('\n========== 4. FIRESTORE agent_outreach_queue scan ==========');
  try {
    const outreachSnap = await db.collection('agent_outreach_queue').get();
    console.log(`  Total docs: ${outreachSnap.size}`);
    let outreachHits = 0;
    for (const doc of outreachSnap.docs) {
      const d = doc.data();
      if (containsTutwiler(d) || (d.propertyId && d.propertyId.includes('42150064'))) {
        outreachHits++;
        console.log(`\n  [agent_outreach_queue] doc id: ${doc.id}`);
        console.log(`    propertyId : ${d.propertyId || '(none)'}`);
        console.log(`    address    : ${d.address || d.streetAddress || d.fullAddress || '(none)'}`);
        console.log(`    status     : ${d.status || '(none)'}`);
        console.log(`    agentName  : ${d.agentName || '(none)'}`);
      }
    }
    if (outreachHits === 0) console.log('  No "tutwiler" or zpid match found.');
  } catch (e: any) {
    console.log(`  Error querying agent_outreach_queue: ${e.message}`);
  }

  // ─── 5. Typesense search ────────────────────────────────
  console.log('\n========== 5. TYPESENSE — search "tutwiler" ==========');
  try {
    const tsResult = await tsClient
      .collections('properties')
      .documents()
      .search({
        q: 'tutwiler',
        query_by: 'address,city,description',
        per_page: 20,
      });
    console.log(`  Total hits: ${tsResult.found}`);
    if (tsResult.hits && tsResult.hits.length > 0) {
      for (const hit of tsResult.hits) {
        const d = hit.document as any;
        totalFound++;
        console.log(`\n  [Typesense] id: ${d.id}`);
        console.log(`    address   : ${d.address}`);
        console.log(`    city      : ${d.city}, ${d.state} ${d.zipCode}`);
        console.log(`    zpid      : ${d.zpid || '(none)'}`);
        console.log(`    isActive  : ${d.isActive}`);
        console.log(`    homeStatus: ${d.homeStatus || '(none)'}`);
        console.log(`    dealType  : ${d.dealType || '(none)'}`);
        console.log(`    listPrice : ${d.listPrice}`);
        console.log(`    zestimate : ${d.zestimate || '(none)'}`);
        console.log(`    isAuction : ${d.isAuction}`);
        console.log(`    isForeclos: ${d.isForeclosure}`);
        console.log(`    createdAt : ${d.createdAt}`);
        console.log(`    updatedAt : ${d.updatedAt}`);
      }
    } else {
      console.log('  No hits.');
    }
  } catch (e: any) {
    console.log(`  Typesense error: ${e.message}`);
  }

  // ─── 6. Typesense — filter by zpid ─────────────────────
  console.log('\n========== 6. TYPESENSE — filter zpid=42150064 ==========');
  try {
    const tsResult2 = await tsClient
      .collections('properties')
      .documents()
      .search({
        q: '*',
        query_by: 'address',
        filter_by: 'zpid:=42150064',
        per_page: 10,
      });
    console.log(`  Total hits: ${tsResult2.found}`);
    if (tsResult2.hits && tsResult2.hits.length > 0) {
      for (const hit of tsResult2.hits) {
        const d = hit.document as any;
        console.log(`\n  [Typesense/zpid] id: ${d.id}`);
        console.log(`    address  : ${d.address}`);
        console.log(`    isActive : ${d.isActive}`);
        console.log(`    dealType : ${d.dealType}`);
        console.log(`    listPrice: ${d.listPrice}`);
      }
    } else {
      console.log('  No hits.');
    }
  } catch (e: any) {
    console.log(`  Typesense error: ${e.message}`);
  }

  // ─── Summary ────────────────────────────────────────────
  console.log('\n========== SUMMARY ==========');
  console.log(`Total records found referencing Tutwiler / zpid 42150064: ${totalFound}`);
  if (totalFound === 0) {
    console.log('Property not found anywhere. If it is "still listed" on the site, it may be cached or served from a CDN/ISR page.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
