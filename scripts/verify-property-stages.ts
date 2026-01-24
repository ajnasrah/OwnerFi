import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

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
  contactName: string;
  stage: string;
  firebaseId: string;
  city: string;
  state: string;
}

interface VerificationResult {
  firebaseId: string;
  address: string;
  csvStage: string;
  firebaseStatus: string | null;
  firebaseIsActive: boolean | null;
  existsInFirebase: boolean;
  isCorrect: boolean;
  issue?: string;
}

function parseCSV(csvPath: string): CSVProperty[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const properties: CSVProperty[] = [];

  // Parse header to find column indices
  const header = lines[0];
  const headerCols = parseCSVLine(header);

  const stageIdx = headerCols.findIndex(h => h.toLowerCase() === 'stage');
  const firebaseIdIdx = headerCols.findIndex(h => h.toLowerCase() === 'firebase_id');
  const addressIdx = headerCols.findIndex(h => h.toLowerCase().includes('opportunity name') || h.toLowerCase().includes('property address'));
  const contactIdx = headerCols.findIndex(h => h.toLowerCase().includes('contact name'));
  const cityIdx = headerCols.findIndex(h => h.toLowerCase().includes('property city'));
  const stateIdx = headerCols.findIndex(h => h.toLowerCase().includes('state'));

  console.log(`Column indices - stage: ${stageIdx}, firebase_id: ${firebaseIdIdx}, address: ${addressIdx}`);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const stage = cols[stageIdx]?.trim().toLowerCase() || '';
    const firebaseId = cols[firebaseIdIdx]?.trim() || '';

    // Only include interested and not interested stages
    if ((stage.includes('interested') || stage.includes('not interested')) && firebaseId) {
      properties.push({
        address: cols[addressIdx]?.trim() || '',
        contactName: cols[contactIdx]?.trim() || '',
        stage: stage,
        firebaseId: firebaseId,
        city: cols[cityIdx]?.trim() || '',
        state: cols[stateIdx]?.trim() || ''
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

async function verifyProperty(prop: CSVProperty): Promise<VerificationResult> {
  try {
    const docRef = db.collection('properties').doc(prop.firebaseId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return {
        firebaseId: prop.firebaseId,
        address: prop.address,
        csvStage: prop.stage,
        firebaseStatus: null,
        firebaseIsActive: null,
        existsInFirebase: false,
        isCorrect: false,
        issue: 'Property not found in Firebase'
      };
    }

    const data = doc.data()!;
    const firebaseStatus = data.status || 'unknown';
    const firebaseIsActive = data.isActive ?? null;

    // Determine if status is correct based on CSV stage
    let isCorrect = true;
    let issue: string | undefined;

    // For "interested" properties - they should be active to show in buyer interface
    if (prop.stage.includes('interested') && !prop.stage.includes('not interested')) {
      if (!firebaseIsActive) {
        isCorrect = false;
        issue = `Interested property is not active (isActive: ${firebaseIsActive}, status: ${firebaseStatus})`;
      } else if (firebaseStatus !== 'active') {
        isCorrect = false;
        issue = `Interested property has non-active status: ${firebaseStatus}`;
      }
    }

    // For "not interested" properties - just verify they exist
    // They should still be active in the system (it's just that this particular lead said not interested)

    return {
      firebaseId: prop.firebaseId,
      address: prop.address,
      csvStage: prop.stage,
      firebaseStatus: firebaseStatus,
      firebaseIsActive: firebaseIsActive,
      existsInFirebase: true,
      isCorrect: isCorrect,
      issue: issue
    };
  } catch (error) {
    return {
      firebaseId: prop.firebaseId,
      address: prop.address,
      csvStage: prop.stage,
      firebaseStatus: null,
      firebaseIsActive: null,
      existsInFirebase: false,
      isCorrect: false,
      issue: `Error fetching property: ${error}`
    };
  }
}

async function main() {
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';

  console.log('Parsing CSV file...');
  const properties = parseCSV(csvPath);

  const interestedProps = properties.filter(p => p.stage.includes('interested') && !p.stage.includes('not interested'));
  const notInterestedProps = properties.filter(p => p.stage.includes('not interested'));

  console.log(`\nFound ${properties.length} total properties to verify:`);
  console.log(`  - Interested: ${interestedProps.length}`);
  console.log(`  - Not Interested: ${notInterestedProps.length}`);

  console.log('\n========================================');
  console.log('VERIFYING INTERESTED PROPERTIES');
  console.log('========================================\n');

  const interestedResults: VerificationResult[] = [];
  for (const prop of interestedProps) {
    const result = await verifyProperty(prop);
    interestedResults.push(result);

    const statusIcon = result.isCorrect ? '✓' : '✗';
    console.log(`${statusIcon} ${prop.address} (${prop.city}, ${prop.state})`);
    console.log(`   Firebase ID: ${prop.firebaseId}`);
    console.log(`   Status: ${result.firebaseStatus}, isActive: ${result.firebaseIsActive}`);
    if (result.issue) {
      console.log(`   ISSUE: ${result.issue}`);
    }
    console.log('');
  }

  console.log('\n========================================');
  console.log('VERIFYING NOT INTERESTED PROPERTIES (sampling first 20)');
  console.log('========================================\n');

  const notInterestedSample = notInterestedProps.slice(0, 20);
  const notInterestedResults: VerificationResult[] = [];

  for (const prop of notInterestedSample) {
    const result = await verifyProperty(prop);
    notInterestedResults.push(result);

    const statusIcon = result.existsInFirebase ? '✓' : '✗';
    console.log(`${statusIcon} ${prop.address} (${prop.city}, ${prop.state})`);
    console.log(`   Firebase ID: ${prop.firebaseId}`);
    console.log(`   Exists: ${result.existsInFirebase}, Status: ${result.firebaseStatus}, isActive: ${result.firebaseIsActive}`);
    if (result.issue) {
      console.log(`   ISSUE: ${result.issue}`);
    }
    console.log('');
  }

  // Summary
  console.log('\n========================================');
  console.log('VERIFICATION SUMMARY');
  console.log('========================================\n');

  const interestedCorrect = interestedResults.filter(r => r.isCorrect).length;
  const interestedWithIssues = interestedResults.filter(r => !r.isCorrect);
  const interestedNotFound = interestedResults.filter(r => !r.existsInFirebase);
  const interestedInactive = interestedResults.filter(r => r.existsInFirebase && !r.firebaseIsActive);

  console.log('INTERESTED PROPERTIES:');
  console.log(`  Total: ${interestedResults.length}`);
  console.log(`  Correctly configured (active): ${interestedCorrect}`);
  console.log(`  Not found in Firebase: ${interestedNotFound.length}`);
  console.log(`  Found but inactive: ${interestedInactive.length}`);

  if (interestedWithIssues.length > 0) {
    console.log('\n  Properties with issues:');
    interestedWithIssues.forEach(r => {
      console.log(`    - ${r.address}: ${r.issue}`);
    });
  }

  const notInterestedNotFound = notInterestedResults.filter(r => !r.existsInFirebase);

  console.log('\nNOT INTERESTED PROPERTIES (sampled):');
  console.log(`  Sampled: ${notInterestedResults.length}`);
  console.log(`  Found in Firebase: ${notInterestedResults.filter(r => r.existsInFirebase).length}`);
  console.log(`  Not found: ${notInterestedNotFound.length}`);

  if (notInterestedNotFound.length > 0) {
    console.log('\n  Properties not found:');
    notInterestedNotFound.forEach(r => {
      console.log(`    - ${r.address} (${r.firebaseId})`);
    });
  }

  // Check owner financing keywords on interested properties
  console.log('\n========================================');
  console.log('OWNER FINANCING CHECK ON INTERESTED PROPERTIES');
  console.log('========================================\n');

  for (const result of interestedResults.filter(r => r.existsInFirebase)) {
    const doc = await db.collection('properties').doc(result.firebaseId).get();
    const data = doc.data();
    if (data) {
      const hasOwnerFinanceKeywords = data.matchedKeywords?.length > 0 ||
                                       data.primaryKeyword ||
                                       data.description?.toLowerCase().includes('owner financ');

      console.log(`${result.address}:`);
      console.log(`  matchedKeywords: ${JSON.stringify(data.matchedKeywords || [])}`);
      console.log(`  primaryKeyword: ${data.primaryKeyword || 'none'}`);
      console.log(`  Owner finance in description: ${data.description?.toLowerCase().includes('owner financ') ? 'YES' : 'NO'}`);
      console.log(`  Will show in buyer interface: ${data.isActive && data.status === 'active' ? 'YES' : 'NO'}`);
      console.log('');
    }
  }
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
