import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const WEBHOOK_URL = 'https://ownerfi.ai/api/gohighlevel/webhook/save-property';

// Helper function to sanitize header values (remove non-ASCII characters)
function sanitizeHeaderValue(value: string | undefined | number): string {
  if (!value) return '';
  const str = String(value);
  // Replace em dash, en dash, and other special characters
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

async function syncProperty() {
  console.log('Syncing: 20810 Trenton Valley Ln, Katy, TX\n');

  // Property data from CSV
  const property = {
    opportunityId: 'mT1a3NbMTl3u6tdGtjtp',
    name: '20810 Trenton Valley Ln Katy TX 77449',
    address: '20810 Trenton Valley Ln',
    city: 'Katy',
    state: 'TX',
    zipCode: '77449',
    price: '421000',
    bedrooms: '4',
    bathrooms: '3',
    livingArea: '2950',
    yearBuilt: '2006',
    homeType: 'single family',
    interestRate: '10',
    downPayment: '10',
    balloon: '5',
  };

  try {
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
        'hometype': sanitizeHeaderValue(property.homeType),
        'interestrate': sanitizeHeaderValue(property.interestRate),
        'downpayment': sanitizeHeaderValue(property.downPayment),
        'balloon': sanitizeHeaderValue(property.balloon),
      },
      body: JSON.stringify({ opportunityId: property.opportunityId }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS!');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log(`❌ FAILED: ${response.status} ${response.statusText}`);
      console.log(`Error: ${errorText}`);
    }
  } catch (error: any) {
    console.log(`❌ ERROR: ${error.message}`);
    console.error(error);
  }
}

syncProperty()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
