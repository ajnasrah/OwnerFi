import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function checkImages() {
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

  const lowResPatterns = [
    'p_a.jpg', 'p_b.jpg', 'p_c.jpg', 'p_d.jpg', 'p_e.jpg',
    'cc_ft_192', 'cc_ft_384', 'cc_ft_576', 'cc_ft_768', 'cc_ft_960'
  ];

  // Check cash_houses
  console.log('Checking cash_houses...');
  const cashSnap = await db.collection('cash_houses').get();

  let cashLowRes = 0;
  let cashHighRes = 0;
  let cashNoImage = 0;
  const cashLowResExamples: string[] = [];

  cashSnap.docs.forEach(doc => {
    const d = doc.data();
    const img = d.imgSrc || d.imageUrl || d.image || '';

    if (!img) {
      cashNoImage++;
      return;
    }

    const isLowRes = lowResPatterns.some(p => img.includes(p));

    if (isLowRes) {
      cashLowRes++;
      if (cashLowResExamples.length < 5) {
        cashLowResExamples.push(img);
      }
    } else {
      cashHighRes++;
    }
  });

  console.log('\n=== CASH HOUSES ===');
  console.log(`Total: ${cashSnap.size}`);
  console.log(`High-res: ${cashHighRes}`);
  console.log(`Low-res: ${cashLowRes}`);
  console.log(`No image: ${cashNoImage}`);

  if (cashLowResExamples.length > 0) {
    console.log('\nLow-res examples:');
    cashLowResExamples.forEach(url => console.log('  ' + url.substring(0, 120)));
  }

  // Check zillow_imports
  console.log('\nChecking zillow_imports...');
  const zillowSnap = await db.collection('zillow_imports').get();

  let zillowLowRes = 0;
  let zillowHighRes = 0;
  let zillowNoImage = 0;
  const zillowLowResExamples: string[] = [];

  zillowSnap.docs.forEach(doc => {
    const d = doc.data();
    const img = d.imgSrc || d.imageUrl || d.firstPropertyImage || d.image || '';

    if (!img) {
      zillowNoImage++;
      return;
    }

    const isLowRes = lowResPatterns.some(p => img.includes(p));

    if (isLowRes) {
      zillowLowRes++;
      if (zillowLowResExamples.length < 5) {
        zillowLowResExamples.push(img);
      }
    } else {
      zillowHighRes++;
    }
  });

  console.log('\n=== ZILLOW IMPORTS ===');
  console.log(`Total: ${zillowSnap.size}`);
  console.log(`High-res: ${zillowHighRes}`);
  console.log(`Low-res: ${zillowLowRes}`);
  console.log(`No image: ${zillowNoImage}`);

  if (zillowLowResExamples.length > 0) {
    console.log('\nLow-res examples:');
    zillowLowResExamples.forEach(url => console.log('  ' + url.substring(0, 120)));
  }

  // Summary
  const totalLowRes = cashLowRes + zillowLowRes;
  console.log('\n=== SUMMARY ===');
  console.log(`Total low-res images needing upgrade: ${totalLowRes}`);
}

checkImages().catch(console.error);
