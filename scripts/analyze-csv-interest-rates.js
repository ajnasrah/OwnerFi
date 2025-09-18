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

async function analyzeCSVAndDatabase() {
  const csvData = [];
  const dbProperties = new Map();

  console.log('========================================');
  console.log('CSV INTEREST RATE ANALYSIS');
  console.log('========================================\n');

  // Step 1: Read CSV and analyze interest rates
  console.log('📖 Reading and analyzing CSV file...\n');

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', (row) => {
        const opportunityId = row['Opportunity ID']?.trim();
        const opportunityName = row['Opportunity Name']?.trim();
        const interestRateStr = row['Interest rate ']?.trim(); // Note the space after "rate"
        const propertyAddress = row['Property Address']?.trim();
        const price = row['price']?.trim();

        // Store all data for analysis
        csvData.push({
          opportunityId: opportunityId || 'N/A',
          opportunityName: opportunityName || 'N/A',
          address: propertyAddress || 'N/A',
          interestRateStr: interestRateStr || '',
          price: price || 'N/A',
          hasInterestRate: false,
          interestRateValue: null
        });

        // Check if this row has a valid interest rate
        if (interestRateStr && interestRateStr !== '' && interestRateStr !== 'N/A') {
          const lastItem = csvData[csvData.length - 1];
          // Parse the interest rate
          const rateValue = parseFloat(interestRateStr.replace('%', '').trim());
          if (!isNaN(rateValue) && rateValue > 0) {
            lastItem.hasInterestRate = true;
            lastItem.interestRateValue = rateValue;
          }
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  // Count properties with interest rates
  const propertiesWithRates = csvData.filter(item => item.hasInterestRate);
  const propertiesWithoutRates = csvData.filter(item => !item.hasInterestRate && item.opportunityId !== 'N/A');

  console.log('CSV ANALYSIS RESULTS:');
  console.log('----------------------------------------');
  console.log(`Total rows in CSV: ${csvData.length}`);
  console.log(`Properties WITH interest rates: ${propertiesWithRates.length}`);
  console.log(`Properties WITHOUT interest rates: ${propertiesWithoutRates.length}`);
  console.log();

  // Show distribution of interest rates
  const rateDistribution = {};
  propertiesWithRates.forEach(prop => {
    const rate = prop.interestRateValue;
    if (!rateDistribution[rate]) {
      rateDistribution[rate] = 0;
    }
    rateDistribution[rate]++;
  });

  console.log('Interest Rate Distribution:');
  console.log('----------------------------------------');
  const sortedRates = Object.keys(rateDistribution).sort((a, b) => parseFloat(a) - parseFloat(b));
  sortedRates.forEach(rate => {
    console.log(`  ${rate}%: ${rateDistribution[rate]} properties`);
  });
  console.log();

  // Step 2: Get all properties from database
  console.log('🔍 Fetching all properties from database...\n');
  const snapshot = await db.collection('properties').get();

  snapshot.forEach((doc) => {
    const data = doc.data();
    dbProperties.set(doc.id, {
      id: doc.id,
      opportunityId: data.opportunityId,
      address: data.address,
      interestRate: data.interestRate,
      price: data.price
    });
  });

  console.log('DATABASE ANALYSIS:');
  console.log('----------------------------------------');
  console.log(`Total properties in database: ${dbProperties.size}`);

  // Count properties with interest rates in database
  let dbPropertiesWithRates = 0;
  let dbPropertiesWithoutRates = 0;

  dbProperties.forEach(prop => {
    if (prop.interestRate && prop.interestRate > 0) {
      dbPropertiesWithRates++;
    } else {
      dbPropertiesWithoutRates++;
    }
  });

  console.log(`Properties WITH interest rates: ${dbPropertiesWithRates}`);
  console.log(`Properties WITHOUT interest rates: ${dbPropertiesWithoutRates}`);
  console.log();

  // Step 3: Match CSV properties with database
  console.log('MATCHING ANALYSIS:');
  console.log('----------------------------------------');

  let matchedWithRates = 0;
  let unmatchedWithRates = 0;
  const unmatchedList = [];
  const matchedNeedingUpdate = [];

  propertiesWithRates.forEach(csvProp => {
    if (dbProperties.has(csvProp.opportunityId)) {
      const dbProp = dbProperties.get(csvProp.opportunityId);
      matchedWithRates++;

      // Check if the database property needs interest rate update
      if (!dbProp.interestRate || dbProp.interestRate !== csvProp.interestRateValue) {
        matchedNeedingUpdate.push({
          id: csvProp.opportunityId,
          csvRate: csvProp.interestRateValue,
          dbRate: dbProp.interestRate || 'None',
          address: csvProp.address
        });
      }
    } else {
      unmatchedWithRates++;
      unmatchedList.push({
        id: csvProp.opportunityId,
        rate: csvProp.interestRateValue,
        address: csvProp.address,
        name: csvProp.opportunityName
      });
    }
  });

  console.log(`CSV properties with rates FOUND in database: ${matchedWithRates}`);
  console.log(`CSV properties with rates NOT FOUND in database: ${unmatchedWithRates}`);
  console.log(`Properties needing interest rate update: ${matchedNeedingUpdate.length}`);
  console.log();

  // Show properties that need updating
  if (matchedNeedingUpdate.length > 0) {
    console.log('PROPERTIES NEEDING INTEREST RATE UPDATE:');
    console.log('----------------------------------------');
    console.log(`Found ${matchedNeedingUpdate.length} properties that need interest rate updates:\n`);

    matchedNeedingUpdate.slice(0, 10).forEach(prop => {
      console.log(`  ID: ${prop.id}`);
      console.log(`    Current Rate: ${prop.dbRate}%`);
      console.log(`    Should Be: ${prop.csvRate}%`);
      console.log(`    Address: ${prop.address}`);
      console.log();
    });

    if (matchedNeedingUpdate.length > 10) {
      console.log(`  ... and ${matchedNeedingUpdate.length - 10} more properties`);
    }
  }

  // Show some unmatched properties
  if (unmatchedList.length > 0) {
    console.log('\nUNMATCHED PROPERTIES WITH INTEREST RATES:');
    console.log('----------------------------------------');
    console.log(`Found ${unmatchedList.length} properties in CSV with interest rates but not in database:\n`);

    unmatchedList.slice(0, 5).forEach(prop => {
      console.log(`  ID: ${prop.id}`);
      console.log(`    Rate: ${prop.rate}%`);
      console.log(`    Name: ${prop.name}`);
      console.log();
    });

    if (unmatchedList.length > 5) {
      console.log(`  ... and ${unmatchedList.length - 5} more unmatched properties`);
    }
  }

  // Final summary
  console.log('\n========================================');
  console.log('FINAL SUMMARY');
  console.log('========================================');
  console.log(`CSV Total Rows: ${csvData.length}`);
  console.log(`CSV Properties with Interest Rates: ${propertiesWithRates.length} (User says 293)`);
  console.log(`Database Total Properties: ${dbProperties.size} (User says 314)`);
  console.log(`Database Properties with Interest Rates: ${dbPropertiesWithRates}`);
  console.log(`\nMatching Results:`);
  console.log(`  ✅ Can update: ${matchedWithRates} properties`);
  console.log(`  ⚠️  Not in database: ${unmatchedWithRates} properties`);
  console.log(`  🔄 Need update: ${matchedNeedingUpdate.length} properties`);
  console.log('========================================\n');

  // Save detailed report
  const report = {
    csvAnalysis: {
      totalRows: csvData.length,
      withInterestRates: propertiesWithRates.length,
      withoutInterestRates: propertiesWithoutRates.length,
      rateDistribution
    },
    databaseAnalysis: {
      totalProperties: dbProperties.size,
      withInterestRates: dbPropertiesWithRates,
      withoutInterestRates: dbPropertiesWithoutRates
    },
    matchingAnalysis: {
      matched: matchedWithRates,
      unmatched: unmatchedWithRates,
      needingUpdate: matchedNeedingUpdate.length,
      updateList: matchedNeedingUpdate
    },
    timestamp: new Date().toISOString()
  };

  const reportPath = path.join(__dirname, 'interest-rate-analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📝 Detailed report saved to: ${reportPath}`);
}

// Run the analysis
analyzeCSVAndDatabase()
  .then(() => {
    console.log('\nAnalysis completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });