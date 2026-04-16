/**
 * Dump full properties collection + agent_outreach_queue + Typesense docs
 * to local JSON files so 10 parallel audit agents can read from disk
 * (1 Firestore read pass, not 10).
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();
const OUT_DIR = path.resolve(__dirname, '../audit-reports');

function normalize(d: any): any {
  if (d === null || d === undefined) return d;
  if (d?._seconds !== undefined && d?._nanoseconds !== undefined) {
    return new Date(d._seconds * 1000).toISOString();
  }
  if (typeof d?.toDate === 'function') return d.toDate().toISOString();
  if (Array.isArray(d)) return d.map(normalize);
  if (typeof d === 'object') {
    const o: any = {};
    for (const [k, v] of Object.entries(d)) o[k] = normalize(v);
    return o;
  }
  return d;
}

async function dumpCollection(coll: string, outFile: string, trimRawData = true): Promise<number> {
  console.log(`\n[${coll}] fetching...`);
  const snap = await db.collection(coll).get();
  const docs: any[] = [];
  for (const doc of snap.docs) {
    const data = normalize(doc.data());
    if (trimRawData && data?.rawData) {
      data.rawData = '<trimmed>';
    }
    docs.push({ id: doc.id, ...data });
  }
  const full = path.join(OUT_DIR, outFile);
  fs.writeFileSync(full, JSON.stringify(docs, null, 0));
  const stat = fs.statSync(full);
  console.log(`  ✅ ${coll}: ${docs.length} docs → ${outFile} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
  return docs.length;
}

async function dumpTypesense(): Promise<number> {
  console.log('\n[typesense] fetching...');
  const host = process.env.TYPESENSE_HOST;
  const apiKey = process.env.TYPESENSE_ADMIN_API_KEY || process.env.TYPESENSE_API_KEY;
  if (!host || !apiKey) {
    console.log('  ⚠️ Typesense env vars missing; skipping');
    return 0;
  }
  const port = process.env.TYPESENSE_PORT || '443';
  const protocol = process.env.TYPESENSE_PROTOCOL || 'https';
  const collection = 'properties';
  const all: any[] = [];
  let page = 1;
  const perPage = 250;
  while (true) {
    const url = `${protocol}://${host}:${port}/collections/${collection}/documents/search?q=*&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, { headers: { 'X-TYPESENSE-API-KEY': apiKey } });
    if (!res.ok) {
      console.log(`  ⚠️ Typesense ${res.status}: ${await res.text()}`);
      break;
    }
    const body: any = await res.json();
    const hits = body.hits || [];
    if (hits.length === 0) break;
    for (const h of hits) all.push(h.document);
    if (hits.length < perPage) break;
    page++;
    if (page > 100) break; // safety
  }
  const outFile = 'dump-typesense.json';
  fs.writeFileSync(path.join(OUT_DIR, outFile), JSON.stringify(all, null, 0));
  console.log(`  ✅ typesense: ${all.length} docs → ${outFile}`);
  return all.length;
}

async function main() {
  const propCount = await dumpCollection('properties', 'dump-properties.json', true);
  const queueCount = await dumpCollection('agent_outreach_queue', 'dump-agent-outreach-queue.json', true);
  const tsCount = await dumpTypesense();

  const manifest = {
    dumpedAt: new Date().toISOString(),
    counts: {
      properties: propCount,
      agent_outreach_queue: queueCount,
      typesense: tsCount,
    },
    files: {
      properties: 'dump-properties.json',
      agent_outreach_queue: 'dump-agent-outreach-queue.json',
      typesense: 'dump-typesense.json',
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\n✅ Dump complete. Manifest written to audit-reports/manifest.json');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
