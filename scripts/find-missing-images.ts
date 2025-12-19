/**
 * Find image links for properties missing images
 *
 * 1. Get all properties without images from Typesense
 * 2. Check Firestore for any image fields we might have missed
 * 3. Report findings
 */

import Typesense from 'typesense';
import { getAdminDb } from '../src/lib/firebase-admin';

async function main() {
  const client = new Typesense.Client({
    nodes: [{
      host: process.env.TYPESENSE_HOST || "localhost",
      port: 443,
      protocol: "https"
    }],
    apiKey: process.env.TYPESENSE_API_KEY || "",
    connectionTimeoutSeconds: 10,
  });

  const db = await getAdminDb();
  if (!db) {
    console.log("DB not initialized");
    return;
  }

  console.log('=== FINDING MISSING IMAGES ===\n');

  // Get all properties from Typesense
  let page = 1;
  const perPage = 250;
  const missingImages: any[] = [];

  while (true) {
    const result = await client.collections("properties").documents().search({
      q: "*",
      per_page: perPage,
      page,
      include_fields: "id,address,city,state,primaryImage,sourceType,zpid"
    });

    if (!result.hits || result.hits.length === 0) break;

    for (const hit of result.hits) {
      const doc = (hit as any).document;
      if (!doc.primaryImage || doc.primaryImage.length === 0) {
        missingImages.push(doc);
      }
    }

    if (result.hits.length < perPage) break;
    page++;
  }

  console.log(`Found ${missingImages.length} properties without images\n`);

  // Check each in Firestore
  const imageFields = [
    'imgSrc', 'imageUrl', 'firstPropertyImage', 'primaryImage',
    'image', 'photo', 'thumbnail', 'coverImage', 'mainImage',
    'propertyImage', 'listingImage', 'hdpUrl', 'imageUrls', 'propertyImages',
    'photos', 'images', 'media', 'galleryImages'
  ];

  let foundCount = 0;
  let notFoundCount = 0;
  const foundImages: Array<{ id: string; address: string; field: string; url: string }> = [];
  const stillMissing: Array<{ id: string; address: string; zpid?: string }> = [];

  for (const prop of missingImages) {
    let found = false;
    let imageUrl = '';
    let foundField = '';

    // Try zillow_imports first (by doc ID)
    let doc = await db.collection("zillow_imports").doc(prop.id).get();

    // If not found, try by zpid
    if (!doc.exists && prop.zpid) {
      const byZpid = await db.collection("zillow_imports")
        .where("zpid", "==", parseInt(prop.zpid))
        .limit(1)
        .get();
      if (!byZpid.empty) {
        doc = byZpid.docs[0];
      }
    }

    // Also check cash_houses
    if (!doc.exists) {
      doc = await db.collection("cash_houses").doc(prop.id).get();
    }

    if (doc.exists) {
      const data = doc.data() || {};

      // Check all possible image fields
      for (const field of imageFields) {
        const value = data[field];
        if (value) {
          if (typeof value === 'string' && value.startsWith('http')) {
            found = true;
            imageUrl = value;
            foundField = field;
            break;
          } else if (Array.isArray(value) && value.length > 0) {
            const firstImg = value[0];
            if (typeof firstImg === 'string' && firstImg.startsWith('http')) {
              found = true;
              imageUrl = firstImg;
              foundField = `${field}[0]`;
              break;
            } else if (typeof firstImg === 'object' && firstImg.url) {
              found = true;
              imageUrl = firstImg.url;
              foundField = `${field}[0].url`;
              break;
            }
          }
        }
      }

      // Also check rawData if it exists
      if (!found && data.rawData) {
        for (const field of imageFields) {
          const value = data.rawData[field];
          if (value && typeof value === 'string' && value.startsWith('http')) {
            found = true;
            imageUrl = value;
            foundField = `rawData.${field}`;
            break;
          }
        }
      }

      // Check hiResImageLink
      if (!found && data.hiResImageLink) {
        found = true;
        imageUrl = data.hiResImageLink;
        foundField = 'hiResImageLink';
      }

      // Check desktopWebHdpImageLink
      if (!found && data.desktopWebHdpImageLink) {
        found = true;
        imageUrl = data.desktopWebHdpImageLink;
        foundField = 'desktopWebHdpImageLink';
      }
    }

    if (found) {
      foundCount++;
      foundImages.push({
        id: prop.id,
        address: `${prop.address}, ${prop.city}`,
        field: foundField,
        url: imageUrl
      });
    } else {
      notFoundCount++;
      stillMissing.push({
        id: prop.id,
        address: `${prop.address}, ${prop.city}`,
        zpid: prop.zpid
      });
    }
  }

  console.log('\n=== RESULTS ===');
  console.log(`Found images for: ${foundCount} properties`);
  console.log(`Still missing: ${notFoundCount} properties`);

  if (foundImages.length > 0) {
    console.log('\n--- FOUND IMAGES (first 20) ---');
    for (const item of foundImages.slice(0, 20)) {
      console.log(`\n${item.address}`);
      console.log(`  ID: ${item.id}`);
      console.log(`  Field: ${item.field}`);
      console.log(`  URL: ${item.url.substring(0, 80)}...`);
    }
  }

  if (stillMissing.length > 0) {
    console.log('\n--- STILL MISSING (first 20) ---');
    for (const item of stillMissing.slice(0, 20)) {
      console.log(`${item.address} (ID: ${item.id}, zpid: ${item.zpid || 'N/A'})`);
    }
  }

  // Return data for potential fix
  return { foundImages, stillMissing };
}

main().catch(console.error);
