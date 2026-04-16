import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function main() {
  // Search Hernando, MS for Vinson
  const snap = await db.collection('properties')
    .where('city', '==', 'Hernando')
    .where('state', '==', 'MS')
    .get();

  console.log(`Found ${snap.size} Hernando, MS properties`);

  for (const doc of snap.docs) {
    const d = doc.data();
    const addr = (d.address || d.streetAddress || '').toLowerCase();
    if (addr.includes('vinson')) {
      console.log('\n=== MATCH ===');
      console.log('Doc ID:', doc.id);
      console.log('Address:', d.address || d.streetAddress);
      console.log('City/State/Zip:', d.city, d.state, d.zipCode);
      console.log('zpid:', d.zpid);
      console.log('price:', d.price);
      console.log('listPrice:', d.listPrice);
      console.log('estimate (Zestimate):', d.estimate);
      console.log('zestimate:', d.zestimate);
      console.log('homeValue:', d.homeValue);
      console.log('arv:', d.arv);
      console.log('eightyPercentOfZestimate:', d.eightyPercentOfZestimate);
      console.log('rentEstimate:', d.rentEstimate);
      console.log('homeType:', d.homeType);
      console.log('isLand:', d.isLand);
      console.log('lotSquareFoot:', d.lotSquareFoot);
      console.log('squareFoot:', d.squareFoot);
      console.log('bedrooms:', d.bedrooms);
      console.log('bathrooms:', d.bathrooms);
      console.log('homeStatus:', d.homeStatus);
      console.log('hdpUrl:', d.hdpUrl);
      console.log('url:', d.url);
      console.log('lastScrapedAt:', d.lastScrapedAt?.toDate?.() || d.lastScrapedAt);
      console.log('createdAt:', d.createdAt?.toDate?.() || d.createdAt);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
