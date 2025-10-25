import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

dotenv.config({ path: '.env.local' });

const WEBHOOK_URL = 'https://ownerfi.ai/api/gohighlevel/webhook/save-property';
const CSV_PATH = '/Users/abdullahabunasrah/Downloads/opportunities-2.csv';

interface Property {
  opportunityId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  price: string;
  zipCode?: string;
  bedrooms?: string;
  bathrooms?: string;
  livingArea?: string;
  yearBuilt?: string;
  lotSizes?: string;
  homeType?: string;
  imageLink?: string;
  downPaymentAmount?: string;
  downPayment?: string;
  interestRate?: string;
  monthlyPayment?: string;
  balloon?: string;
  description?: string;
}

// Helper function to sanitize header values (remove non-ASCII characters)
function sanitizeHeaderValue(value: string | undefined | number): string {
  if (!value) return '';
  const str = String(value);
  return str
    .replace(/—/g, '-')  // em dash
    .replace(/–/g, '-')  // en dash
    .replace(/'/g, "'")  // smart quote
    .replace(/'/g, "'")  // smart quote
    .replace(/"/g, '"')  // smart quote
    .replace(/"/g, '"')  // smart quote
    .replace(/…/g, '...') // ellipsis
    .replace(/[^\x00-\x7F]/g, ''); // Remove any remaining non-ASCII characters
}

async function readPropertiesToSync(): Promise<Set<string>> {
  const reportPath = path.join(__dirname, 'properties-to-add-by-oppid.json');
  const properties = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  return new Set(properties.map((p: any) => p.opportunityId));
}

async function readPropertiesFromCSV(oppIdsToSync: Set<string>): Promise<Property[]> {
  const properties: Property[] = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (row) => {
        const oppId = row['Opportunity ID'];

        // Only process properties in our sync list with "exported to website" status
        if (oppIdsToSync.has(oppId) && row.stage && row.stage.toLowerCase().includes('exported to website')) {
          properties.push({
            opportunityId: oppId,
            name: row['Opportunity Name'],
            address: row['Property Address'],
            city: row['Property city'],
            state: row['State '] || row['State'],
            zipCode: row['zip code '] || row['zip code'],
            price: row['Price '] || row['Price'],
            bedrooms: row['bedrooms'],
            bathrooms: row['bathrooms'],
            livingArea: row['livingArea'],
            yearBuilt: row['yearBuilt'],
            lotSizes: row['lot sizes'],
            homeType: row['homeType'],
            imageLink: row['Image link'],
            downPaymentAmount: row['down payment amount '],
            downPayment: row['down payment'],
            interestRate: row['Interest rate '],
            monthlyPayment: row['Monthly payment'],
            balloon: row['Balloon '],
            description: row['description ']
          });
        }
      })
      .on('end', () => resolve(properties))
      .on('error', reject);
  });
}

function isValidPrice(price: string | undefined): boolean {
  if (!price) return false;
  const cleaned = price.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return !isNaN(num) && num > 0;
}

async function syncPropertyToWebsite(property: Property): Promise<{ success: boolean; error?: string }> {
  // Validate required fields
  if (!property.address || property.address.trim() === '') {
    return { success: false, error: 'Missing address' };
  }
  if (!property.city || property.city.trim() === '') {
    return { success: false, error: 'Missing city' };
  }
  if (!property.state || property.state.trim() === '') {
    return { success: false, error: 'Missing state' };
  }
  if (!isValidPrice(property.price)) {
    return { success: false, error: `Invalid price: ${property.price}` };
  }

  try {
    console.log(`  Syncing: ${property.name || property.address}`);
    console.log(`  Opportunity ID: ${property.opportunityId}`);
    console.log(`  Address: ${property.address}, ${property.city}, ${property.state}`);
    console.log(`  Price: $${property.price}`);

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'opportunityid': sanitizeHeaderValue(property.opportunityId),
        'opportunityname': sanitizeHeaderValue(property.name),
        'propertyaddress': sanitizeHeaderValue(property.address),
        'propertycity': sanitizeHeaderValue(property.city),
        'state': sanitizeHeaderValue(property.state),
        'zipcode': sanitizeHeaderValue(property.zipCode),
        'price': sanitizeHeaderValue(property.price),
        'bedrooms': sanitizeHeaderValue(property.bedrooms),
        'bathrooms': sanitizeHeaderValue(property.bathrooms),
        'livingarea': sanitizeHeaderValue(property.livingArea),
        'yearbuilt': sanitizeHeaderValue(property.yearBuilt),
        'lotsizes': sanitizeHeaderValue(property.lotSizes),
        'hometype': sanitizeHeaderValue(property.homeType),
        'imagelink': sanitizeHeaderValue(property.imageLink),
        'downpaymentamount': sanitizeHeaderValue(property.downPaymentAmount),
        'downpayment': sanitizeHeaderValue(property.downPayment),
        'interestrate': sanitizeHeaderValue(property.interestRate),
        'monthlypayment': sanitizeHeaderValue(property.monthlyPayment),
        'balloon': sanitizeHeaderValue(property.balloon),
      },
      body: JSON.stringify({ opportunityId: property.opportunityId }),
    });

    if (response.ok) {
      console.log(`  ✅ SUCCESS\n`);
      return { success: true };
    } else {
      const errorText = await response.text();
      console.log(`  ❌ FAILED: ${response.status} ${response.statusText}`);
      console.log(`  Error: ${errorText}\n`);
      return { success: false, error: `${response.status}: ${errorText}` };
    }
  } catch (error: any) {
    console.log(`  ❌ ERROR: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('========================================');
  console.log('SYNCING REMAINING PROPERTIES');
  console.log('========================================\n');

  console.log('📖 Reading list of properties to sync...\n');
  const oppIdsToSync = await readPropertiesToSync();

  console.log(`Found ${oppIdsToSync.size} properties to sync\n`);
  console.log('📖 Reading property data from CSV...\n');

  const properties = await readPropertiesFromCSV(oppIdsToSync);

  console.log(`Found ${properties.length} properties with data in CSV\n`);

  if (properties.length === 0) {
    console.log('⚠️  No properties found to sync. All may already be synced!');
    return;
  }

  console.log('========================================\n');

  const results = {
    total: properties.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [] as { property: string; error: string }[]
  };

  for (const property of properties) {
    // Skip properties with invalid data
    if (!isValidPrice(property.price)) {
      console.log(`⏭️  SKIPPING: ${property.name || property.address}`);
      console.log(`  Reason: Invalid price (${property.price})\n`);
      results.skipped++;
      results.errors.push({
        property: property.name || property.address,
        error: `Invalid price: ${property.price}`
      });
      continue;
    }

    const result = await syncPropertyToWebsite(property);

    if (result.success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push({
        property: property.name || property.address,
        error: result.error || 'Unknown error'
      });
    }

    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('========================================');
  console.log('SYNC COMPLETE');
  console.log('========================================');
  console.log(`Total properties: ${results.total}`);
  console.log(`✅ Successfully synced: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏭️  Skipped (invalid data): ${results.skipped}`);
  console.log('========================================\n');

  if (results.errors.length > 0) {
    console.log('ERRORS:\n');
    results.errors.forEach((err, index) => {
      console.log(`${index + 1}. ${err.property}`);
      console.log(`   Error: ${err.error}\n`);
    });
  }

  // Save results
  const resultsPath = path.join(__dirname, 'remaining-sync-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`📄 Results saved to: ${resultsPath}\n`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
