import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { ApifyClient } from 'apify-client';

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

const TARGETS = [
  { zpid: '42150064', url: 'https://www.zillow.com/homedetails/1739-Tutwiler-Ave-Memphis-TN-38112/42150064_zpid/', label: 'Tutwiler (off market)' },
  { zpid: '92205582', url: 'https://www.zillow.com/homedetails/10957-Lexington-Dr-Olive-Branch-MS-38654/92205582_zpid/', label: 'Lexington (auction)' },
];

async function main() {
  const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

  // Fire Apify in parallel for all targets
  console.log('Starting parallel Apify scrapes...\n');
  const apifyPromises = TARGETS.map(t =>
    client.actor('maxcopell/zillow-detail-scraper').start({
      startUrls: [{ url: t.url }],
    }).then(run => client.run(run.id).waitForFinish({ waitSecs: 300 })
      .then(f => f.status === 'SUCCEEDED'
        ? client.dataset(f.defaultDatasetId).listItems().then(({ items }) => items[0])
        : null)
    )
  );

  for (let i = 0; i < TARGETS.length; i++) {
    const t = TARGETS[i];
    console.log(`\n========== ${t.label} (zpid_${t.zpid}) ==========`);
    const ref = db.collection('properties').doc(`zpid_${t.zpid}`);
    const snap = await ref.get();
    if (!snap.exists) { console.log('NOT in properties collection'); }
    else {
      const d = snap.data() || {};
      console.log('--- FIRESTORE ---');
      console.log('  Address:', d.fullAddress || d.streetAddress);
      console.log('  homeStatus:', d.homeStatus);
      console.log('  isActive:', d.isActive, '| isAuction:', d.isAuction, '| isForeclosure:', d.isForeclosure, '| isBankOwned:', d.isBankOwned);
      console.log('  isCashDeal:', d.isCashDeal, '| isOwnerfinance:', d.isOwnerfinance);
      console.log('  dealTypes:', d.dealTypes);
      console.log('  listingSubType:', d.listingSubType);
      console.log('  price:', d.price, '| listPrice:', d.listPrice);
      console.log('  lastStatusCheck:', d.lastStatusCheck?.toDate?.()?.toISOString?.() || d.lastStatusCheck);
      console.log('  lastScrapedAt:', d.lastScrapedAt?.toDate?.()?.toISOString?.() || d.lastScrapedAt);
      console.log('  consecutiveNoResults:', d.consecutiveNoResults);
      console.log('  offMarketReason:', d.offMarketReason);
      console.log('  source:', d.source);
    }

    const raw = await apifyPromises[i] as any;
    console.log('--- LIVE APIFY ---');
    if (!raw) { console.log('  No items returned'); continue; }
    console.log('  homeStatus:', raw.homeStatus);
    console.log('  keystoneHomeStatus:', raw.keystoneHomeStatus);
    console.log('  contingentListingType:', raw.contingentListingType);
    console.log('  listingSubType:', raw.listingSubType);
    console.log('  listing_sub_type:', raw.listing_sub_type);
    console.log('  price:', raw.price, '| listPrice:', raw.listPrice);
    console.log('  isPreforeclosureAuction:', raw.isPreforeclosureAuction);
    console.log('  foreclosureTypes:', raw.foreclosureTypes);
    console.log('  foreclosureAuctionDescription:', raw.foreclosureAuctionDescription);
    console.log('  foreclosureDate:', raw.foreclosureDate);
    console.log('  daysOnZillow:', raw.daysOnZillow);
    console.log('  priceHistory[0]:', JSON.stringify(raw.priceHistory?.[0]));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
