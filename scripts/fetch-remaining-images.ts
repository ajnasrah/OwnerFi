/**
 * Fetch remaining missing images
 */

import { getAdminDb } from '../src/lib/firebase-admin';
import { ApifyClient } from 'apify-client';
import Typesense from 'typesense';

const MISSING = [
  { zpid: 42212704, city: 'Memphis', state: 'TN', lat: 35.05, lng: -89.95 },
  { zpid: 94726151, city: 'Memphis', state: 'TN', lat: 35.12, lng: -90.05 },
  { zpid: 2057637761, city: 'Memphis', state: 'TN', lat: 35.08, lng: -89.88 },
  { zpid: 161591197, city: 'Memphis', state: 'TN', lat: 35.05, lng: -89.85 },
  { zpid: 42325513, city: 'Lakeland', state: 'TN', lat: 35.23, lng: -89.72 },
  { zpid: 62863412, city: 'Cordova', state: 'TN', lat: 35.15, lng: -89.78 },
  { zpid: 2053587663, city: 'Memphis', state: 'TN', lat: 35.1, lng: -89.82 },
  { zpid: 339863700, city: 'Cordova', state: 'TN', lat: 35.16, lng: -89.75 },
  { zpid: 42274392, city: 'Memphis', state: 'TN', lat: 35.13, lng: -90.0 },
  { zpid: 89195344, city: 'Memphis', state: 'TN', lat: 35.14, lng: -90.04 },
  { zpid: 42142862, city: 'Memphis', state: 'TN', lat: 35.15, lng: -90.03 },
  { zpid: 2057609639, city: 'Hernando', state: 'MS', lat: 34.82, lng: -90.0 },
  { zpid: 450678102, city: 'Arlington', state: 'TN', lat: 35.29, lng: -89.67 },
  { zpid: 458491460, city: 'Memphis', state: 'TN', lat: 35.11, lng: -90.0 },
  { zpid: 42323347, city: 'Memphis', state: 'TN', lat: 35.0, lng: -89.9 },
  { zpid: 55302375, city: 'Memphis', state: 'TN', lat: 35.06, lng: -89.93 },
];

function buildSearchUrl(lat: number, lng: number): string {
  const mapBounds = {
    north: lat + 0.03,
    south: lat - 0.03,
    east: lng + 0.03,
    west: lng - 0.03,
  };
  const searchQueryState = {
    mapBounds,
    isMapVisible: true,
    filterState: { sort: { value: "days" }, ah: { value: true } },
    isListVisible: true,
    mapZoom: 15
  };
  return `https://www.zillow.com/homes/?searchQueryState=${encodeURIComponent(JSON.stringify(searchQueryState))}`;
}

async function main() {
  const db = await getAdminDb();
  if (!db) return;

  const typesense = new Typesense.Client({
    nodes: [{ host: process.env.TYPESENSE_HOST || "", port: 443, protocol: "https" }],
    apiKey: process.env.TYPESENSE_API_KEY || "",
  });

  const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

  console.log('=== FETCHING REMAINING IMAGES ===\n');

  let updated = 0;

  for (const prop of MISSING) {
    console.log(`\n--- zpid ${prop.zpid} (${prop.city}) ---`);

    try {
      const run = await apify.actor('maxcopell/zillow-scraper').call({
        searchUrls: [{ url: buildSearchUrl(prop.lat, prop.lng) }],
        maxResults: 50,
        mode: 'pagination'
      }, { timeout: 90 });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems();
      console.log(`Got ${items.length} results`);

      const match = items.find((item: any) => String(item.zpid) === String(prop.zpid));

      if (match && (match as any).imgSrc) {
        const imgSrc = (match as any).imgSrc;
        console.log(`✓ Found: ${imgSrc.substring(0, 50)}...`);

        // Update Firestore
        const snapshot = await db.collection("zillow_imports")
          .where("zpid", "==", prop.zpid)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          await db.collection("zillow_imports").doc(snapshot.docs[0].id).update({
            imgSrc,
            firstPropertyImage: imgSrc,
            imageUpdatedAt: new Date().toISOString()
          });

          // Update Typesense
          for (const tsId of [String(prop.zpid), snapshot.docs[0].id]) {
            try {
              await typesense.collections("properties").documents(tsId).update({
                primaryImage: imgSrc
              });
              console.log(`✓ Updated Typesense: ${tsId}`);
              updated++;
              break;
            } catch { }
          }
        }
      } else {
        console.log(`❌ Not found in search results`);
      }
    } catch (error: any) {
      console.log(`Failed: ${error.message}`);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n=== COMPLETE ===`);
  console.log(`Updated: ${updated}`);
}

main().catch(console.error);
