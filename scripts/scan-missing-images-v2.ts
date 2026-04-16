import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

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

function findImage(d: any): string | null {
  if (hasHttp(d.primaryImage)) return d.primaryImage;
  if (hasHttp(d.firstPropertyImage)) return d.firstPropertyImage;
  if (Array.isArray(d.imageUrls)) {
    const f = d.imageUrls.find(hasHttp);
    if (f) return f;
  }
  if (hasHttp(d.imageUrl)) return d.imageUrl;
  if (hasHttp(d.imgSrc)) return d.imgSrc;
  if (hasHttp(d.hiResImageLink)) return d.hiResImageLink;
  if (hasHttp(d.mediumImageLink)) return d.mediumImageLink;
  if (hasHttp(d.desktopWebHdpImageLink)) return d.desktopWebHdpImageLink;
  if (Array.isArray(d.photos)) {
    for (const p of d.photos) {
      const u = typeof p === 'string' ? p : p?.url;
      if (hasHttp(u)) return u;
    }
  }
  if (Array.isArray(d.responsivePhotos)) {
    const f = d.responsivePhotos.find((p: any) => hasHttp(p?.url));
    if (f) return f.url;
  }
  return null;
}

async function main() {
  const activeSnap = await db.collection('properties').where('isActive', '==', true).get();
  console.log(`ACTIVE properties: ${activeSnap.size}\n`);

  const missing: any[] = [];
  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let contiHit: any = null;

  for (const doc of activeSnap.docs) {
    const d = doc.data();
    const img = findImage(d);
    if (img) continue;

    const source = d.source || d.importSource || 'unknown';
    const status = String(d.homeStatus || 'UNKNOWN').toUpperCase();
    bySource[source] = (bySource[source] || 0) + 1;
    byStatus[status] = (byStatus[status] || 0) + 1;

    const row = {
      id: doc.id,
      zpid: String(d.zpid || ''),
      address: d.address || d.streetAddress || d.fullAddress || '',
      city: d.city || '',
      state: d.state || '',
      zip: d.zipCode || '',
      homeStatus: status,
      source,
      dealTypes: Array.isArray(d.dealTypes) ? d.dealTypes : [],
      url: d.url || d.hdpUrl || '',
      createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
    };
    missing.push(row);
    if (row.address.toLowerCase().includes('2938 conti')) contiHit = row;
  }

  console.log(`TRULY MISSING images (active only): ${missing.length} / ${activeSnap.size}\n`);
  console.log('By source:');
  Object.entries(bySource).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
  console.log('\nBy homeStatus:');
  Object.entries(byStatus).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  fs.writeFileSync('scripts/truly-missing-images.json', JSON.stringify(missing, null, 2));
  console.log(`\nList: scripts/truly-missing-images.json`);

  if (contiHit) {
    console.log('\n2938 Conti Cv:', contiHit);
  } else {
    console.log('\n2938 Conti Cv NOT in missing set — has image now?');
    const doc = await db.collection('properties').doc('zpid_42230977').get();
    if (doc.exists) {
      const d = doc.data()!;
      console.log('  primaryImage:', d.primaryImage || '(none)');
      console.log('  firstPropertyImage:', d.firstPropertyImage || '(none)');
      console.log('  imageUrls:', d.imageUrls || '(none)');
    }
  }

  // Also check inactive — user said "active" but may want totals
  const inactiveSnap = await db.collection('properties').where('isActive', '==', false).get();
  let inactiveMissing = 0;
  for (const doc of inactiveSnap.docs) {
    if (!findImage(doc.data())) inactiveMissing++;
  }
  console.log(`\nFor reference — inactive missing: ${inactiveMissing} / ${inactiveSnap.size}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
