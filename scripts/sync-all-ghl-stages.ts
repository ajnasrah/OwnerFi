const admin = require('firebase-admin');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env.local' });

// Simple sanitizer inline
function sanitizeDescription(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

interface CSVProperty {
  opportunityName: string;
  stage: string;
  firebaseId: string;
  opportunityId: string;
  address: string;
  city: string;
  state: string;
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
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(csvPath: string): CSVProperty[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const properties: CSVProperty[] = [];

  // Parse header
  const headerCols = parseCSVLine(lines[0]);

  // Find column indices
  const stageIdx = headerCols.findIndex(h => h.toLowerCase() === 'stage');
  const firebaseIdIdx = headerCols.findIndex(h => h.toLowerCase() === 'firebase_id');
  const opportunityIdIdx = headerCols.findIndex(h => h.toLowerCase() === 'opportunity id');
  const addressIdx = headerCols.findIndex(h => h.toLowerCase() === 'property address');
  const cityIdx = headerCols.findIndex(h => h.toLowerCase().includes('property city'));
  const stateIdx = headerCols.findIndex(h => h.toLowerCase().includes('state'));

  console.log('Column indices:');
  console.log(`  stage: ${stageIdx}, firebase_id: ${firebaseIdIdx}, opportunity_id: ${opportunityIdIdx}`);
  console.log(`  address: ${addressIdx}, city: ${cityIdx}, state: ${stateIdx}`);

  // Skip header, parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);

    // Skip rows that don't look like property data (notes/call summaries that got split)
    const stage = cols[stageIdx]?.toLowerCase() || '';
    const firebaseId = cols[firebaseIdIdx] || '';

    // Only process rows that have a valid stage and firebase_id
    const validStages = ['new', 'pending', 'interested', 'not interested'];
    const isValidStage = validStages.some(s => stage.includes(s)) || stage === '';

    if (firebaseId && firebaseId.length > 10 && isValidStage) {
      properties.push({
        opportunityName: cols[0] || '',
        stage: stage,
        firebaseId: firebaseId,
        opportunityId: cols[opportunityIdIdx] || '',
        address: cols[addressIdx] || cols[0] || '',
        city: cols[cityIdx] || '',
        state: cols[stateIdx] || '',
      });
    }
  }

  return properties;
}

// Normalize stage to expected Firebase status
function normalizeGhlStage(stage: string): 'sent_to_ghl' | 'agent_yes' | 'agent_no' | null {
  const s = stage.toLowerCase().trim();

  if (s.includes('not interested')) {
    return 'agent_no';
  }
  if (s.includes('interested')) {
    return 'agent_yes';
  }
  if (s === 'new' || s === 'pending' || s === '') {
    return 'sent_to_ghl';
  }

  return null;
}

async function syncPropertyStatus(
  firebaseId: string,
  expectedStatus: 'sent_to_ghl' | 'agent_yes' | 'agent_no',
  _address: string
): Promise<{ action: string; success: boolean; error?: string }> {
  try {
    const queueDoc = await db.collection('agent_outreach_queue').doc(firebaseId).get();

    if (!queueDoc.exists) {
      return { action: 'skip', success: false, error: 'Not found in queue' };
    }

    const queueData = queueDoc.data()!;
    const currentStatus = queueData.status;

    // Skip if already correct
    if (currentStatus === expectedStatus) {
      return { action: 'already_correct', success: true };
    }

    // Don't downgrade status (e.g., don't change agent_yes back to sent_to_ghl)
    const statusPriority = { 'pending': 0, 'processing': 1, 'sent_to_ghl': 2, 'agent_yes': 3, 'agent_no': 3, 'failed': 0 };
    if ((statusPriority[currentStatus as keyof typeof statusPriority] || 0) >= (statusPriority[expectedStatus] || 0)) {
      // Current status is same or higher priority, skip
      if (currentStatus === 'agent_yes' || currentStatus === 'agent_no') {
        return { action: 'already_final', success: true };
      }
    }

    // Update the status
    const updateData: any = {
      status: expectedStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ghlSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (expectedStatus === 'agent_yes') {
      updateData.agentResponse = 'yes';
      updateData.agentResponseAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (expectedStatus === 'agent_no') {
      updateData.agentResponse = 'no';
      updateData.agentResponseAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await db.collection('agent_outreach_queue').doc(firebaseId).update(updateData);

    // For agent_yes, also add/update in properties collection
    if (expectedStatus === 'agent_yes' && queueData.zpid) {
      await addToPropertiesCollection(queueData, firebaseId);
    }

    // For agent_no, deactivate in properties if exists
    if (expectedStatus === 'agent_no' && queueData.zpid) {
      const propertyId = `zpid_${queueData.zpid}`;
      const propDoc = await db.collection('properties').doc(propertyId).get();
      if (propDoc.exists) {
        await db.collection('properties').doc(propertyId).update({
          isActive: false,
          status: 'agent_rejected',
          agentRejectedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    return { action: `updated_${currentStatus}_to_${expectedStatus}`, success: true };

  } catch (error) {
    return { action: 'error', success: false, error: (error as Error).message };
  }
}

async function addToPropertiesCollection(queueData: any, firebaseId: string) {
  const propertyId = `zpid_${queueData.zpid}`;

  const descriptionText = sanitizeDescription(queueData.rawData?.description || queueData.description || '');

  const propertyData: any = {
    zpid: queueData.zpid,
    url: queueData.url,
    address: queueData.address || '',
    streetAddress: queueData.address || '',
    fullAddress: `${queueData.address}, ${queueData.city}, ${queueData.state} ${queueData.zipCode || ''}`.trim(),
    city: queueData.city || '',
    state: queueData.state || '',
    zipCode: queueData.zipCode || '',
    price: queueData.price || 0,
    listPrice: queueData.price || 0,
    bedrooms: queueData.beds || queueData.bedrooms || 0,
    beds: queueData.beds || queueData.bedrooms || 0,
    bathrooms: queueData.baths || queueData.bathrooms || 0,
    baths: queueData.baths || queueData.bathrooms || 0,
    squareFeet: queueData.squareFeet || queueData.livingArea || 0,
    homeType: queueData.propertyType || 'SINGLE_FAMILY',
    homeStatus: 'FOR_SALE',
    status: 'active',
    agentName: queueData.agentName,
    agentPhoneNumber: queueData.agentPhone,
    agentEmail: queueData.agentEmail || null,
    description: descriptionText,
    financingType: 'Owner Finance',
    ownerFinanceVerified: true,
    agentConfirmedOwnerFinance: true,
    dealType: 'owner_finance',
    isActive: true,
    isOwnerfinance: true,
    dealTypes: ['owner_finance'],
    source: 'agent_outreach',
    agentConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    originalQueueId: firebaseId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    imgSrc: queueData.imgSrc || queueData.imageUrl || queueData.rawData?.imgSrc || '',
    imageUrls: queueData.imageUrls || (queueData.imgSrc ? [queueData.imgSrc] : []),
  };

  const existingDoc = await db.collection('properties').doc(propertyId).get();
  if (!existingDoc.exists) {
    propertyData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    propertyData.importedAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await db.collection('properties').doc(propertyId).set(propertyData, { merge: true });
}

async function main() {
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';

  console.log('='.repeat(60));
  console.log('GHL TO FIREBASE STATUS SYNC');
  console.log('='.repeat(60));
  console.log('');

  console.log('Parsing CSV file...');
  const allProps = parseCSV(csvPath);
  console.log(`Found ${allProps.length} valid property records\n`);

  // Group by expected status
  const grouped = {
    sent_to_ghl: [] as CSVProperty[],
    agent_yes: [] as CSVProperty[],
    agent_no: [] as CSVProperty[],
    unknown: [] as CSVProperty[],
  };

  for (const prop of allProps) {
    const expectedStatus = normalizeGhlStage(prop.stage);
    if (expectedStatus) {
      grouped[expectedStatus].push(prop);
    } else {
      grouped.unknown.push(prop);
    }
  }

  console.log('GHL Stage Distribution:');
  console.log(`  New/Pending → sent_to_ghl: ${grouped.sent_to_ghl.length}`);
  console.log(`  Interested → agent_yes: ${grouped.agent_yes.length}`);
  console.log(`  Not Interested → agent_no: ${grouped.agent_no.length}`);
  console.log(`  Unknown: ${grouped.unknown.length}`);
  console.log('');

  // Track results
  const results = {
    sent_to_ghl: { updated: 0, already_correct: 0, failed: 0 },
    agent_yes: { updated: 0, already_correct: 0, failed: 0 },
    agent_no: { updated: 0, already_correct: 0, failed: 0 },
  };

  // Process agent_yes first (most important)
  console.log('Processing INTERESTED (agent_yes) properties...');
  for (const prop of grouped.agent_yes) {
    const result = await syncPropertyStatus(prop.firebaseId, 'agent_yes', prop.address);
    if (result.success) {
      if (result.action.includes('updated')) {
        results.agent_yes.updated++;
        console.log(`  ✓ ${prop.address}: ${result.action}`);
      } else {
        results.agent_yes.already_correct++;
      }
    } else {
      results.agent_yes.failed++;
      console.log(`  ✗ ${prop.address}: ${result.error}`);
    }
  }

  // Process agent_no
  console.log('\nProcessing NOT INTERESTED (agent_no) properties...');
  for (const prop of grouped.agent_no) {
    const result = await syncPropertyStatus(prop.firebaseId, 'agent_no', prop.address);
    if (result.success) {
      if (result.action.includes('updated')) {
        results.agent_no.updated++;
      } else {
        results.agent_no.already_correct++;
      }
    } else {
      results.agent_no.failed++;
    }
  }
  console.log(`  Updated: ${results.agent_no.updated}, Already correct: ${results.agent_no.already_correct}, Failed: ${results.agent_no.failed}`);

  // Process sent_to_ghl (New/Pending)
  console.log('\nProcessing NEW/PENDING (sent_to_ghl) properties...');
  for (const prop of grouped.sent_to_ghl) {
    const result = await syncPropertyStatus(prop.firebaseId, 'sent_to_ghl', prop.address);
    if (result.success) {
      if (result.action.includes('updated')) {
        results.sent_to_ghl.updated++;
      } else {
        results.sent_to_ghl.already_correct++;
      }
    } else {
      results.sent_to_ghl.failed++;
    }
  }
  console.log(`  Updated: ${results.sent_to_ghl.updated}, Already correct: ${results.sent_to_ghl.already_correct}, Failed: ${results.sent_to_ghl.failed}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SYNC SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log('agent_yes (Interested):');
  console.log(`  Updated: ${results.agent_yes.updated}`);
  console.log(`  Already correct: ${results.agent_yes.already_correct}`);
  console.log(`  Failed: ${results.agent_yes.failed}`);
  console.log('');
  console.log('agent_no (Not Interested):');
  console.log(`  Updated: ${results.agent_no.updated}`);
  console.log(`  Already correct: ${results.agent_no.already_correct}`);
  console.log(`  Failed: ${results.agent_no.failed}`);
  console.log('');
  console.log('sent_to_ghl (New/Pending):');
  console.log(`  Updated: ${results.sent_to_ghl.updated}`);
  console.log(`  Already correct: ${results.sent_to_ghl.already_correct}`);
  console.log(`  Failed: ${results.sent_to_ghl.failed}`);
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
