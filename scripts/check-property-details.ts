import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

// Found properties from address matching
const foundPropertyIds = [
  'zpid_41811854',  // 32 Russell Rd
  'zpid_362271',    // 13324 Alexander Rd
  'zpid_314021',    // 2501 S Pine St
  'zpid_42212613',  // 4903 Quince Rd (inactive)
  'zpid_42230119',  // 2662 Orman Ave
  'zpid_355248',    // 35 N Meadowcliff Dr
  'zpid_89278865',  // 4254 Rosebury Ln
];

async function checkPropertyDetails() {
  console.log('========================================');
  console.log('DETAILED PROPERTY CHECK');
  console.log('========================================\n');

  for (const propId of foundPropertyIds) {
    const doc = await db.collection('properties').doc(propId).get();
    if (!doc.exists) {
      console.log(`${propId}: NOT FOUND\n`);
      continue;
    }

    const data = doc.data()!;

    console.log(`=== ${propId} ===`);
    console.log(`Address: ${data.address || data.streetAddress}, ${data.city}, ${data.state}`);
    console.log(`\nVisibility Fields:`);
    console.log(`  isActive: ${data.isActive}`);
    console.log(`  status: ${data.status}`);
    console.log(`  homeStatus: ${data.homeStatus}`);
    console.log(`  dealType: ${data.dealType}`);

    console.log(`\nOwner Financing Fields:`);
    console.log(`  ownerFinanceVerified: ${data.ownerFinanceVerified}`);
    console.log(`  matchedKeywords: ${JSON.stringify(data.matchedKeywords || [])}`);
    console.log(`  primaryKeyword: ${data.primaryKeyword || 'none'}`);
    console.log(`  financingType: ${data.financingType || 'none'}`);

    console.log(`\nFinancial Data:`);
    console.log(`  listPrice/price: ${data.listPrice || data.price || 0}`);
    console.log(`  monthlyPayment: ${data.monthlyPayment || 0}`);
    console.log(`  downPaymentAmount: ${data.downPaymentAmount || 0}`);
    console.log(`  interestRate: ${data.interestRate || 0}`);
    console.log(`  termYears: ${data.termYears || 0}`);

    console.log(`\nProperty Details:`);
    console.log(`  bedrooms: ${data.bedrooms || data.beds || 0}`);
    console.log(`  bathrooms: ${data.bathrooms || data.baths || 0}`);
    console.log(`  squareFeet: ${data.squareFeet || data.livingArea || 0}`);

    console.log(`\nSource/Description:`);
    console.log(`  source: ${data.source || 'unknown'}`);
    console.log(`  description preview: ${(data.description || '').substring(0, 200)}...`);

    // Check if description mentions owner financing
    const desc = (data.description || '').toLowerCase();
    const hasOwnerFinanceInDesc = desc.includes('owner') || desc.includes('seller financ') ||
                                   desc.includes('rent to own') || desc.includes('lease option');
    console.log(`\n  Has owner finance keywords in description: ${hasOwnerFinanceInDesc}`);

    console.log('\n');
  }

  // Check what makes a property show in buyer interface
  console.log('========================================');
  console.log('BUYER INTERFACE REQUIREMENTS CHECK');
  console.log('========================================\n');

  // Get sample of properties that ARE showing (active + status='active')
  const activePropsSnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .where('status', '==', 'active')
    .limit(5)
    .get();

  console.log(`Properties that SHOULD show in buyer interface (isActive=true AND status='active'):`);
  console.log(`Found: ${activePropsSnapshot.size} sample properties\n`);

  for (const doc of activePropsSnapshot.docs) {
    const data = doc.data();
    console.log(`${doc.id}: ${data.address}, ${data.city}`);
    console.log(`  dealType: ${data.dealType}, ownerFinanceVerified: ${data.ownerFinanceVerified}`);
    console.log(`  monthlyPayment: ${data.monthlyPayment}, downPayment: ${data.downPaymentAmount}`);
    console.log('');
  }

  // Check if any of our interested properties exist in Typesense
  console.log('\n========================================');
  console.log('SUMMARY OF ISSUES');
  console.log('========================================\n');

  console.log('The "Interested" properties from GHL CSV have these issues:\n');

  let missingStatus = 0;
  let inactive = 0;
  let noOwnerFinanceData = 0;

  for (const propId of foundPropertyIds) {
    const doc = await db.collection('properties').doc(propId).get();
    if (!doc.exists) continue;
    const data = doc.data()!;

    if (!data.status) missingStatus++;
    if (!data.isActive) inactive++;
    if (!data.monthlyPayment && !data.ownerFinanceVerified) noOwnerFinanceData++;
  }

  console.log(`1. Missing 'status' field: ${missingStatus}/${foundPropertyIds.length}`);
  console.log(`2. isActive = false: ${inactive}/${foundPropertyIds.length}`);
  console.log(`3. No owner finance data (monthlyPayment/ownerFinanceVerified): ${noOwnerFinanceData}/${foundPropertyIds.length}`);
  console.log('\nFor properties to show in buyer interface, they need:');
  console.log('  - isActive = true');
  console.log('  - status = "active"');
  console.log('  - dealType = "owner_finance" or "both" (optional but helps filtering)');
  console.log('  - monthlyPayment > 0 (for search/sort)');
}

checkPropertyDetails()
  .then(() => {
    console.log('\nCheck complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
