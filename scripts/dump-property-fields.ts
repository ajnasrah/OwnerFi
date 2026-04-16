import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function main() {
  const ids = ['zpid_42230977'];
  for (const id of ids) {
    const doc = await db.collection('properties').doc(id).get();
    if (!doc.exists) { console.log(id, 'NOT FOUND'); continue; }
    const d = doc.data()!;
    console.log(`\n=== ${id} ===`);
    console.log(`Address: ${d.address} | city=${d.city} state=${d.state} zip=${d.zipCode}`);
    console.log(`\nALL KEYS (${Object.keys(d).length}):`);
    console.log(Object.keys(d).sort().join('\n'));
    console.log('\n--- Any field containing "image", "photo", "img", "picture", "link", "url" ---');
    for (const [k, v] of Object.entries(d)) {
      if (/image|photo|img|picture|link|url/i.test(k)) {
        const preview = typeof v === 'string' ? v.slice(0, 150)
          : Array.isArray(v) ? `[${v.length}] ${JSON.stringify(v).slice(0,200)}`
          : JSON.stringify(v)?.slice(0, 200);
        console.log(`  ${k}: ${preview}`);
      }
    }
  }

  // Sample 5 from the missing list — see if any have hidden image fields
  console.log('\n\n=== SAMPLING 5 MORE "MISSING" ACTIVE PROPERTIES ===');
  const missing = require('../scripts/to-rescrape.json');
  const samples = missing.slice(0, 5);
  for (const s of samples) {
    const doc = await db.collection('properties').doc(s.id).get();
    if (!doc.exists) continue;
    const d = doc.data()!;
    console.log(`\n--- ${s.id} (${d.address}) ---`);
    for (const [k, v] of Object.entries(d)) {
      if (/image|photo|img|picture|link/i.test(k)) {
        const preview = typeof v === 'string' ? v.slice(0, 150)
          : Array.isArray(v) ? `[${v.length}] ${JSON.stringify(v).slice(0,200)}`
          : JSON.stringify(v)?.slice(0, 200);
        console.log(`  ${k}: ${preview}`);
      }
    }
  }

  // Check other collections for the same zpid (maybe raw zillow data is saved elsewhere)
  console.log('\n\n=== OTHER COLLECTIONS — SEARCHING FOR zpid 42230977 ===');
  const otherCols = ['zillow_imports', 'raw_zillow', 'apify_runs', 'properties_archive', 'ghl_properties', 'properties_raw'];
  for (const col of otherCols) {
    try {
      const byId = await db.collection(col).doc('zpid_42230977').get();
      if (byId.exists) {
        console.log(`\n  [${col}] doc zpid_42230977 EXISTS`);
        const d = byId.data()!;
        for (const [k, v] of Object.entries(d)) {
          if (/image|photo|img|picture|link/i.test(k)) {
            const preview = typeof v === 'string' ? v.slice(0, 200)
              : Array.isArray(v) ? `[${v.length}] ${JSON.stringify(v).slice(0,200)}`
              : JSON.stringify(v)?.slice(0, 200);
            console.log(`    ${k}: ${preview}`);
          }
        }
      }
      const byZpid = await db.collection(col).where('zpid', '==', 42230977).limit(3).get();
      if (!byZpid.empty) {
        console.log(`\n  [${col}] zpid=42230977 query returned ${byZpid.size}`);
        byZpid.docs.forEach(d => {
          console.log(`    id=${d.id} keys=${Object.keys(d.data()).filter(k => /image|photo|img|link/i.test(k)).join(',')}`);
        });
      }
    } catch (e: any) {
      // collection doesn't exist — skip silently
    }
  }

  // List all root-level collections
  console.log('\n=== ALL ROOT COLLECTIONS ===');
  const cols = await db.listCollections();
  console.log(cols.map(c => c.id).sort().join('\n'));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
