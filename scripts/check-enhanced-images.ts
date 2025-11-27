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

async function checkEnhancedImages() {
  console.log('=== CHECKING PROPERTY IMAGE ENHANCEMENT STATUS ===\n');

  const snap = await db.collection('zillow_imports').get();

  let total = 0;
  let enhanced = 0;
  let notEnhanced = 0;
  let noImages = 0;

  snap.docs.forEach(doc => {
    const d = doc.data();
    total++;

    const hasImages = d.propertyImages?.length > 0 || d.imageUrl || d.imageUrls?.length > 0 || d.firstPropertyImage;

    if (d.imageEnhanced === true) {
      enhanced++;
    } else if (!hasImages) {
      noImages++;
    } else {
      notEnhanced++;
    }
  });

  console.log(`Total properties: ${total}`);
  console.log(`Enhanced (imageEnhanced=true): ${enhanced}`);
  console.log(`Not enhanced (have images): ${notEnhanced}`);
  console.log(`No images at all: ${noImages}`);
  console.log(`\nEnhancement progress: ${((enhanced / (enhanced + notEnhanced)) * 100).toFixed(1)}% of properties with images`);
}

checkEnhancedImages();
