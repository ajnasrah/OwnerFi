const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin SDK
const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    })
  });
}

const db = admin.firestore();

// CSV file path
const CSV_FILE_PATH = '/Users/abdullahabunasrah/Downloads/opportunities.csv';

async function verifyOpportunityIds() {
  const csvOpportunities = [];
  const dbProperties = new Map();

  console.log('========================================');
  console.log('OPPORTUNITY ID VERIFICATION REPORT');
  console.log('========================================\n');

  // Step 1: Read all opportunity IDs from CSV
  console.log('📖 Reading CSV file...');
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', (row) => {
        const opportunityId = row['Opportunity ID']?.trim();
        const opportunityName = row['Opportunity Name']?.trim();
        const propertyAddress = row['Property Address']?.trim();
        const interestRate = row['Interest rate ']?.trim();

        if (opportunityId) {
          csvOpportunities.push({
            id: opportunityId,
            name: opportunityName,
            address: propertyAddress,
            interestRate: interestRate || 'N/A',
            found: false
          });
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`✅ Found ${csvOpportunities.length} opportunities in CSV\n`);

  // Step 2: Get all properties from database
  console.log('🔍 Fetching all properties from database...');
  const snapshot = await db.collection('properties').get();

  snapshot.forEach((doc) => {
    const data = doc.data();
    dbProperties.set(doc.id, {
      id: doc.id,
      opportunityId: data.opportunityId,
      address: data.address,
      city: data.city,
      state: data.state,
      interestRate: data.interestRate
    });
  });

  console.log(`✅ Found ${dbProperties.size} properties in database\n`);

  // Step 3: Check matches
  console.log('🔄 Matching opportunity IDs...\n');

  let matchedCount = 0;
  let unmatchedCount = 0;
  const unmatched = [];
  const matched = [];

  for (const csvOpp of csvOpportunities) {
    // Check if property exists with this ID
    if (dbProperties.has(csvOpp.id)) {
      const dbProp = dbProperties.get(csvOpp.id);
      csvOpp.found = true;
      matchedCount++;

      // Check if interest rate matches
      const dbRate = dbProp.interestRate || 'N/A';
      const csvRate = csvOpp.interestRate ? parseFloat(csvOpp.interestRate.replace('%', '').trim()) : 'N/A';
      const ratesMatch = (dbRate === 'N/A' && csvRate === 'N/A') ||
                        (dbRate !== 'N/A' && csvRate !== 'N/A' && Math.abs(dbRate - csvRate) < 0.01);

      matched.push({
        opportunityId: csvOpp.id,
        csvAddress: csvOpp.address,
        dbAddress: dbProp.address,
        csvInterestRate: csvOpp.interestRate,
        dbInterestRate: dbRate,
        ratesMatch: ratesMatch
      });
    } else {
      // Check if property exists with opportunityId field matching
      let foundByOpportunityIdField = false;
      for (const [propId, propData] of dbProperties.entries()) {
        if (propData.opportunityId === csvOpp.id) {
          foundByOpportunityIdField = true;
          console.log(`⚠️  Found by opportunityId field: CSV ID ${csvOpp.id} → DB ID ${propId}`);
          break;
        }
      }

      if (!foundByOpportunityIdField) {
        unmatchedCount++;
        unmatched.push({
          opportunityId: csvOpp.id,
          name: csvOpp.name,
          address: csvOpp.address,
          interestRate: csvOpp.interestRate
        });
      }
    }
  }

  // Step 4: Display results
  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log(`📊 Total opportunities in CSV: ${csvOpportunities.length}`);
  console.log(`✅ Matched with database: ${matchedCount}`);
  console.log(`❌ Not found in database: ${unmatchedCount}`);
  console.log(`📈 Match rate: ${((matchedCount / csvOpportunities.length) * 100).toFixed(1)}%`);
  console.log('========================================\n');

  // Step 5: Show sample of matched properties with interest rate status
  if (matched.length > 0) {
    console.log('SAMPLE OF MATCHED PROPERTIES (First 10):');
    console.log('----------------------------------------');
    matched.slice(0, 10).forEach(m => {
      const rateStatus = m.ratesMatch ? '✅' : '⚠️';
      console.log(`${rateStatus} ${m.opportunityId}`);
      console.log(`   CSV Rate: ${m.csvInterestRate || 'N/A'} | DB Rate: ${m.dbInterestRate || 'N/A'}`);
      console.log(`   Address: ${m.csvAddress}`);
    });
    console.log();
  }

  // Step 6: Show all unmatched opportunities
  if (unmatched.length > 0) {
    console.log('ALL UNMATCHED OPPORTUNITY IDS:');
    console.log('----------------------------------------');
    unmatched.forEach(u => {
      console.log(`❌ ${u.opportunityId}`);
      console.log(`   Name: ${u.name}`);
      console.log(`   Address: ${u.address}`);
      console.log(`   Interest Rate: ${u.interestRate}`);
      console.log();
    });
  }

  // Step 7: Check for properties in DB without opportunity IDs
  console.log('\nCHECKING DATABASE PROPERTIES:');
  console.log('----------------------------------------');
  let propertiesWithoutOppId = 0;
  let propertiesWithOppId = 0;

  for (const [propId, propData] of dbProperties.entries()) {
    if (!propData.opportunityId || propData.opportunityId === propId) {
      propertiesWithoutOppId++;
    } else {
      propertiesWithOppId++;
    }
  }

  console.log(`Properties with opportunityId field: ${propertiesWithOppId}`);
  console.log(`Properties without opportunityId field: ${propertiesWithoutOppId}`);

  // Step 8: Save detailed report to file
  const report = {
    summary: {
      totalCsvOpportunities: csvOpportunities.length,
      totalDbProperties: dbProperties.size,
      matched: matchedCount,
      unmatched: unmatchedCount,
      matchRate: ((matchedCount / csvOpportunities.length) * 100).toFixed(1) + '%'
    },
    unmatchedOpportunities: unmatched,
    timestamp: new Date().toISOString()
  };

  const reportPath = path.join(__dirname, 'opportunity-verification-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📝 Detailed report saved to: ${reportPath}`);
}

// Run the verification
verifyOpportunityIds()
  .then(() => {
    console.log('\nVerification completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });