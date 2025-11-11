import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

dotenv.config({ path: '.env.local' });

const WEBHOOK_URL = process.env.NEXT_PUBLIC_BASE_URL
  ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/gohighlevel/webhook/save-property`
  : 'http://localhost:3000/api/gohighlevel/webhook/save-property';

const TARGET_OPPORTUNITY_ID = 'rcuP9y5jXJe58nk6I7Vt'; // 509 N 6th St

async function fixSingleProperty() {
  console.log('🔧 Fixing single property with enhanced sanitization...\n');
  console.log(`📍 Webhook URL: ${WEBHOOK_URL}\n`);
  console.log(`🎯 Target Opportunity ID: ${TARGET_OPPORTUNITY_ID}\n`);

  // Read CSV to get property data
  const csvContent = fs.readFileSync('/Users/abdullahabunasrah/Downloads/opportunities.csv', 'utf-8');
  const ghlRecords = csv.parse(csvContent, { columns: true, skip_empty_lines: true });

  // Find the specific property
  const prop = ghlRecords.find((r: any) => r['Opportunity ID'] === TARGET_OPPORTUNITY_ID);

  if (!prop) {
    console.error('❌ Property not found in CSV');
    process.exit(1);
  }

  const address = `${prop['Property Address']}, ${prop['Property city']}, ${prop['State ']}`;
  console.log(`Found: ${address}`);
  console.log(`Price: $${prop['Price ']}\n`);

  // Enhanced sanitization that converts ALL non-ASCII to ASCII equivalents or removes them
  const sanitize = (text: string): string => {
    if (!text) return '';

    // First pass: replace common Unicode with ASCII equivalents
    let result = text
      .replace(/[\u2018\u2019]/g, "'")      // Smart single quotes
      .replace(/[\u201C\u201D]/g, '"')      // Smart double quotes
      .replace(/[\u2013\u2014]/g, '-')      // En dash, em dash
      .replace(/[\u2026]/g, '...')          // Ellipsis
      .replace(/[\u00A0]/g, ' ')            // Non-breaking space
      .replace(/[\u2022]/g, '*')            // Bullet point
      .replace(/[\u00B0]/g, ' degrees ')    // Degree symbol
      .replace(/[\u00BD]/g, '1/2')          // Half fraction
      .replace(/[\u00BC]/g, '1/4')          // Quarter fraction
      .replace(/[\u00BE]/g, '3/4')          // Three quarters fraction
      .replace(/\n/g, ' ')                  // Replace newlines with spaces
      .replace(/\r/g, '')                   // Remove carriage returns
      .replace(/\t/g, ' ');                 // Replace tabs with spaces

    // Second pass: remove ANY remaining non-ASCII characters
    result = result.replace(/[^\x00-\x7F]/g, '');

    // Third pass: normalize whitespace
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  };

  const rawDescription = prop['description '] || prop['New Description '] || '';
  console.log('📝 Raw description length:', rawDescription.length);
  console.log('📝 Raw description sample:', rawDescription.substring(0, 100));

  const sanitizedDescription = sanitize(rawDescription);
  console.log('\n🧹 Sanitized description length:', sanitizedDescription.length);
  console.log('🧹 Sanitized description sample:', sanitizedDescription.substring(0, 100));

  // Check for any remaining non-ASCII
  const nonAscii: number[] = [];
  for (let i = 0; i < sanitizedDescription.length; i++) {
    if (sanitizedDescription.charCodeAt(i) > 127) {
      nonAscii.push(i);
    }
  }

  if (nonAscii.length > 0) {
    console.error('\n❌ WARNING: Still found non-ASCII characters at positions:', nonAscii);
    nonAscii.forEach(pos => {
      const char = sanitizedDescription[pos];
      console.error(`   Position ${pos}: "${char}" (code: ${sanitizedDescription.charCodeAt(pos)})`);
    });
  } else {
    console.log('\n✅ Description is fully ASCII-clean');
  }

  try {
    // Prepare webhook payload with ALL fields sanitized
    const payload = {
      opportunityId: TARGET_OPPORTUNITY_ID,
      propertyAddress: sanitize(prop['Property Address']),
      propertyCity: sanitize(prop['Property city']),
      state: sanitize(prop['State '] || ''),
      zipCode: sanitize(prop['zip code '] || ''),
      price: (prop['Price '] || '0').replace(/[,$]/g, ''),
      bedrooms: sanitize(prop['bedrooms'] || ''),
      bathrooms: sanitize(prop['bathrooms'] || ''),
      livingArea: sanitize(prop['livingArea'] || ''),
      yearBuilt: sanitize(prop['yearBuilt'] || ''),
      lotSizes: sanitize(prop['lot sizes'] || ''),
      homeType: sanitize(prop['homeType'] || 'Single Family'),
      imageLink: sanitize(prop['Image link'] || ''),
      description: sanitizedDescription,
      downPaymentAmount: (prop['down payment amount '] || '').replace(/[,$]/g, ''),
      downPayment: (prop['down payment %'] || '').replace(/[%]/g, ''),
      interestRate: (prop['Interest rate '] || '').replace(/[%]/g, ''),
      monthlyPayment: (prop['Monthly payment'] || '').replace(/[,$]/g, ''),
      balloon: sanitize(prop['Balloon '] || ''),
      zestimate: (prop['zestimate '] || '').replace(/[,$]/g, '')
    };

    console.log('\n🚀 Sending webhook request...\n');

    // Call the webhook - send most data in headers, description in body
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      body: JSON.stringify({
        opportunityId: TARGET_OPPORTUNITY_ID,
        description: payload.description
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ SUCCESS: ${result.data?.message || 'Property saved'}`);
      console.log('\n🎉 Property successfully imported!');
    } else {
      const errorText = await response.text();
      console.log(`❌ FAILED: ${response.status} - ${errorText}`);
    }

  } catch (error) {
    console.error(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(error);
  }
}

fixSingleProperty().then(() => {
  console.log('\n✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
