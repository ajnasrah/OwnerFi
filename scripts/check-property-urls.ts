import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function main() {
  console.log("=== CHECKING PROPERTY URLs ===\n");

  // Get first 20 active properties
  const propertiesSnap = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(20)
    .get();

  console.log(`Found ${propertiesSnap.size} active properties\n`);

  console.log("--- SAMPLE URLs ---");
  propertiesSnap.docs.forEach((doc, i) => {
    const data = doc.data();
    console.log(`${i+1}. ID: ${doc.id}`);
    console.log(`   url: "${data.url}"`);
    console.log(`   zpid: "${data.zpid}"`);
    console.log(`   address: "${data.fullAddress || data.streetAddress || 'N/A'}"`);
    console.log();
  });

  // Count properties with invalid URLs
  const allProps = await db.collection('properties')
    .where('isActive', '==', true)
    .get();

  let noUrl = 0;
  let emptyUrl = 0;
  let relativeUrl = 0;
  let invalidUrl = 0;
  let validUrl = 0;

  allProps.docs.forEach(doc => {
    const data = doc.data();
    const url = data.url;

    if (!url) {
      noUrl++;
    } else if (url === '') {
      emptyUrl++;
    } else if (!url.startsWith('http')) {
      relativeUrl++;
    } else if (!url.includes('zillow.com')) {
      invalidUrl++;
    } else {
      validUrl++;
    }
  });

  console.log("\n--- URL BREAKDOWN ---");
  console.log("Total active properties:", allProps.size);
  console.log("No url field:", noUrl);
  console.log("Empty url:", emptyUrl);
  console.log("Relative url (no http):", relativeUrl);
  console.log("Invalid (no zillow.com):", invalidUrl);
  console.log("Valid Zillow URLs:", validUrl);

  // Show some examples of relative URLs
  console.log("\n--- SAMPLE RELATIVE URLs ---");
  let count = 0;
  allProps.docs.forEach(doc => {
    if (count >= 5) return;
    const data = doc.data();
    const url = data.url;
    if (url && !url.startsWith('http')) {
      console.log(`${++count}. "${url}"`);
    }
  });
}

main().catch(console.error);
