import * as dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const app = initializeApp({ credential: cert(serviceAccount as any) });
const db = getFirestore(app);

async function testImageUrls() {
  try {
    // Get the Fulton property
    const propertyDoc = await db.collection('properties').doc('feMN1TbH8JR5ENTUV0Se').get();
    const property = propertyDoc.data();

    console.log('🖼️  Testing image URLs for Fulton property...\n');

    const imagesToTest = [
      { name: 'Legacy imageUrl', url: property?.imageUrl },
      ...(property?.imageUrls || []).map((url: string, i: number) => ({
        name: `imageUrls[${i}]`,
        url
      }))
    ];

    for (const image of imagesToTest) {
      if (!image.url) {
        console.log(`❌ ${image.name}: No URL`);
        continue;
      }

      console.log(`Testing ${image.name}:`);
      console.log(`  URL: ${image.url}`);

      try {
        const response = await fetch(image.url, { method: 'HEAD' });
        console.log(`  Status: ${response.status} ${response.statusText}`);
        console.log(`  Content-Type: ${response.headers.get('content-type')}`);
        console.log(`  Result: ${response.ok ? '✅ VALID' : '❌ INVALID'}`);
      } catch (error) {
        console.log(`  Result: ❌ ERROR - ${error}`);
      }

      console.log('');
    }

    // Also check what the frontend would actually use
    console.log('\n📱 Frontend Image Priority:');
    const legacyImageUrl = property?.imageUrl;
    if (legacyImageUrl) {
      console.log(`  First image will be: Legacy imageUrl`);
      console.log(`  URL: ${legacyImageUrl}`);
    } else if (property?.imageUrls?.length > 0) {
      console.log(`  First image will be: imageUrls[0]`);
      console.log(`  URL: ${property.imageUrls[0]}`);
    } else {
      console.log(`  ❌ NO IMAGES AVAILABLE`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testImageUrls();
