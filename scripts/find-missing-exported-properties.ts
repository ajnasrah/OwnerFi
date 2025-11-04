import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin using environment variables
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

interface CSVProperty {
  'Opportunity Name': string;
  'Property Address': string;
  'Property city': string;
  'State ': string;
  'zip code ': string;
  'stage': string;
  'Opportunity ID': string;
}

function parseCSV(csvContent: string): CSVProperty[] {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const records: CSVProperty[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];

      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());

    const record: any = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    records.push(record as CSVProperty);
  }

  return records;
}

async function findMissingProperties() {
  try {
    // Read CSV file
    const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    // Parse CSV
    const records: CSVProperty[] = parseCSV(csvContent);

    console.log(`📊 Total properties in CSV: ${records.length}`);

    // Filter for "exported to website" stage
    const exportedProperties = records.filter(
      record => record.stage?.toLowerCase() === 'exported to website'
    );

    console.log(`✅ Properties marked as "exported to website": ${exportedProperties.length}`);

    // Get all properties from Firestore
    const propertiesSnapshot = await db.collection('properties').get();
    const firestoreOpportunityIds = new Set<string>();

    propertiesSnapshot.forEach(doc => {
      const data = doc.data();
      // Store by Opportunity ID - this is the primary identifier
      if (data.opportunityId) {
        firestoreOpportunityIds.add(data.opportunityId.trim());
      }
    });

    console.log(`🔥 Properties in Firestore: ${propertiesSnapshot.size}`);
    console.log(`🔥 Properties with Opportunity IDs: ${firestoreOpportunityIds.size}`);

    // Find missing properties
    const missingProperties: CSVProperty[] = [];

    for (const prop of exportedProperties) {
      const oppId = prop['Opportunity ID']?.trim();

      // Skip if no opportunity ID
      if (!oppId) {
        console.log(`⚠️  Skipping property without Opportunity ID: ${prop['Opportunity Name']}`);
        continue;
      }

      // Check if property exists by opportunity ID
      if (!firestoreOpportunityIds.has(oppId)) {
        missingProperties.push(prop);
      }
    }

    console.log(`\n❌ Missing properties (exported but not in website): ${missingProperties.length}\n`);

    // Display missing properties
    missingProperties.forEach((prop, index) => {
      console.log(`\n${index + 1}. ${prop['Opportunity Name']}`);
      console.log(`   Address: ${prop['Property Address']}, ${prop['Property city']}, ${prop['State ']} ${prop['zip code ']}`);
      console.log(`   Opportunity ID: ${prop['Opportunity ID']}`);
      console.log(`   Stage: ${prop.stage}`);
    });

    // Save to JSON file for further analysis
    const outputPath = path.join(__dirname, 'missing-exported-properties.json');
    fs.writeFileSync(outputPath, JSON.stringify(missingProperties, null, 2));
    console.log(`\n📄 Full details saved to: ${outputPath}`);

    return missingProperties;
  } catch (error) {
    console.error('Error finding missing properties:', error);
    throw error;
  }
}

findMissingProperties();
