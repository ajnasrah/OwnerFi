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

const DELETE_STATUSES = new Set(['SOLD', 'RECENTLY_SOLD', 'PENDING', 'CONTINGENT', 'OFF_MARKET', 'UNDER_CONTRACT', 'OTHER']);

async function main() {
  console.log('Classifying active properties by homeStatus + image state...\n');

  const snap = await db.collection('properties').where('isActive', '==', true).get();
  console.log(`Total ACTIVE properties: ${snap.size}\n`);

  const toDelete: any[] = [];      // active in DB but homeStatus says closed/sold
  const toRescrape: any[] = [];    // active, valid status (or UNKNOWN), missing images
  const okNoImage: any[] = [];     // active, for-sale, missing images (same as toRescrape really)
  const homeStatusCounts: Record<string, number> = {};
  const homeStatusMissing: Record<string, number> = {};

  for (const doc of snap.docs) {
    const d = doc.data();
    const status = String(d.homeStatus || '').toUpperCase() || 'UNKNOWN';
    const missing = isMissingImage(d);

    homeStatusCounts[status] = (homeStatusCounts[status] || 0) + 1;
    if (missing) homeStatusMissing[status] = (homeStatusMissing[status] || 0) + 1;

    const row = {
      id: doc.id,
      zpid: String(d.zpid || ''),
      address: d.address || d.streetAddress || '',
      city: d.city || '',
      state: d.state || '',
      zip: d.zipCode || d.zip || '',
      homeStatus: status,
      source: d.source || d.importSource || 'unknown',
      dealTypes: Array.isArray(d.dealTypes) ? d.dealTypes : [],
      missingImage: missing,
      lastStatusCheck: d.lastStatusCheck?.toDate?.()?.toISOString?.() || null,
      createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
    };

    if (DELETE_STATUSES.has(status)) {
      toDelete.push(row);
    } else if (missing) {
      toRescrape.push(row);
    }
  }

  console.log('ACTIVE properties — homeStatus distribution:');
  Object.entries(homeStatusCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
    const m = homeStatusMissing[k] || 0;
    console.log(`  ${k.padEnd(18)} total=${String(v).padStart(5)}  missing-image=${m}`);
  });

  console.log(`\n=== DELETE candidates (active-in-DB + status is closed/sold/pending) ===`);
  console.log(`  Count: ${toDelete.length}`);
  const byDelStatus: Record<string, number> = {};
  for (const r of toDelete) byDelStatus[r.homeStatus] = (byDelStatus[r.homeStatus] || 0) + 1;
  Object.entries(byDelStatus).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`    ${k}: ${v}`));

  console.log(`\n=== RESCRAPE candidates (active, for-sale/unknown status, missing images) ===`);
  console.log(`  Count: ${toRescrape.length}`);
  const byRescrapeStatus: Record<string, number> = {};
  const withZpid = toRescrape.filter(r => r.zpid).length;
  for (const r of toRescrape) byRescrapeStatus[r.homeStatus] = (byRescrapeStatus[r.homeStatus] || 0) + 1;
  Object.entries(byRescrapeStatus).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`    ${k}: ${v}`));
  console.log(`  With zpid: ${withZpid} / ${toRescrape.length}`);

  fs.writeFileSync('scripts/to-delete.json', JSON.stringify(toDelete, null, 2));
  fs.writeFileSync('scripts/to-rescrape.json', JSON.stringify(toRescrape, null, 2));
  console.log('\nLists saved:');
  console.log('  scripts/to-delete.json');
  console.log('  scripts/to-rescrape.json');

  const conti = [...toDelete, ...toRescrape].find(r => r.address.toLowerCase().includes('2938 conti'));
  if (conti) {
    console.log('\n2938 Conti Cv classification:', conti.homeStatus, '→', toDelete.includes(conti) ? 'DELETE' : 'RESCRAPE');
    console.log('  zpid:', conti.zpid);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
