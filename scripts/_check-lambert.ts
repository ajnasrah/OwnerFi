/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();

async function main() {
  const snap = await db.collection('properties').get();
  const hits: any[] = [];
  snap.docs.forEach((d: any) => {
    const data = d.data();
    const addr = String(data.fullAddress || data.address || data.streetAddress || '').toLowerCase();
    if (addr.includes('lambert')) {
      hits.push({ id: d.id, ...data });
    }
  });

  console.log(`Found ${hits.length} properties with "lambert" in address\n`);
  hits.forEach(h => {
    console.log(`ID: ${h.id}`);
    console.log(`  Address:          ${h.fullAddress || h.address || h.streetAddress}`);
    console.log(`  City / State:     ${h.city}, ${h.state}`);
    console.log(`  isActive:         ${h.isActive}`);
    console.log(`  listPrice:        ${h.listPrice || h.price}`);
    console.log(`  homeStatus:       ${h.homeStatus}`);
    console.log(`  isOwnerfinance:   ${h.isOwnerfinance}`);
    console.log(`  isCashDeal:       ${h.isCashDeal}`);
    console.log(`  dealType:         ${h.dealType}`);
    console.log(`  dealTypes:        ${JSON.stringify(h.dealTypes)}`);
    console.log(`  source:           ${h.source}`);
    console.log(`  updatedAt:        ${h.updatedAt?.toDate?.()?.toISOString?.() || h.updatedAt}`);
    console.log('');
  });
}

main().catch(e => { console.error(e); process.exit(1); });
