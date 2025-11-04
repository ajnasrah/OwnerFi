import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('Missing Firebase credentials in environment variables');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = getFirestore(app);

// Helper function to normalize addresses for comparison
function normalizeAddress(address: string): string {
  if (!address) return '';
  return address
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

// Helper function to parse CSV
function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // Simple CSV parsing (handles basic cases)
    const values = [];
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
    values.push(currentValue.trim()); // Add last value

    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }

  return data;
}

async function findMissingProperties() {
  console.log('🔍 Finding properties sent to GHL webhook but missing in GHL...\n');

  try {
    // Read GHL CSV export
    const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities-2.csv';
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found:', csvPath);
      process.exit(1);
    }

    console.log('📄 Reading GHL CSV export...');
    const ghlData = parseCSV(csvPath);
    console.log(`   Found ${ghlData.length} opportunities in GHL\n`);

    // Create lookup map of GHL properties by normalized address
    const ghlAddresses = new Map<string, any>();
    const ghlZpids = new Set<string>();

    ghlData.forEach(row => {
      const address = row['Property Address'] || row['Opportunity Name'] || '';
      const normalizedAddr = normalizeAddress(address);
      if (normalizedAddr) {
        ghlAddresses.set(normalizedAddr, row);
      }

      // Try to extract ZPID from source URL
      const sourceUrl = row['source'] || '';
      const zpidMatch = sourceUrl.match(/\/(\d+)_zpid/);
      if (zpidMatch) {
        ghlZpids.add(zpidMatch[1]);
      }
    });

    console.log(`   Indexed ${ghlAddresses.size} unique addresses from GHL`);
    console.log(`   Indexed ${ghlZpids.size} ZPIDs from GHL\n`);

    // Get all properties from Firebase that were sent to GHL
    console.log('📦 Fetching properties from Firebase...');
    const snapshot = await db.collection('zillow_imports')
      .where('sentToGHL', '==', true)
      .get();

    console.log(`   Found ${snapshot.size} properties marked as sent to GHL\n`);

    // Find properties that are in Firebase but not in GHL
    const missingProperties = [];
    const foundProperties = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const firebaseAddr = normalizeAddress(data.fullAddress || data.streetAddress || '');
      const zpid = data.zpid ? String(data.zpid) : '';

      // Check if property exists in GHL by address OR ZPID
      let foundInGHL = false;

      if (firebaseAddr && ghlAddresses.has(firebaseAddr)) {
        foundInGHL = true;
      } else if (zpid && ghlZpids.has(zpid)) {
        foundInGHL = true;
      }

      if (foundInGHL) {
        foundProperties.push({
          firebaseId: doc.id,
          address: data.fullAddress,
          zpid: data.zpid,
          sentAt: data.ghlSentAt?.toDate?.() || data.ghlSentAt,
        });
      } else {
        missingProperties.push({
          firebaseId: doc.id,
          address: data.fullAddress,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          zpid: data.zpid,
          price: data.price,
          agentPhone: data.agentPhoneNumber,
          brokerPhone: data.brokerPhoneNumber,
          sentAt: data.ghlSentAt?.toDate?.() || data.ghlSentAt,
          sentStatus: data.ghlSendStatus,
          sentError: data.ghlSendError,
          url: data.url || data.hdpUrl,
        });
      }
    });

    // Print results
    console.log('📊 ANALYSIS RESULTS');
    console.log('='.repeat(80));
    console.log(`\n✅ Properties successfully in GHL:     ${foundProperties.length}`);
    console.log(`❌ Properties MISSING from GHL:        ${missingProperties.length}`);
    console.log(`📤 Total sent via webhook:             ${snapshot.size}`);
    console.log(`📉 Success rate:                        ${((foundProperties.length / snapshot.size) * 100).toFixed(1)}%`);

    if (missingProperties.length > 0) {
      console.log(`\n\n⚠️  MISSING PROPERTIES (Sent but not in GHL)`);
      console.log('='.repeat(80));

      missingProperties.forEach((prop, index) => {
        console.log(`\n${index + 1}. ${prop.address}`);
        console.log(`   City/State: ${prop.city}, ${prop.state} ${prop.zipCode}`);
        console.log(`   ZPID: ${prop.zpid || 'N/A'}`);
        console.log(`   Price: $${prop.price?.toLocaleString() || 'N/A'}`);
        console.log(`   Agent Phone: ${prop.agentPhone || 'N/A'}`);
        console.log(`   Broker Phone: ${prop.brokerPhone || 'N/A'}`);
        console.log(`   Sent At: ${prop.sentAt || 'Unknown'}`);
        console.log(`   Status: ${prop.sentStatus || 'N/A'}`);
        if (prop.sentError) {
          console.log(`   Error: ${prop.sentError}`);
        }
        console.log(`   URL: ${prop.url || 'N/A'}`);
        console.log(`   Firebase ID: ${prop.firebaseId}`);
      });

      // Export missing properties to CSV
      console.log('\n\n💾 Exporting missing properties to CSV...');
      const csvOutput = [
        'Firebase ID,Address,City,State,Zip,ZPID,Price,Agent Phone,Broker Phone,Sent At,Status,Error,URL'
      ];

      missingProperties.forEach(prop => {
        csvOutput.push([
          prop.firebaseId,
          `"${prop.address}"`,
          prop.city,
          prop.state,
          prop.zipCode,
          prop.zpid,
          prop.price,
          prop.agentPhone,
          prop.brokerPhone,
          prop.sentAt,
          prop.sentStatus,
          `"${prop.sentError || ''}"`,
          prop.url,
        ].join(','));
      });

      const outputPath = '/Users/abdullahabunasrah/Desktop/ownerfi/missing-ghl-properties.csv';
      fs.writeFileSync(outputPath, csvOutput.join('\n'));
      console.log(`   ✅ Saved to: ${outputPath}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 INSIGHTS:');
    console.log(`   • ${foundProperties.length} of ${snapshot.size} properties successfully made it to GHL`);
    console.log(`   • ${missingProperties.length} properties were sent via webhook but are NOT in GHL`);

    if (missingProperties.length > 0) {
      console.log(`\n⚠️  ACTION REQUIRED:`);
      console.log(`   • Review missing properties in: missing-ghl-properties.csv`);
      console.log(`   • These properties may need to be re-sent to GHL`);
      console.log(`   • Check GHL webhook logs for potential errors`);
      console.log(`\n📝 To resend missing properties:`);
      console.log(`   • Review the error messages in the CSV`);
      console.log(`   • Fix any data issues (invalid phone numbers, etc.)`);
      console.log(`   • Use: POST /api/admin/zillow-imports/send-to-ghl`);
    } else {
      console.log(`\n✅ All properties successfully synced to GHL!`);
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Error finding missing properties:', error);
    process.exit(1);
  }
}

// Run the analysis
findMissingProperties()
  .then(() => {
    console.log('✅ Analysis completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
