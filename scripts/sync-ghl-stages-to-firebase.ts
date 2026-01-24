import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { sanitizeDescription } from '../src/lib/description-sanitizer';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

interface CSVProperty {
  address: string;
  city: string;
  state: string;
  stage: string;
  firebaseId: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(csvPath: string): CSVProperty[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const properties: CSVProperty[] = [];

  const headerCols = parseCSVLine(lines[0]);
  const stageIdx = headerCols.findIndex(h => h.toLowerCase() === 'stage');
  const firebaseIdIdx = headerCols.findIndex(h => h.toLowerCase() === 'firebase_id');
  const addressIdx = 0;
  const cityIdx = headerCols.findIndex(h => h.toLowerCase().includes('property city'));
  const stateIdx = headerCols.findIndex(h => h.toLowerCase().includes('state'));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const stage = cols[stageIdx]?.trim().toLowerCase() || '';
    const firebaseId = cols[firebaseIdIdx]?.trim() || '';

    if ((stage.includes('interested')) && firebaseId) {
      properties.push({
        address: cols[addressIdx]?.trim() || '',
        city: cols[cityIdx]?.trim() || '',
        state: cols[stateIdx]?.trim() || '',
        stage: stage,
        firebaseId: firebaseId
      });
    }
  }

  return properties;
}

