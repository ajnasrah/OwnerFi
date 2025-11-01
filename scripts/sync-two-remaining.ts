import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const WEBHOOK_URL = 'https://ownerfi.ai/api/gohighlevel/webhook/save-property';

const properties = [
  {
    opportunityId: 'NXosZFbcBLu52cmT4v4p',
    name: '3405 Sirius Ave El Paso TX 79904',
    address: '3405 Sirius Ave',
    city: 'El Paso',
    state: 'TX',
    zipCode: '79904',
    price: '275000',
    bedrooms: '4',
    bathrooms: '2',
    livingArea: '2260',
    yearBuilt: '2002',
    homeType: 'Single Family',
    interestRate: '10',
    downPayment: '10'
  },
  {
    opportunityId: '4hw7GGrOdJgCIPufF1A0',
    name: '3228 Millmar Dr Dallas TX 75228',
    address: '3228 Millmar Dr',
    city: 'Dallas',
    state: 'TX',
    zipCode: '75228',
    price: '320000',
    bedrooms: '3',
    bathrooms: '2',
    livingArea: '1472',
    yearBuilt: '1952',
    homeType: 'Single Family',
    interestRate: '9',
    downPayment: '30000',
    downPaymentAmount: '30000'
  }
];

async function syncProperty(property: any) {
  console.log(`Syncing: ${property.name}`);
  console.log(`  Address: ${property.address}, ${property.city}, ${property.state}`);
  console.log(`  Price: $${property.price}`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'opportunityid': property.opportunityId,
        'opportunityname': property.name,
        'propertyaddress': property.address,
        'propertycity': property.city,
        'state': property.state,
        'zipcode': property.zipCode || '',
        'price': property.price,
        'bedrooms': property.bedrooms || '',
        'bathrooms': property.bathrooms || '',
        'livingarea': property.livingArea || '',
        'yearbuilt': property.yearBuilt || '',
        'hometype': property.homeType || '',
        'interestrate': property.interestRate || '',
        'downpayment': property.downPayment || '',
        'downpaymentamount': property.downPaymentAmount || ''
      },
      body: JSON.stringify({ opportunityId: property.opportunityId }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`  ✅ SUCCESS\n`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`  ❌ FAILED: ${response.status}`);
      console.log(`  Error: ${errorText}\n`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ ERROR: ${error.message}\n`);
    return false;
  }
}

async function main() {
  console.log('Syncing final 2 properties (without descriptions)...\n');

  let success = 0;
  let failed = 0;

  for (const property of properties) {
    const result = await syncProperty(property);
    if (result) {
      success++;
    } else {
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('========================================');
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('========================================');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
