import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

async function analyzeProperties() {
  console.log('Analyzing zillow_imports collection...\n');

  // Get ALL docs from zillow_imports
  const allDocs = await db.collection('zillow_imports').get();
  console.log(`Total documents in zillow_imports: ${allDocs.size}`);

  // Get docs with ownerFinanceVerified == true
  const verifiedDocs = await db.collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .get();
  console.log(`Documents with ownerFinanceVerified=true: ${verifiedDocs.size}`);

  // Get docs with ownerFinanceVerified == false or missing
  const unverifiedCount = allDocs.size - verifiedDocs.size;
  console.log(`Documents without ownerFinanceVerified=true: ${unverifiedCount}`);

  // Analyze verified properties
  let noDescription = 0;
  let shortDescription = 0;
  let noImages = 0;
  let noPrice = 0;
  let suspiciousKeywords = 0;
  const issues: any[] = [];

  const ownerFinanceKeywords = [
    'owner financ', 'seller financ', 'rent to own', 'lease option',
    'contract for deed', 'land contract', 'assumable', 'wrap mortgage',
    'subject to', 'creative financ', 'no bank', 'no credit check',
    'flexible terms', 'easy qualify', 'owner will carry', 'seller will carry'
  ];

  verifiedDocs.forEach(doc => {
    const data = doc.data();
    const desc = (data.description || '').toLowerCase();
    const address = data.fullAddress || data.streetAddress || data.address || 'Unknown';

    // Check for missing description
    if (!data.description || data.description.trim() === '') {
      noDescription++;
      issues.push({ id: doc.id, address, issue: 'NO_DESCRIPTION' });
    } else if (data.description.length < 50) {
      shortDescription++;
      issues.push({ id: doc.id, address, issue: 'SHORT_DESCRIPTION', length: data.description.length });
    }

    // Check for missing images
    if (!data.firstPropertyImage && (!data.propertyImages || data.propertyImages.length === 0)) {
      noImages++;
      issues.push({ id: doc.id, address, issue: 'NO_IMAGES' });
    }

    // Check for missing price
    if (!data.price && !data.listPrice) {
      noPrice++;
      issues.push({ id: doc.id, address, issue: 'NO_PRICE' });
    }

    // Check if description actually mentions owner financing
    if (data.description && data.description.length > 10) {
      const hasOwnerFinanceKeyword = ownerFinanceKeywords.some(kw => desc.includes(kw));
      if (!hasOwnerFinanceKeyword) {
        suspiciousKeywords++;
        if (suspiciousKeywords <= 20) {
          issues.push({
            id: doc.id,
            address,
            issue: 'NO_OWNER_FINANCE_KEYWORDS',
            descPreview: data.description.substring(0, 100) + '...'
          });
        }
      }
    }
  });

  console.log('\n=== ANALYSIS RESULTS ===');
  console.log(`No description: ${noDescription}`);
  console.log(`Short description (<50 chars): ${shortDescription}`);
  console.log(`No images: ${noImages}`);
  console.log(`No price: ${noPrice}`);
  console.log(`No owner finance keywords in description: ${suspiciousKeywords}`);

  console.log('\n=== SAMPLE ISSUES (first 30) ===');
  issues.slice(0, 30).forEach((issue, i) => {
    console.log(`${i + 1}. [${issue.issue}] ${issue.address}`);
    if (issue.descPreview) {
      console.log(`   Preview: ${issue.descPreview}`);
    }
  });

  // Also check properties collection
  const propertiesCount = await db.collection('properties').where('isActive', '==', true).get();
  console.log(`\nActive properties in 'properties' collection: ${propertiesCount.size}`);
}

analyzeProperties().catch(console.error);