async function processInterestedProperty(firebaseId: string, csvAddress: string): Promise<{ success: boolean; propertyId?: string; error?: string }> {
  try {
    // Get property from agent_outreach_queue
    const queueDoc = await db.collection('agent_outreach_queue').doc(firebaseId).get();

    if (!queueDoc.exists) {
      return { success: false, error: `Not found in agent_outreach_queue` };
    }

    const queueData = queueDoc.data()!;
    const zpid = queueData.zpid;

    if (!zpid) {
      return { success: false, error: `No zpid in queue document` };
    }

    const propertyId = `zpid_${zpid}`;

    // Check if already properly processed
    if (queueData.status === 'agent_yes' && queueData.routedTo === 'properties') {
      // Just verify properties collection is correct
      const propDoc = await db.collection('properties').doc(propertyId).get();
      if (propDoc.exists) {
        const propData = propDoc.data()!;
        if (propData.isActive && propData.ownerFinanceVerified) {
          return { success: true, propertyId, error: 'Already processed correctly' };
        }
      }
    }

    // Detect financing type
    const descriptionText = sanitizeDescription(queueData.rawData?.description || queueData.description || '');

    const isOwnerFinance = queueData.dealType === 'potential_owner_finance' || true; // Default to owner finance for interested
    const isCashDeal = queueData.dealType === 'cash_deal';

    const discountPercent = queueData.priceToZestimateRatio
      ? Math.round((1 - queueData.priceToZestimateRatio) * 100)
      : 0;

    // Create/Update in properties collection
    const propertyData: any = {
      // Core identifiers
      zpid: zpid,
      url: queueData.url,

      // Address
      address: queueData.address || '',
      streetAddress: queueData.address || '',
      fullAddress: `${queueData.address}, ${queueData.city}, ${queueData.state} ${queueData.zipCode || ''}`.trim(),
      city: queueData.city || '',
      state: queueData.state || '',
      zipCode: queueData.zipCode || '',

      // Pricing
      price: queueData.price || 0,
      listPrice: queueData.price || 0,
      zestimate: queueData.zestimate || null,
      priceToZestimateRatio: queueData.priceToZestimateRatio || 0,
      discountPercent: isCashDeal ? discountPercent : null,

      // Property details
      bedrooms: queueData.beds || queueData.bedrooms || 0,
      beds: queueData.beds || queueData.bedrooms || 0,
      bathrooms: queueData.baths || queueData.bathrooms || 0,
      baths: queueData.baths || queueData.bathrooms || 0,
      squareFeet: queueData.squareFeet || queueData.livingArea || 0,
      homeType: queueData.propertyType || 'SINGLE_FAMILY',
      homeStatus: 'FOR_SALE',
      status: 'active',

      // Agent info
      agentName: queueData.agentName,
      agentPhoneNumber: queueData.agentPhone,
      agentEmail: queueData.agentEmail || null,

      // Description
      description: descriptionText,

      // Owner Finance flags
      financingType: 'Owner Finance',
      ownerFinanceVerified: true,
      agentConfirmedOwnerFinance: true,
      dealType: 'owner_finance',

      // Active flags
      isActive: true,
      isOwnerFinance: true,
      isCashDeal: isCashDeal,
      dealTypes: isOwnerFinance ? ['owner_finance'] : ['cash_deal'],

      // Source tracking
      source: 'agent_outreach',
      agentConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      originalQueueId: firebaseId,

      // Metadata
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastStatusCheck: admin.firestore.FieldValue.serverTimestamp(),

      // Image
      imgSrc: queueData.imgSrc || queueData.imageUrl || queueData.rawData?.imgSrc || '',
      imageUrls: queueData.imageUrls || (queueData.imgSrc ? [queueData.imgSrc] : []),

      // Raw data
      rawData: queueData.rawData || null,
    };

    // Check if doc exists to preserve createdAt
    const existingDoc = await db.collection('properties').doc(propertyId).get();
    if (!existingDoc.exists) {
      propertyData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      propertyData.importedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    // Save to properties collection
    await db.collection('properties').doc(propertyId).set(propertyData, { merge: true });

    // Update agent_outreach_queue
    await db.collection('agent_outreach_queue').doc(firebaseId).update({
      status: 'agent_yes',
      agentResponse: 'yes',
      agentResponseAt: admin.firestore.FieldValue.serverTimestamp(),
      routedTo: 'properties',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, propertyId };

  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function processNotInterestedProperty(firebaseId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get property from agent_outreach_queue
    const queueDoc = await db.collection('agent_outreach_queue').doc(firebaseId).get();

    if (!queueDoc.exists) {
      return { success: false, error: `Not found in agent_outreach_queue` };
    }

    const queueData = queueDoc.data()!;

    // Update agent_outreach_queue to mark as rejected
    await db.collection('agent_outreach_queue').doc(firebaseId).update({
      status: 'agent_no',
      agentResponse: 'no',
      agentResponseAt: admin.firestore.FieldValue.serverTimestamp(),
      routedTo: 'rejected',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // If property exists in properties collection, deactivate it
    if (queueData.zpid) {
      const propertyId = `zpid_${queueData.zpid}`;
      const propDoc = await db.collection('properties').doc(propertyId).get();

      if (propDoc.exists) {
        await db.collection('properties').doc(propertyId).update({
          isActive: false,
          ownerFinanceVerified: false,
          agentConfirmedOwnerFinance: false,
          status: 'agent_rejected',
          agentRejectedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function main() {
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';

  console.log('Parsing CSV file...');
  const allProps = parseCSV(csvPath);

  const interestedProps = allProps.filter(p =>
    p.stage.includes('interested') && !p.stage.includes('not interested')
  );
  const notInterestedProps = allProps.filter(p =>
    p.stage.includes('not interested')
  );

  console.log(`\nFound:`);
  console.log(`  - Interested: ${interestedProps.length}`);
  console.log(`  - Not Interested: ${notInterestedProps.length}`);

  // Process INTERESTED properties
  console.log('\n========================================');
  console.log('PROCESSING INTERESTED PROPERTIES');
  console.log('========================================\n');

  let interestedSuccess = 0;
  let interestedFailed = 0;

  for (const prop of interestedProps) {
    console.log(`Processing: ${prop.address} (${prop.firebaseId})`);

    const result = await processInterestedProperty(prop.firebaseId, prop.address);

    if (result.success) {
      interestedSuccess++;
      console.log(`  ✓ Success - ${result.propertyId || result.error}`);
    } else {
      interestedFailed++;
      console.log(`  ✗ Failed - ${result.error}`);
    }
  }

  // Process NOT INTERESTED properties
  console.log('\n========================================');
  console.log('PROCESSING NOT INTERESTED PROPERTIES');
  console.log('========================================\n');

  let notInterestedSuccess = 0;
  let notInterestedFailed = 0;

  for (const prop of notInterestedProps) {
    const result = await processNotInterestedProperty(prop.firebaseId);

    if (result.success) {
      notInterestedSuccess++;
    } else {
      notInterestedFailed++;
      console.log(`  ✗ ${prop.address}: ${result.error}`);
    }
  }

  console.log(`\nNot Interested: ${notInterestedSuccess} success, ${notInterestedFailed} failed`);

  // Summary
  console.log('\n========================================');
  console.log('SYNC SUMMARY');
  console.log('========================================\n');

  console.log('INTERESTED:');
  console.log(`  Success: ${interestedSuccess}`);
  console.log(`  Failed: ${interestedFailed}`);

  console.log('\nNOT INTERESTED:');
  console.log(`  Success: ${notInterestedSuccess}`);
  console.log(`  Failed: ${notInterestedFailed}`);

  // Verify a few interested properties are now visible
  console.log('\n========================================');
  console.log('VERIFICATION - CHECKING UPDATED PROPERTIES');
  console.log('========================================\n');

  for (const prop of interestedProps.slice(0, 5)) {
    const queueDoc = await db.collection('agent_outreach_queue').doc(prop.firebaseId).get();
    if (queueDoc.exists) {
      const queueData = queueDoc.data()!;
      if (queueData.zpid) {
        const propDoc = await db.collection('properties').doc(`zpid_${queueData.zpid}`).get();
        if (propDoc.exists) {
          const propData = propDoc.data()!;
          console.log(`${prop.address}:`);
          console.log(`  Queue status: ${queueData.status}`);
          console.log(`  Properties: isActive=${propData.isActive}, status=${propData.status}`);
          console.log(`  dealType=${propData.dealType}, ownerFinanceVerified=${propData.ownerFinanceVerified}`);
          console.log('');
        }
      }
    }
  }
}

main()
  .then(() => {
    console.log('\nSync complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
