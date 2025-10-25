import { config } from 'dotenv';
import { getAdminDb } from '../src/lib/firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

async function checkNearbyCityProperties() {
  const db = await getAdminDb() as Firestore | null;

  if (!db) {
    console.error('Failed to connect');
    process.exit(1);
  }

  const nearbyCities = ['bartlett', 'germantown', 'collierville', 'cordova', 'lakeland'];

  console.log('Checking properties in Memphis nearby cities:\n');

  const propertiesSnapshot = await db.collection('properties').get();
  const allProperties = propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  nearbyCities.forEach(city => {
    const props = allProperties.filter((p: any) =>
      p.city?.toLowerCase().includes(city) && p.state === 'TN'
    );

    if (props.length > 0) {
      console.log(`${city.toUpperCase()}: ${props.length} properties`);
      props.forEach((p: any) => {
        console.log(`  - ${p.address}, Monthly: $${p.monthlyPayment || 'N/A'}, Down: $${p.downPaymentAmount || 'N/A'}`);
      });
    } else {
      console.log(`${city.toUpperCase()}: No properties`);
    }
  });

  process.exit(0);
}

checkNearbyCityProperties().catch(console.error);
