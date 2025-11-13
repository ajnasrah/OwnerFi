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

async function checkFultonProperties() {
  try {
    console.log('🔍 Searching for Fulton properties...\n');

    // Search for properties with "Fulton" in the address
    const propertiesRef = db.collection('properties');
    const snapshot = await propertiesRef
      .where('address', '>=', '2403')
      .where('address', '<=', '2412')
      .get();

    console.log(`Found ${snapshot.size} properties in address range\n`);

    if (snapshot.empty) {
      console.log('❌ No properties found in this range');

      // Try a broader search
      console.log('\n🔍 Trying broader search for "Fulton"...\n');
      const allPropertiesSnapshot = await propertiesRef.get();

      const fultonProperties = allPropertiesSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.address && data.address.toLowerCase().includes('fulton');
      });

      console.log(`Found ${fultonProperties.length} properties with "Fulton" in address\n`);

      fultonProperties.forEach(doc => {
        const data = doc.data();
        console.log(`📍 Property ID: ${doc.id}`);
        console.log(`   Address: ${data.address}`);
        console.log(`   City: ${data.city || 'N/A'}, State: ${data.state || 'N/A'}`);
        console.log(`   Image URLs: ${JSON.stringify(data.imageUrls || [])}`);
        console.log(`   Legacy imageUrl: ${data.imageUrl || 'N/A'}`);
        console.log(`   Zillow Image URL: ${data.zillowImageUrl || 'N/A'}`);
        console.log(`   Is Active: ${data.isActive}`);
        console.log(`   Monthly Payment: $${data.monthlyPayment || 'N/A'}`);
        console.log(`   Down Payment: $${data.downPaymentAmount || 'N/A'}`);
        console.log('---\n');
      });

      return;
    }

    // Check each property for images
    snapshot.forEach(doc => {
      const data = doc.data();
      const address = data.address || 'Unknown';

      if (address.includes('Fulton') || address.includes('2403') || address.includes('2409') || address.includes('2411')) {
        console.log(`📍 Property ID: ${doc.id}`);
        console.log(`   Address: ${address}`);
        console.log(`   City: ${data.city || 'N/A'}, State: ${data.state || 'N/A'}`);
        console.log(`   Image URLs Array: ${JSON.stringify(data.imageUrls || [])}`);
        console.log(`   Legacy imageUrl: ${data.imageUrl || 'N/A'}`);
        console.log(`   Zillow Image URL: ${data.zillowImageUrl || 'N/A'}`);
        console.log(`   Is Active: ${data.isActive}`);
        console.log(`   Monthly Payment: $${data.monthlyPayment || 'N/A'}`);
        console.log(`   Down Payment: $${data.downPaymentAmount || 'N/A'}`);

        // Check if images exist
        const hasImages = (data.imageUrls && data.imageUrls.length > 0) || data.imageUrl || data.zillowImageUrl;
        console.log(`   Has Images: ${hasImages ? '✅ YES' : '❌ NO'}`);

        if (!hasImages) {
          console.log('   ⚠️  NO IMAGES FOUND - This is why you can\'t see pictures!');
        }

        console.log('---\n');
      }
    });

    console.log('\n✅ Search complete');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkFultonProperties();
