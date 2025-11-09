import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function exportMissingProperties() {
  console.log('🔍 Finding properties in GHL but NOT in Firestore...\n');

  // Read GHL CSV
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const ghlRecords = csv.parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  // Get Firestore properties
  const propertiesSnapshot = await getDocs(collection(db, 'properties'));
  const firestoreAddresses = new Set(
    propertiesSnapshot.docs
      .map(doc => doc.data().address?.trim().toLowerCase())
      .filter(addr => addr && addr !== '')
  );

  // Find missing properties
  const missingProperties = ghlRecords.filter((r: any) => {
    const addr = r['Property Address']?.trim().toLowerCase();
    return addr && addr !== '' && !firestoreAddresses.has(addr);
  });

  console.log(`Found ${missingProperties.length} properties in GHL but NOT in Firestore\n`);

  // Group by stage
  const byStage: Record<string, any[]> = {};
  missingProperties.forEach((prop: any) => {
    const stage = prop['stage'] || 'unknown';
    if (!byStage[stage]) byStage[stage] = [];
    byStage[stage].push(prop);
  });

  console.log('📊 Breakdown by stage:');
  Object.entries(byStage)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([stage, props]) => {
      console.log(`   ${stage}: ${props.length} properties`);
    });

  // Export to CSV
  const outputPath = '/Users/abdullahabunasrah/Downloads/missing-properties-from-firestore.csv';
  const headers = [
    'Property Address',
    'Property city',
    'State',
    'zip code',
    'Price',
    'stage',
    'Opportunity ID',
    'Contact Name',
    'phone',
    'bedrooms',
    'bathrooms',
    'livingArea',
    'homeType',
    'description'
  ];

  const csvRows = [headers.join(',')];

  missingProperties.forEach((prop: any) => {
    const row = headers.map(h => {
      const value = prop[h] || '';
      // Escape commas and quotes in CSV
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(row.join(','));
  });

  fs.writeFileSync(outputPath, csvRows.join('\n'));
  console.log(`\n✅ Exported to: ${outputPath}`);

  // Also analyze why they might be missing
  console.log(`\n\n🔍 Analysis:`);

  // Check stages
  const exportedToWebsite = missingProperties.filter((p: any) => p['stage'] === 'exported to website');
  const available = missingProperties.filter((p: any) => p['stage']?.includes('available'));
  const newStage = missingProperties.filter((p: any) => p['stage'] === 'New');
  const pending = missingProperties.filter((p: any) => p['stage'] === 'pending');
  const notAvailable = missingProperties.filter((p: any) => p['stage'] === 'not available');

  console.log(`\n📍 By Stage:`);
  console.log(`   "exported to website": ${exportedToWebsite.length}`);
  console.log(`   "available": ${available.length}`);
  console.log(`   "New": ${newStage.length}`);
  console.log(`   "pending": ${pending.length}`);
  console.log(`   "not available": ${notAvailable.length}`);

  console.log(`\n💡 Likely Reasons:`);
  console.log(`   1. Properties marked "not available" may have been filtered out`);
  console.log(`   2. Properties in "New" stage haven't been synced yet`);
  console.log(`   3. Properties in "pending" might be in a transition state`);
  console.log(`   4. Some properties marked "exported to website" but never actually exported`);

  // Show a few examples
  console.log(`\n\n📋 Sample Missing Properties:\n`);
  missingProperties.slice(0, 10).forEach((prop: any, i: number) => {
    console.log(`${i + 1}. ${prop['Property Address']}, ${prop['Property city']}, ${prop['State ']}`);
    console.log(`   Stage: ${prop['stage']}`);
    console.log(`   Price: $${prop['Price ']}`);
    console.log(`   GHL ID: ${prop['Opportunity ID']}\n`);
  });
}

exportMissingProperties().then(() => {
  console.log('✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
