import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();
const APIFY_TOKEN = process.env.APIFY_API_KEY!;

const DATASETS = [
  '9i1qNYmg5zsel8m0W',
  'XDYWAO3Jqx5qpeSjp',
  'I19aymvYMfvgzj1y5',
];

interface CashDeal {
  address: string;
  city: string;
  state: string;
  zipcode: string;
  price: number;
  arv: number;
  percentOfArv: number;
  discount: number;
  beds: number;
  baths: number;
  sqft: number;
  url: string;
  zpid: string;
  status: string;
  imgSrc: string;
  addedAt: Date;
  source: string;
}

async function saveCashDeals() {
  console.log('=== SAVING CASH DEALS TO FIREBASE ===\n');

  const seenZpids = new Set<string>();
  const cashDeals: CashDeal[] = [];

  for (const datasetId of DATASETS) {
    console.log(`Fetching dataset ${datasetId}...`);

    let offset = 0;
    const limit = 1000;

    while (true) {
      const res = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}&offset=${offset}`
      );
      const items = await res.json();

      if (!items || items.length === 0) break;

      for (const item of items) {
        const zpid = String(item.zpid);
        if (seenZpids.has(zpid)) continue;

        const price = item.unformattedPrice || item.price;
        const arv = item.zestimate;

        if (price && arv && price > 0 && arv > 0) {
          const percent = (price / arv) * 100;

          if (percent < 70) {
            seenZpids.add(zpid);
            cashDeals.push({
              address: item.address || `${item.addressStreet}, ${item.addressCity}, ${item.addressState}`,
              city: item.addressCity || '',
              state: item.addressState || '',
              zipcode: item.addressZipcode || '',
              price,
              arv,
              percentOfArv: Math.round(percent * 10) / 10,
              discount: Math.round((100 - percent) * 10) / 10,
              beds: item.beds || 0,
              baths: item.baths || 0,
              sqft: item.area || 0,
              url: item.detailUrl,
              zpid,
              status: item.statusType || 'FOR_SALE',
              imgSrc: item.imgSrc || '',
              addedAt: new Date(),
              source: 'apify_search_scraper',
            });
          }
        }
      }

      offset += limit;
      if (items.length < limit) break;
    }
  }

  console.log(`\nFound ${cashDeals.length} unique cash deals\n`);

  // Save to Firebase in batches
  const BATCH_SIZE = 500;
  let saved = 0;

  for (let i = 0; i < cashDeals.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = cashDeals.slice(i, i + BATCH_SIZE);

    for (const deal of chunk) {
      const docRef = db.collection('cash_houses').doc(deal.zpid);
      batch.set(docRef, deal, { merge: true });
    }

    await batch.commit();
    saved += chunk.length;
    console.log(`Saved ${saved}/${cashDeals.length} deals`);
  }

  console.log(`\n✅ Saved ${saved} cash deals to cash_houses collection`);
}

saveCashDeals().catch(console.error);
