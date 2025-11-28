import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

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

async function analyze() {
  // Get properties that are missing ARV
  const snap = await db.collection('zillow_imports')
    .limit(100)
    .get();

  console.log('=== ANALYZING ZILLOW FIELD NAMES ===\n');

  // Collect all unique field names
  const allFields = new Set<string>();
  const arvRelatedFields: Record<string, number> = {};
  const rentRelatedFields: Record<string, number> = {};

  let missingArv = 0;
  let missingRent = 0;

  snap.docs.forEach(doc => {
    const data = doc.data();

    // Collect all fields
    Object.keys(data).forEach(key => allFields.add(key));

    // Check for ARV-related fields
    const hasArv = (data.estimate || 0) > 0 || (data.arv || 0) > 0;
    if (!hasArv) {
      missingArv++;
      // Look for any field that might contain value/estimate/zestimate
      Object.keys(data).forEach(key => {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('value') || keyLower.includes('estimate') ||
            keyLower.includes('zestimate') || keyLower.includes('price') ||
            keyLower.includes('worth') || keyLower.includes('arv')) {
          const val = data[key];
          if (typeof val === 'number' && val > 0) {
            arvRelatedFields[key] = (arvRelatedFields[key] || 0) + 1;
            console.log(`Found potential ARV field: ${key} = ${val} in ${data.streetAddress}`);
          }
        }
      });
    }

    // Check for rent-related fields
    const hasRent = (data.rentEstimate || 0) > 0;
    if (!hasRent) {
      missingRent++;
      Object.keys(data).forEach(key => {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('rent') || keyLower.includes('rental')) {
          const val = data[key];
          if (typeof val === 'number' && val > 0) {
            rentRelatedFields[key] = (rentRelatedFields[key] || 0) + 1;
            console.log(`Found potential rent field: ${key} = ${val} in ${data.streetAddress}`);
          }
        }
      });
    }
  });

  console.log('\n=== SUMMARY ===');
  console.log(`Total analyzed: ${snap.size}`);
  console.log(`Missing ARV: ${missingArv}`);
  console.log(`Missing Rent: ${missingRent}`);

  console.log('\n=== ALL FIELDS IN COLLECTION ===');
  const sortedFields = Array.from(allFields).sort();
  sortedFields.forEach(f => console.log(`  - ${f}`));

  // Sample one property with missing ARV to see all its data
  const missingArvDoc = snap.docs.find(d => {
    const data = d.data();
    return !((data.estimate || 0) > 0 || (data.arv || 0) > 0);
  });

  if (missingArvDoc) {
    console.log('\n=== SAMPLE PROPERTY MISSING ARV ===');
    const data = missingArvDoc.data();
    console.log(`Address: ${data.streetAddress || data.fullAddress}`);
    console.log('All numeric fields:');
    Object.keys(data).forEach(key => {
      if (typeof data[key] === 'number') {
        console.log(`  ${key}: ${data[key]}`);
      }
    });
  }
}

analyze().catch(console.error);
