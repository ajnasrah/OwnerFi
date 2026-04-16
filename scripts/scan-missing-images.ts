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

function hasHttp(url: any): boolean {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

function isMissingImage(d: any): boolean {
  const urls = d.imageUrls;
  if (Array.isArray(urls) && urls.some(hasHttp)) return false;
  if (hasHttp(d.imageUrl)) return false;
  if (hasHttp(d.imgSrc)) return false;
  if (hasHttp(d.hiResImageLink)) return false;
  if (hasHttp(d.mediumImageLink)) return false;
  if (hasHttp(d.desktopWebHdpImageLink)) return false;
  if (Array.isArray(d.photos) && d.photos.some((p: any) => hasHttp(typeof p === 'string' ? p : p?.url))) return false;
  if (Array.isArray(d.responsivePhotos) && d.responsivePhotos.some((p: any) => hasHttp(p?.url))) return false;
  return true;
}

async function main() {
  console.log('Scanning properties collection for missing images...\n');

  const snap = await db.collection('properties').get();
  console.log(`Total properties: ${snap.size}`);

  const missing: Array<{
    id: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    isActive: boolean;
    status: string;
    dealTypes: string[];
    source: string;
    createdAt: string;
    lastScrapedAt: string;
    zpid: string;
  }> = [];

  const byState: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byDealType: Record<string, number> = {};
  let contiFound = false;

  for (const doc of snap.docs) {
    const d = doc.data();
    if (!isMissingImage(d)) continue;

    const address = d.address || d.streetAddress || '';
    const city = d.city || '';
    const state = d.state || '';
    const zip = d.zipCode || d.zip || '';
    const isActive = d.isActive !== false;
    const status = d.status || '';
    const dealTypes = Array.isArray(d.dealTypes) ? d.dealTypes : [];
    const source = d.source || d.importSource || d.apifyRunId ? (d.source || d.importSource || 'scraper') : 'unknown';
    const createdAt = d.createdAt?.toDate?.()?.toISOString?.() || String(d.createdAt || '');
    const lastScrapedAt = d.lastScrapedAt?.toDate?.()?.toISOString?.() || String(d.lastScrapedAt || '');
    const zpid = String(d.zpid || '');

    missing.push({ id: doc.id, address, city, state, zip, isActive, status, dealTypes, source, createdAt, lastScrapedAt, zpid });

    byState[state] = (byState[state] || 0) + 1;
    bySource[source] = (bySource[source] || 0) + 1;
    byStatus[status || '(none)'] = (byStatus[status || '(none)'] || 0) + 1;
    for (const dt of dealTypes.length ? dealTypes : ['(none)']) {
      byDealType[dt] = (byDealType[dt] || 0) + 1;
    }

    if (address.toLowerCase().includes('2938 conti') || address.toLowerCase().includes('conti cv')) {
      contiFound = true;
      console.log('\n=== 2938 Conti Cv MATCH ===');
      console.log('Doc ID:', doc.id);
      console.log('Address:', address, city, state, zip);
      console.log('isActive:', isActive, 'status:', status);
      console.log('dealTypes:', dealTypes);
      console.log('source:', source);
      console.log('createdAt:', createdAt);
      console.log('zpid:', zpid);
    }
  }

  console.log(`\n=== Missing images: ${missing.length} / ${snap.size} (${((missing.length/snap.size)*100).toFixed(1)}%) ===\n`);

  console.log('By state:');
  Object.entries(byState).sort((a,b) => b[1]-a[1]).slice(0, 15).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  console.log('\nBy status:');
  Object.entries(byStatus).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  console.log('\nBy source:');
  Object.entries(bySource).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  console.log('\nBy dealType:');
  Object.entries(byDealType).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  const activeMissing = missing.filter(m => m.isActive);
  console.log(`\nActive + missing: ${activeMissing.length}`);
  console.log(`Inactive + missing: ${missing.length - activeMissing.length}`);

  const outPath = 'scripts/missing-images.json';
  fs.writeFileSync(outPath, JSON.stringify(missing, null, 2));
  console.log(`\nFull list written to ${outPath}`);

  if (!contiFound) {
    console.log('\n(2938 Conti Cv not found in missing-image set; checking entire DB...)');
    const direct = await db.collection('properties')
      .where('city', '==', 'Memphis')
      .where('state', '==', 'TN')
      .get();
    for (const doc of direct.docs) {
      const d = doc.data();
      const addr = (d.address || d.streetAddress || '').toLowerCase();
      if (addr.includes('conti')) {
        console.log('Found Conti in Memphis TN:', doc.id, d.address, 'imageUrls:', d.imageUrls);
      }
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
