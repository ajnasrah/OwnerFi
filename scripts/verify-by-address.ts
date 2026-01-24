import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

interface CSVProperty {
  address: string;
  city: string;
  state: string;
  stage: string;
  firebaseId: string;
}

function parseCSV(csvPath: string): CSVProperty[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const properties: CSVProperty[] = [];

  const headerCols = parseCSVLine(lines[0]);
  const stageIdx = headerCols.findIndex(h => h.toLowerCase() === 'stage');
  const firebaseIdIdx = headerCols.findIndex(h => h.toLowerCase() === 'firebase_id');
  const addressIdx = 0; // Opportunity Name
  const cityIdx = headerCols.findIndex(h => h.toLowerCase().includes('property city'));
  const stateIdx = headerCols.findIndex(h => h.toLowerCase().includes('state'));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const stage = cols[stageIdx]?.trim().toLowerCase() || '';
    const firebaseId = cols[firebaseIdIdx]?.trim() || '';

    if (stage.includes('interested') && !stage.includes('not interested')) {
      properties.push({
        address: cols[addressIdx]?.trim() || '',
        city: cols[cityIdx]?.trim() || '',
        state: cols[stateIdx]?.trim() || '',
        stage: stage,
        firebaseId: firebaseId
      });
    }
  }

  return properties;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[#,.']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(apt|unit|ste|suite|#)\s*\d*\s*/gi, '')
    .replace(/\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|cir|circle|pl|place|way)\b/gi, '')
    .trim();
}

async function findPropertyByAddress(address: string, city: string, state: string): Promise<any | null> {
  // Normalize inputs
  const normalizedAddr = normalizeAddress(address);
  const normalizedCity = city.toLowerCase().trim();
  const normalizedState = state.toUpperCase().trim();

  // Try exact city/state match first
  const snapshot = await db.collection('properties')
    .where('city', '>=', city.charAt(0).toUpperCase())
    .where('city', '<=', city.charAt(0).toUpperCase() + '\uf8ff')
    .limit(500)
    .get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const docAddr = normalizeAddress(data.address || data.streetAddress || '');
    const docCity = (data.city || '').toLowerCase().trim();
    const docState = (data.state || '').toUpperCase().trim();

    // Check if addresses are similar
    if (docCity === normalizedCity &&
        (docState === normalizedState || !normalizedState || !docState)) {
      // Check address similarity
      if (docAddr.includes(normalizedAddr) || normalizedAddr.includes(docAddr)) {
        return { id: doc.id, ...data };
      }
      // Check if street number matches
      const csvStreetNum = normalizedAddr.match(/^\d+/)?.[0];
      const docStreetNum = docAddr.match(/^\d+/)?.[0];
      if (csvStreetNum && docStreetNum && csvStreetNum === docStreetNum) {
        const csvStreetName = normalizedAddr.replace(/^\d+\s*/, '').split(' ')[0];
        const docStreetName = docAddr.replace(/^\d+\s*/, '').split(' ')[0];
        if (csvStreetName === docStreetName) {
          return { id: doc.id, ...data };
        }
      }
    }
  }

  return null;
}

async function main() {
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';

  console.log('Parsing CSV for Interested properties...');
  const interestedProps = parseCSV(csvPath);
  console.log(`Found ${interestedProps.length} Interested properties in CSV\n`);

  console.log('========================================');
  console.log('SEARCHING FOR INTERESTED PROPERTIES BY ADDRESS');
  console.log('========================================\n');

  let foundCount = 0;
  let notFoundCount = 0;
  const foundProperties: any[] = [];
  const notFoundProperties: any[] = [];

  for (const prop of interestedProps) {
    console.log(`Searching: ${prop.address} (${prop.city}, ${prop.state})`);

    const found = await findPropertyByAddress(prop.address, prop.city, prop.state);

    if (found) {
      foundCount++;
      foundProperties.push({ csv: prop, firebase: found });
      console.log(`  ✓ FOUND: ${found.id}`);
      console.log(`    Firebase Address: ${found.address || found.streetAddress}`);
      console.log(`    Status: ${found.status}, isActive: ${found.isActive}`);
    } else {
      notFoundCount++;
      notFoundProperties.push(prop);
      console.log(`  ✗ NOT FOUND in Firebase`);
    }
    console.log('');
  }

  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================\n');

  console.log(`Total Interested properties in CSV: ${interestedProps.length}`);
  console.log(`Found in Firebase by address: ${foundCount}`);
  console.log(`Not found in Firebase: ${notFoundCount}`);

  if (foundProperties.length > 0) {
    console.log('\n--- FOUND PROPERTIES (showing in buyer interface?) ---');
    for (const p of foundProperties) {
      const showsInInterface = p.firebase.isActive && p.firebase.status === 'active';
      console.log(`${showsInInterface ? '✓' : '✗'} ${p.csv.address}`);
      console.log(`  Firebase ID: ${p.firebase.id}`);
      console.log(`  isActive: ${p.firebase.isActive}, status: ${p.firebase.status}`);
      console.log(`  Will show in buyer interface: ${showsInInterface ? 'YES' : 'NO'}`);
      console.log('');
    }
  }

  if (notFoundProperties.length > 0) {
    console.log('\n--- NOT FOUND IN FIREBASE (need to be added) ---');
    for (const p of notFoundProperties.slice(0, 10)) {
      console.log(`- ${p.address} (${p.city}, ${p.state})`);
      console.log(`  CSV firebase_id: ${p.firebaseId}`);
    }
    if (notFoundProperties.length > 10) {
      console.log(`  ... and ${notFoundProperties.length - 10} more`);
    }
  }

  // Check total active owner finance properties in Firebase
  console.log('\n========================================');
  console.log('FIREBASE OWNER FINANCE PROPERTIES SUMMARY');
  console.log('========================================\n');

  const activeSnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .count()
    .get();

  console.log(`Total active properties in Firebase: ${activeSnapshot.data().count}`);

  // Check properties in Memphis/Little Rock areas (where CSV properties are)
  const memphisSnapshot = await db.collection('properties')
    .where('city', '==', 'Memphis')
    .where('isActive', '==', true)
    .count()
    .get();

  const littleRockSnapshot = await db.collection('properties')
    .where('city', '==', 'Little Rock')
    .where('isActive', '==', true)
    .count()
    .get();

  console.log(`Active properties in Memphis: ${memphisSnapshot.data().count}`);
  console.log(`Active properties in Little Rock: ${littleRockSnapshot.data().count}`);
}

main()
  .then(() => {
    console.log('\nVerification complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
