import { config } from 'dotenv';
import { getAdminDb } from '../src/lib/firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

async function checkTNCities() {
  const db = await getAdminDb() as Firestore | null;

  if (!db) {
    console.error('Failed to connect');
    process.exit(1);
  }

  const propertiesSnapshot = await db.collection('properties').get();
  const allProperties = propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Get all TN properties
  const tnProperties = allProperties.filter((p: any) => p.state === 'TN');

  console.log('Properties in Tennessee:\n');
  console.log('Total TN properties:', tnProperties.length);
  console.log('\nCities breakdown:');

  const citiesCount: Record<string, number> = {};
  tnProperties.forEach((p: any) => {
    const city = p.city?.split(',')[0].trim() || 'Unknown';
    citiesCount[city] = (citiesCount[city] || 0) + 1;
  });

  Object.entries(citiesCount)
    .sort(([, a], [, b]) => b - a)
    .forEach(([city, count]) => {
      console.log(`  ${city}: ${count} properties`);
    });

  process.exit(0);
}

checkTNCities().catch(console.error);
