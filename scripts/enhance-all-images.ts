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

function upgradeZillowImageUrl(url: string): string {
  if (!url || !url.includes('zillowstatic.com')) return url;

  const lowResSizes = [
    'p_c.jpg', 'p_e.jpg', 'p_f.jpg', 'p_g.jpg', 'p_h.jpg',
    'cc_ft_192.webp', 'cc_ft_384.webp', 'cc_ft_576.webp', 'cc_ft_768.webp'
  ];

  for (const size of lowResSizes) {
    if (url.includes(size)) {
      return url.replace(size, 'uncropped_scaled_within_1536_1152.webp');
    }
  }

  return url;
}

// All collections that may have property images
const COLLECTIONS = [
  'zillow_imports',
  'cash_houses',
  'properties',
  'property_queue',
  'scraper_queue',
];

async function enhanceCollection(collectionName: string) {
  console.log(`\n📁 Processing ${collectionName}...`);

  const snap = await db.collection(collectionName).get();

  if (snap.empty) {
    console.log(`   Empty collection, skipping`);
    return { total: 0, processed: 0, upgraded: 0, skipped: 0, errors: 0 };
  }

  console.log(`   Total docs: ${snap.size}`);

  let enhanced = 0;
  let skipped = 0;
  let upgraded = 0;
  let errors = 0;

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    // Skip if already enhanced
    if (data.imageEnhanced === true) {
      skipped++;
      continue;
    }

    const updateData: Record<string, any> = {
      imageEnhanced: true,
      imageEnhancedAt: new Date().toISOString()
    };
    let wasUpgraded = false;

    // Check all possible image fields
    const imageFields = ['imgSrc', 'imageUrl', 'firstPropertyImage', 'image', 'thumbnail'];

    for (const field of imageFields) {
      if (data[field] && typeof data[field] === 'string' && data[field].includes('zillowstatic.com')) {
        const newUrl = upgradeZillowImageUrl(data[field]);
        if (newUrl !== data[field]) {
          updateData[field] = newUrl;
          wasUpgraded = true;
        }
      }
    }

    // Upgrade imageUrls array
    if (data.imageUrls && Array.isArray(data.imageUrls)) {
      const upgradedUrls = data.imageUrls.map((url: string) =>
        typeof url === 'string' && url.includes('zillowstatic.com') ? upgradeZillowImageUrl(url) : url
      );
      if (JSON.stringify(upgradedUrls) !== JSON.stringify(data.imageUrls)) {
        updateData.imageUrls = upgradedUrls;
        wasUpgraded = true;
      }
    }

    // Upgrade propertyImages array
    if (data.propertyImages && Array.isArray(data.propertyImages)) {
      const upgradedUrls = data.propertyImages.map((url: string) =>
        typeof url === 'string' && url.includes('zillowstatic.com') ? upgradeZillowImageUrl(url) : url
      );
      if (JSON.stringify(upgradedUrls) !== JSON.stringify(data.propertyImages)) {
        updateData.propertyImages = upgradedUrls;
        wasUpgraded = true;
      }
    }

    // Upgrade images array
    if (data.images && Array.isArray(data.images)) {
      const upgradedUrls = data.images.map((url: string) =>
        typeof url === 'string' && url.includes('zillowstatic.com') ? upgradeZillowImageUrl(url) : url
      );
      if (JSON.stringify(upgradedUrls) !== JSON.stringify(data.images)) {
        updateData.images = upgradedUrls;
        wasUpgraded = true;
      }
    }

    batch.update(doc.ref, updateData);
    batchCount++;
    enhanced++;
    if (wasUpgraded) upgraded++;

    // Commit batch every 500
    if (batchCount >= BATCH_SIZE) {
      try {
        await batch.commit();
        console.log(`   Batch committed: ${enhanced} processed, ${upgraded} upgraded`);
      } catch (e) {
        console.error('   Batch error:', e);
        errors += batchCount;
      }
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    try {
      await batch.commit();
    } catch (e) {
      console.error('   Final batch error:', e);
      errors += batchCount;
    }
  }

  console.log(`   ✅ Processed: ${enhanced}, Upgraded: ${upgraded}, Skipped: ${skipped}`);

  return { total: snap.size, processed: enhanced, upgraded, skipped, errors };
}

async function enhanceAllImages() {
  console.log('=== ENHANCING ALL PROPERTY IMAGES (ALL COLLECTIONS) ===');

  const results: Record<string, any> = {};
  let totalProcessed = 0;
  let totalUpgraded = 0;

  for (const collection of COLLECTIONS) {
    const result = await enhanceCollection(collection);
    results[collection] = result;
    totalProcessed += result.processed;
    totalUpgraded += result.upgraded;
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Total upgraded: ${totalUpgraded}`);

  for (const [name, result] of Object.entries(results)) {
    if (result.total > 0) {
      console.log(`  ${name}: ${result.processed}/${result.total} processed, ${result.upgraded} upgraded`);
    }
  }
}

enhanceAllImages().catch(console.error);
