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
const hasHttp = (v: any) => typeof v === 'string' && /^https?:\/\//i.test(v.trim());

function findImageInObj(obj: any, prefix = ''): Array<{ key: string; val: string }> {
  const out: Array<{ key: string; val: string }> = [];
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    if (hasHttp(v) && /image|photo|img|jpg|jpeg|png|zillowstatic|pic/i.test(v as string + k)) {
      out.push({ key: prefix + k, val: (v as string).slice(0, 120) });
    } else if (Array.isArray(v) && v.length) {
      const first = v[0];
      if (typeof first === 'string' && hasHttp(first)) {
        out.push({ key: prefix + k, val: `[${v.length}] ${first.slice(0,100)}` });
      } else if (typeof first === 'object' && first) {
        // look one level deeper
        for (const [k2, v2] of Object.entries(first)) {
          if (hasHttp(v2)) out.push({ key: `${prefix}${k}[0].${k2}`, val: (v2 as string).slice(0, 120) });
        }
      }
    }
  }
  return out;
}

async function main() {
  const missing = require('../scripts/truly-missing-images.json');
  console.log(`Checking ${missing.length} missing-image properties for image URLs in rawData + agent_outreach_queue...\n`);

  let rawDataHits = 0;
  let queueHits = 0;
  let noHits = 0;

  for (const m of missing) {
    console.log(`\n=== ${m.id} — ${m.address} ===`);
    const doc = await db.collection('properties').doc(m.id).get();
    const d = doc.data()!;
    const raw = d.rawData;
    if (raw) {
      console.log(`  rawData keys: ${Object.keys(raw).slice(0,15).join(', ')}${Object.keys(raw).length > 15 ? '...' : ''}`);
      const found = findImageInObj(raw);
      if (found.length) {
        rawDataHits++;
        console.log(`  >>> rawData IMAGE HITS:`);
        found.slice(0, 5).forEach(f => console.log(`    ${f.key} = ${f.val}`));
      } else {
        console.log(`  rawData: no image-like URLs`);
      }
    } else {
      console.log(`  no rawData field`);
    }

    // Check agent_outreach_queue for this zpid
    if (d.originalQueueId) {
      const q = await db.collection('agent_outreach_queue').doc(d.originalQueueId).get();
      if (q.exists) {
        const qd = q.data()!;
        const found = findImageInObj(qd);
        if (found.length) {
          queueHits++;
          console.log(`  >>> agent_outreach_queue[${d.originalQueueId}] HITS:`);
          found.slice(0, 3).forEach(f => console.log(`    ${f.key} = ${f.val}`));
        } else {
          console.log(`  agent_outreach_queue[${d.originalQueueId}]: no image fields`);
        }
      }
    }
  }

  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Image found in rawData: ${rawDataHits} / ${missing.length}`);
  console.log(`Image found in agent_outreach_queue: ${queueHits} / ${missing.length}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
