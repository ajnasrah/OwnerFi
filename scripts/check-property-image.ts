import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function checkProperty() {
  // Verify the property is now fixed
  const docId = '2nS6tPrSwCA7p77SsArN';
  console.log(`\n=== Verifying property ${docId} ===\n`);

  const doc = await db.collection('zillow_imports').doc(docId).get();
  const data = doc.data()!;

  const lowResPatterns = ['p_a.jpg', 'p_b.jpg', 'p_c.jpg', 'p_d.jpg', 'p_e.jpg', 'p_f.jpg', 'p_g.jpg', 'p_h.jpg', 'cc_ft_192', 'cc_ft_384', 'cc_ft_576', 'cc_ft_768'];

  console.log('Address:', data.address || `${data.city}, ${data.state} ${data.zipCode}`);
  console.log('\n--- Image Status ---');
  console.log('imgSrc:', data.imgSrc?.includes('uncropped_scaled_within') ? '✅ HIGH-RES' : '❌ LOW-RES');
  console.log('firstPropertyImage:', data.firstPropertyImage?.includes('uncropped_scaled_within') ? '✅ HIGH-RES' : '❌ LOW-RES');

  const propertyImages = data.propertyImages || [];
  const lowResCount = propertyImages.filter((url: string) =>
    lowResPatterns.some(p => url.includes(p))
  ).length;

  console.log(`propertyImages: ${propertyImages.length - lowResCount}/${propertyImages.length} HIGH-RES`);

  if (lowResCount === 0) {
    console.log('\n✅ ALL IMAGES ARE NOW HIGH-RES!');
  } else {
    console.log('\n❌ Still has low-res images!');
  }

  console.log('\nSample URLs:');
  console.log('  imgSrc:', data.imgSrc);
  console.log('  propertyImages[0]:', propertyImages[0]);
}

checkProperty();
