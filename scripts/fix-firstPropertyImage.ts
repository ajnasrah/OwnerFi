/**
 * Fix low-res firstPropertyImage URLs in zillow_imports
 * These are showing in the buyers dashboard as blurry images
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function upgradeZillowImageUrl(url: string): string {
  if (!url || !url.includes('zillowstatic.com')) return url;

  const lowResSizes = [
    'p_a.jpg', 'p_b.jpg', 'p_c.jpg', 'p_d.jpg', 'p_e.jpg', 'p_f.jpg', 'p_g.jpg', 'p_h.jpg',
    'cc_ft_192.webp', 'cc_ft_384.webp', 'cc_ft_576.webp', 'cc_ft_768.webp', 'cc_ft_960.webp', 'cc_ft_1344.webp', 'cc_ft_1536.webp',
    'cc_ft_192.jpg', 'cc_ft_384.jpg', 'cc_ft_576.jpg', 'cc_ft_768.jpg', 'cc_ft_960.jpg', 'cc_ft_1344.jpg', 'cc_ft_1536.jpg'
  ];

  for (const size of lowResSizes) {
    if (url.includes(size)) {
      return url.replace(size, 'uncropped_scaled_within_1536_1152.webp');
    }
  }

  return url;
}

async function fixFirstPropertyImage() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  const db = getFirestore();

  console.log('Fetching zillow_imports with low-res firstPropertyImage...');
  const snap = await db.collection('zillow_imports').get();

  const lowResPatterns = [
    'p_a.jpg', 'p_b.jpg', 'p_c.jpg', 'p_d.jpg', 'p_e.jpg', 'p_f.jpg', 'p_g.jpg', 'p_h.jpg',
    'cc_ft_192', 'cc_ft_384', 'cc_ft_576', 'cc_ft_768', 'cc_ft_960'
  ];

  const toFix = snap.docs.filter(doc => {
    const d = doc.data();
    const img = d.firstPropertyImage || '';
    return lowResPatterns.some(p => img.includes(p));
  });

  console.log(`Found ${toFix.length} properties with low-res firstPropertyImage\n`);

  // Process in batches of 500 (Firestore limit)
  const BATCH_SIZE = 500;
  let fixed = 0;
  let errors = 0;

  for (let i = 0; i < toFix.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toFix.slice(i, i + BATCH_SIZE);

    for (const doc of chunk) {
      const d = doc.data();
      const oldUrl = d.firstPropertyImage;
      const newUrl = upgradeZillowImageUrl(oldUrl);

      if (newUrl !== oldUrl) {
        batch.update(doc.ref, {
          firstPropertyImage: newUrl,
          updatedAt: new Date().toISOString()
        });
        fixed++;
      }
    }

    try {
      await batch.commit();
      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Fixed ${chunk.length} images`);
    } catch (e: any) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, e.message);
      errors += chunk.length;
    }
  }

  console.log('\n========================================');
  console.log(`Fixed: ${fixed} images upgraded to high-res`);
  console.log(`Errors: ${errors}`);
  console.log('========================================');
}

fixFirstPropertyImage().catch(console.error);
