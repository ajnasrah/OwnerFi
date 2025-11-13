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

async function checkMissingImageProperty() {
  try {
    console.log('🔍 Checking property with missing images...\n');

    const propertyDoc = await db.collection('properties').doc('O0AR0UdSpPhhfcAdNxGQ').get();
    const property = propertyDoc.data();

    console.log('📍 Property Details:');
    console.log('='.repeat(80));
    console.log(`ID: ${propertyDoc.id}`);
    console.log(`Address: ${property?.address}`);
    console.log(`City: ${property?.city}, ${property?.state}`);
    console.log(`ZIP: ${property?.zipCode}`);
    console.log(`Is Active: ${property?.isActive}`);
    console.log('');

    console.log('🖼️  Image Fields:');
    console.log(`imageUrls: ${JSON.stringify(property?.imageUrls)}`);
    console.log(`imageUrl (legacy): ${property?.imageUrl || 'MISSING'}`);
    console.log(`zillowImageUrl: ${property?.zillowImageUrl || 'MISSING'}`);
    console.log('');

    console.log('💰 Property Details:');
    console.log(`List Price: $${property?.listPrice?.toLocaleString() || 'N/A'}`);
    console.log(`Monthly Payment: $${property?.monthlyPayment?.toLocaleString() || 'N/A'}`);
    console.log(`Down Payment: $${property?.downPaymentAmount?.toLocaleString() || 'N/A'}`);
    console.log('');

    console.log('📝 Other Fields:');
    console.log(`Bedrooms: ${property?.bedrooms || 'N/A'}`);
    console.log(`Bathrooms: ${property?.bathrooms || 'N/A'}`);
    console.log(`Square Feet: ${property?.squareFeet?.toLocaleString() || 'N/A'}`);
    console.log(`Description: ${property?.description?.substring(0, 100) || 'N/A'}...`);
    console.log('');

    // Check if we can generate a Google Street View image
    if (property?.address && property?.city && property?.state) {
      const fullAddress = `${property.address}, ${property.city}, ${property.state} ${property.zipCode || ''}`;
      const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(fullAddress)}&key=YOUR_API_KEY`;

      console.log('💡 RECOMMENDATION:');
      console.log('This property has no images. You can:');
      console.log('1. Add a Google Street View image using the address');
      console.log('2. Search for the property on Zillow and import images');
      console.log('3. Mark the property as inactive until images are available');
      console.log('');
      console.log('Street View URL pattern (needs API key):');
      console.log(streetViewUrl);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkMissingImageProperty();
