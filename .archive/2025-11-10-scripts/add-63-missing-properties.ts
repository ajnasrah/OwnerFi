import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

const MISSING_PROPERTY_IDS = [
  '3UkFKDwjcnzChe75SdHc',
  '3WC0zwoOcUFeYwr7mQQc',
  '3rUjL5EA0vOFvyS7jr04',
  '4hw7GGrOdJgCIPufF1A0',
  '6Nnqj5zTgjav9zCn6FV5',
  '8nnESlkxY4KSE7cgJV3f',
  '8y9c85XVNw2bHhfhcbFo',
  '9VUmJyE1ytYYEc5amLHR',
  'A5v9JXTMfuHS8qEVNNWN',
  'B9v5GsjUMcjLFu9wOJZF',
  'BXdw4RDncJYJTycNJ0OL',
  'C0nvLY3ztOQyNa5zTXN9',
  'C1IAcgvPvfCPq8YA2fDf',
  'CEzN5eyl67NuHlwZxDyQ',
  'CZFckTKaoWQlObq5PmYW',
  'EBiYyiHeEztrlBtF9xWC',
  'FFx2u5YpRekgHxOxCisw',
  'LU6ST07Zxbm1UMyMif1K',
  'LbRa3aL80MWxR6IBQW8m',
  'MC4VUrSGlcgrIftJYkw6',
  'MKc05IoO8SAMRMmLAuNk',
  'MtAFWInNZwI0ZmAaeBZ9',
  'Mx7zgmreq2eNnO1c5fB5',
  'N1pwdRzxUyjhrAwcREWR',
  'NXosZFbcBLu52cmT4v4p',
  'PRjeeJuZBao4HFgbERqo',
  'PoMY26zeSlrI5eHtg7x0',
  'PvrKJPh9zY3nlIGSsLuy',
  'Qwa1V8QIyxlvuZ8gjwvW',
  'R3t3zrPDV8Jo4L5ASkIU',
  'RW56JKTZf8zG0cUoxrGP',
  'S3iRb6xjeqTU7UDyvgqS',
  'UaekLsuROwWz3NQweMBi',
  'UrGNpHrSrbppv3mNOwVY',
  'X4An0vm3MU6FeUTqZKdO',
  'Y7QwhpOzksqhk0QAt0dC',
  'aY5NayLNY6rIPHddJ3o7',
  'az7KnuTCfZoJgpichuG9',
  'bbuciRFBH7oTyEOMC3wB',
  'cdblRW7XGYeLHm7B9uaG',
  'dOb1q5igAJIta327GzaH',
  'fA78AOKol2vmZruzdWK2',
  'gYKm1QOArTsiwoqWz30J',
  'ge202u3y4Pqinr2ZDH6N',
  'hmo75vX8EKTYKgaiWvhl',
  'iBmaEDcZpNGDolkiKkbp',
  'mT1a3NbMTl3u6tdGtjtp',
  'mkz8bQzeztNqUAYX7mD5',
  'nNgpv4yBbaxdrzyh5c86',
  'o7yjrrtBG5eBWa6cUrVF',
  'oDkn8si7iRuKGOYiSjf0',
  'pWRgLkuD5sg0JTBxFVYx',
  'poPv6VzgKpSNrezUzek8',
  'pvo2kPZVAwMFisfL9lR7',
  'sWCZ6nSSyvi3XwcZ0q4f',
  'telPWOiPw5qvOYOpmKoM',
  'uXRMZ8aADBYnlMd1q4po',
  'vN2SmLoPPDUVfcXltmwl',
  'vjwP7ODxjP8OibXoBY40',
  'vw7FRAILFdMIbmMgpKCS',
  'xOna5klK0Ch7p132rn4Q',
  'xaiw14QOXXfa0wQWKOXF',
  'y6Jl1GJGBPXMawUlU9eP'
];

async function addMissingToQueue() {
  console.log(`🎥 Adding ${MISSING_PROPERTY_IDS.length} missing properties to rotation queue...\n`);

  let success = 0;
  let failed = 0;
  let alreadyInQueue = 0;

  for (const propertyId of MISSING_PROPERTY_IDS) {
    try {
      // Check if already in queue
      const queueCheck = await db.collection('property_rotation_queue')
        .where('propertyId', '==', propertyId)
        .limit(1)
        .get();

      if (!queueCheck.empty) {
        const prop = await db.collection('properties').doc(propertyId).get();
        const address = prop.data()?.address || propertyId;
        console.log(`⏭️  ${address} (already in queue)`);
        alreadyInQueue++;
        continue;
      }

      // Get property data
      const propertyDoc = await db.collection('properties').doc(propertyId).get();

      if (!propertyDoc.exists) {
        console.log(`❌ ${propertyId}: Property not found`);
        failed++;
        continue;
      }

      const property = propertyDoc.data();

      if (!property?.isActive || property?.status !== 'active') {
        console.log(`⏭️  ${property?.address || propertyId} (not active)`);
        failed++;
        continue;
      }

      if (!property?.imageUrls || property.imageUrls.length === 0) {
        console.log(`⏭️  ${property?.address || propertyId} (no images)`);
        failed++;
        continue;
      }

      // Add to rotation queue
      await db.collection('property_rotation_queue').add({
        propertyId: propertyId,
        address: property.address,
        city: property.city,
        state: property.state,
        price: property.price || property.listPrice || 0,
        imageUrls: property.imageUrls,
        addedAt: new Date(),
        priority: property.priority || 1,
        lastPosted: null,
        postCount: 0
      });

      console.log(`✅ ${property.address}`);
      success++;

    } catch (error: any) {
      console.log(`❌ ${propertyId}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`✅ Successfully added: ${success}`);
  console.log(`⏭️  Already in queue: ${alreadyInQueue}`);
  console.log(`❌ Failed: ${failed}`);
}

addMissingToQueue()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
