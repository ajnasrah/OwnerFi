/**
 * Fetch images using proper Zillow search URLs with searchQueryState
 */

import { getAdminDb } from '../src/lib/firebase-admin';
import { ApifyClient } from 'apify-client';
import Typesense from 'typesense';

const MISSING = [
  { zpid: 70589260, city: 'Memphis', state: 'TN', lat: 35.0132, lng: -89.847466 },
  { zpid: 42308812, city: 'Collierville', state: 'TN', lat: 35.042442, lng: -89.720375 },
  { zpid: 42297568, city: 'Memphis', state: 'TN', lat: 35.208897, lng: -89.853165 },
  { zpid: 42209206, city: 'Memphis', state: 'TN', lat: 35.1, lng: -89.9 },
  { zpid: 42325513, city: 'Lakeland', state: 'TN', lat: 35.2, lng: -89.7 },
  { zpid: 62863412, city: 'Cordova', state: 'TN', lat: 35.15, lng: -89.78 },
  { zpid: 339863700, city: 'Cordova', state: 'TN', lat: 35.15, lng: -89.78 },
  { zpid: 42142862, city: 'Memphis', state: 'TN', lat: 35.1, lng: -89.9 },
  { zpid: 2057609639, city: 'Hernando', state: 'MS', lat: 34.82, lng: -90.0 },
  { zpid: 450678102, city: 'Arlington', state: 'TN', lat: 35.3, lng: -89.66 },
];

function buildZillowSearchUrl(lat: number, lng: number): string {
  // Build a proper Zillow URL with searchQueryState
  const mapBounds = {
    north: lat + 0.05,
    south: lat - 0.05,
    east: lng + 0.05,
    west: lng - 0.05,
  };

  const searchQueryState = {
    mapBounds,
    isMapVisible: true,
    filterState: {
      sort: { value: "days" },
      ah: { value: true }
    },
    isListVisible: true,
    mapZoom: 14
  };

  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
  return `https://www.zillow.com/homes/?searchQueryState=${encoded}`;
}

async function main() {
  const db = await getAdminDb();
  if (!db) {
    console.log("DB not initialized");
    return;
  }

  const typesense = new Typesense.Client({
    nodes: [{
      host: process.env.TYPESENSE_HOST || "localhost",
      port: 443,
      protocol: "https"
    }],
    apiKey: process.env.TYPESENSE_API_KEY || "",
    connectionTimeoutSeconds: 10,
  });

  const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

  console.log('=== FETCHING IMAGES WITH PROPER SEARCH URLS ===\n');

  let updated = 0;

  // Process each property individually with its own search
  for (const prop of MISSING) {
    console.log(`\n--- ${prop.city}: zpid ${prop.zpid} ---`);

    const searchUrl = buildZillowSearchUrl(prop.lat, prop.lng);
    console.log(`Searching near (${prop.lat}, ${prop.lng})...`);

    try {
      const run = await apify.actor('maxcopell/zillow-scraper').call({
        searchUrls: [{ url: searchUrl }],
        maxResults: 100,
        mode: 'pagination'
      }, { timeout: 120 });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems();
      console.log(`Got ${items.length} results`);

      const match = items.find((item: any) => String(item.zpid) === String(prop.zpid));

      if (match && (match as any).imgSrc) {
        const imgSrc = (match as any).imgSrc;
        console.log(`✓ Found: ${imgSrc.substring(0, 60)}...`);

        // Find Firestore doc
        const snapshot = await db.collection("zillow_imports")
          .where("zpid", "==", prop.zpid)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const docId = snapshot.docs[0].id;

          await db.collection("zillow_imports").doc(docId).update({
            imgSrc,
            firstPropertyImage: imgSrc,
            imageUpdatedAt: new Date().toISOString()
          });

          for (const tsId of [String(prop.zpid), docId]) {
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
        console.log(`❌ zpid ${prop.zpid} not in results`);
      }
    } catch (error: any) {
      console.log(`Failed: ${error.message}`);
    }

    // Delay
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log(`\n=== COMPLETE ===`);
  console.log(`Updated: ${updated} properties`);
}

main().catch(console.error);
