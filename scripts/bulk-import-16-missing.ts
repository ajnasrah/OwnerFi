import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

dotenv.config({ path: '.env.local' });

const WEBHOOK_URL = process.env.NEXT_PUBLIC_BASE_URL
  ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/gohighlevel/webhook/save-property`
  : 'http://localhost:3000/api/gohighlevel/webhook/save-property';

// The 16 missing opportunity IDs
const MISSING_OPPORTUNITY_IDS = [
  'XaDgL7spivEAFs6SoTCw',  // 603 N Highway 95
  'feMN1TbH8JR5ENTUV0Se',  // 2403/2409/2411 Fulton St
  'OziWrhkzOqzx9zaQD4wi',  // 1301 Watrous Ave
  'CWY8BUS6iCIctdfGq8fA',  // 405 Elizabeth St
  'Y1rtVsWUKITMWK5yxKY9',  // 911 W D Ave
  'tSjtZCKOVFRUai2tXpZP',  // 1008 N Ridge Pl
  'wIAy0AzRQHDIAJMpdbuO',  // 610 E Zion St N
  'Kpsuy1FiyIOXMCjK4REv',  // 3731 Indian Mound Trl
  'LreecXMZl6sUxkyAGPB6',  // 621 Stonehenge Dr
  'wELLLnRw4kzJba59BZgu',  // 224 Celestial Ridge Dr
  'riuiXe0MrnI9g4yerMhA',  // 179 E Finland St
  'dCPGtGlMq6wMpIMUvBhk',  // 358 S Kinler St
  'rV5q1mXoFWbyAwrWfZ7e',  // 402 N Lincoln Ave
  'salXW7ti3Z36Vnd63i5E',  // 2842 LUCOMA Drive
  'rcuP9y5jXJe58nk6I7Vt',  // 509 N 6th St
  'ek3YGXdQGSaXT1fpGbqm'   // 3730 E Davis Rd
];

async function bulkImport() {
  console.log('🚀 Bulk importing 16 missing "exported to website" properties...\n');
  console.log(`📍 Webhook URL: ${WEBHOOK_URL}\n`);

  // Read CSV to get property data
  const csvContent = fs.readFileSync('/Users/abdullahabunasrah/Downloads/opportunities.csv', 'utf-8');
  const ghlRecords = csv.parse(csvContent, { columns: true, skip_empty_lines: true });

  // Filter for the 16 missing properties
  const missingProperties = ghlRecords.filter((r: any) =>
    MISSING_OPPORTUNITY_IDS.includes(r['Opportunity ID'])
  );

  console.log(`Found ${missingProperties.length} properties to import\n`);

  let successCount = 0;
  let failCount = 0;
  const errors: any[] = [];

  for (let i = 0; i < missingProperties.length; i++) {
    const prop = missingProperties[i];
    const oppId = prop['Opportunity ID'];
    const address = `${prop['Property Address']}, ${prop['Property city']}, ${prop['State ']}`;

    console.log(`\n[${i + 1}/${missingProperties.length}] Processing: ${address}`);
    console.log(`   Opportunity ID: ${oppId}`);
    console.log(`   Price: $${prop['Price ']}`);

    try {
      // Sanitize text to remove special Unicode characters
      const sanitize = (text: string): string => {
        if (!text) return '';
        return text
          .replace(/[\u2018\u2019]/g, "'")  // Smart single quotes
          .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
          .replace(/[\u2013\u2014]/g, '-')  // En dash, em dash
          .replace(/[\u2026]/g, '...')      // Ellipsis
          .replace(/[^\x00-\x7F]/g, '')     // Remove any remaining non-ASCII
          .replace(/\n/g, ' ')              // Replace newlines with spaces
          .replace(/\s+/g, ' ')             // Collapse multiple spaces
          .trim();
      };

      // Prepare webhook payload
      const payload = {
        opportunityId: oppId,
        propertyAddress: sanitize(prop['Property Address']),
        propertyCity: sanitize(prop['Property city']),
        state: prop['State ']?.trim(),
        zipCode: prop['zip code ']?.trim(),
        price: prop['Price ']?.replace(/[,$]/g, '') || '0',
        bedrooms: prop['bedrooms'] || '',
        bathrooms: prop['bathrooms'] || '',
        livingArea: prop['livingArea'] || '',
        yearBuilt: prop['yearBuilt'] || '',
        lotSizes: prop['lot sizes'] || '',
        homeType: prop['homeType'] || 'Single Family',
        imageLink: prop['Image link'] || '',
        description: sanitize(prop['description '] || prop['New Description '] || ''),
        downPaymentAmount: prop['down payment amount ']?.replace(/[,$]/g, '') || '',
        downPayment: prop['down payment %']?.replace(/[%]/g, '') || '',
        interestRate: prop['Interest rate ']?.replace(/[%]/g, '') || '',
        monthlyPayment: prop['Monthly payment']?.replace(/[,$]/g, '') || '',
        balloon: prop['Balloon '] || '',
        zestimate: prop['zestimate ']?.replace(/[,$]/g, '') || ''
      };

      // Call the webhook - send most data in headers, description in body
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Send property data in headers (as GHL does) - but NOT description
          'opportunityid': payload.opportunityId,
          'propertyaddress': payload.propertyAddress,
          'propertycity': payload.propertyCity,
          'state': payload.state,
          'zipcode': payload.zipCode,
          'price': payload.price,
          'bedrooms': payload.bedrooms,
          'bathrooms': payload.bathrooms,
          'livingarea': payload.livingArea,
          'yearbuilt': payload.yearBuilt,
          'lotsizes': payload.lotSizes,
          'hometype': payload.homeType,
          'imagelink': payload.imageLink,
          'downpaymentamount': payload.downPaymentAmount,
          'downpayment': payload.downPayment,
          'interestrate': payload.interestRate,
          'monthlypayment': payload.monthlyPayment,
          'balloon': payload.balloon,
          'zestimate': payload.zestimate
        },
        // Send description in body to avoid header length limits
        body: JSON.stringify({
          opportunityId: oppId,
          description: payload.description
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ SUCCESS: ${result.data?.message || 'Property saved'}`);
        successCount++;
      } else {
        const errorText = await response.text();
        console.log(`   ❌ FAILED: ${response.status} - ${errorText.substring(0, 200)}`);
        failCount++;
        errors.push({
          opportunityId: oppId,
          address,
          status: response.status,
          error: errorText.substring(0, 200)
        });
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`   ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failCount++;
      errors.push({
        opportunityId: oppId,
        address,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Summary
  console.log(`\n\n📊 IMPORT SUMMARY:`);
  console.log(`   Total properties: ${missingProperties.length}`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);

  if (errors.length > 0) {
    console.log(`\n\n❌ ERRORS:\n`);
    errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err.address}`);
      console.log(`   Opportunity ID: ${err.opportunityId}`);
      console.log(`   Error: ${err.error}\n`);
    });
  }

  // Save results to file
  const resultsPath = '/Users/abdullahabunasrah/Desktop/ownerfi/BULK_IMPORT_RESULTS.txt';
  const results = `
BULK IMPORT RESULTS - ${new Date().toISOString()}
================================================

Total: ${missingProperties.length}
Successful: ${successCount}
Failed: ${failCount}

${errors.length > 0 ? `
ERRORS:
${errors.map(e => `
- ${e.address}
  Opportunity ID: ${e.opportunityId}
  Error: ${e.error}
`).join('\n')}
` : 'No errors!'}
`;

  fs.writeFileSync(resultsPath, results);
  console.log(`\n📄 Results saved to: ${resultsPath}`);
}

bulkImport().then(() => {
  console.log('\n✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
