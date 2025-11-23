/**
 * Check how images are stored for "1701 Harrison" property
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase credentials');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function checkHarrisonImages() {
  console.log('\n🔍 Searching for "1701 Harrison" properties...\n');

  try {
    // Search in properties collection
    console.log('Checking properties collection...');
    const propertiesSnapshot = await db.collection('properties')
      .where('address', '>=', '1701 Harrison')
      .where('address', '<=', '1701 Harrison' + '\uf8ff')
      .get();

    if (!propertiesSnapshot.empty) {
      propertiesSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        console.log('\n✅ Found in properties:');
        console.log('  ID:', doc.id);
        console.log('  Address:', data.address);
        console.log('  City:', data.city);
        console.log('  State:', data.state);
        console.log('\n  📸 Image fields:');
        console.log('    imageUrl:', data.imageUrl || 'NOT SET');
        console.log('    imageUrls:', data.imageUrls || 'NOT SET');
        console.log('    zillowImageUrl:', data.zillowImageUrl || 'NOT SET');
        console.log('    firstPropertyImage:', data.firstPropertyImage || 'NOT SET');
        console.log('    propertyImages:', data.propertyImages || 'NOT SET');
        console.log('\n  🗂️  All fields:');
        console.log(JSON.stringify(data, null, 2));
      });
    } else {
      console.log('  ❌ Not found in properties');
    }

    // Search in zillow_imports collection
    console.log('\n\nChecking zillow_imports collection...');
    const zillowSnapshot = await db.collection('zillow_imports')
      .where('fullAddress', '>=', '1701 Harrison')
      .where('fullAddress', '<=', '1701 Harrison' + '\uf8ff')
      .get();

    if (!zillowSnapshot.empty) {
      zillowSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        console.log('\n✅ Found in zillow_imports:');
        console.log('  ID:', doc.id);
        console.log('  Address:', data.fullAddress || data.address);
        console.log('  City:', data.city);
        console.log('  State:', data.state);
        console.log('\n  📸 Image fields:');
        console.log('    imageUrl:', data.imageUrl || 'NOT SET');
        console.log('    imageUrls:', data.imageUrls || 'NOT SET');
        console.log('    firstPropertyImage:', data.firstPropertyImage || 'NOT SET');
        console.log('    propertyImages:', data.propertyImages || 'NOT SET');
        console.log('    zillowImageUrl:', data.zillowImageUrl || 'NOT SET');
        console.log('    images:', data.images || 'NOT SET');
        console.log('\n  🗂️  All fields:');
        console.log(JSON.stringify(data, null, 2));
      });
    } else {
      console.log('  ❌ Not found in zillow_imports');
    }

    // Also try searching by partial address
    console.log('\n\nSearching all properties containing "Harrison"...');
    const allPropsSnapshot = await db.collection('properties').get();
    const harrisonProps = allPropsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.address && data.address.includes('Harrison');
    });

    console.log(`\nFound ${harrisonProps.length} properties with "Harrison" in address:`);
    harrisonProps.forEach(doc => {
      const data = doc.data();
      console.log(`\n  - ${data.address} (${data.city}, ${data.state})`);
      console.log(`    ID: ${doc.id}`);
      console.log(`    imageUrl: ${data.imageUrl || 'NOT SET'}`);
      console.log(`    imageUrls: ${data.imageUrls ? `[${data.imageUrls.length} images]` : 'NOT SET'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkHarrisonImages()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
