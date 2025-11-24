/**
 * Import Previously Contacted Agents from CSV
 *
 * This script imports agents you've already contacted so the agent outreach
 * system doesn't send duplicates.
 *
 * Deduplication logic:
 * - Same address + same phone = duplicate (skip)
 * - Same address + different phone = new contact (allow, different agent)
 *
 * Usage:
 *   npx tsx scripts/import-contacted-agents.ts /path/to/opportunities.csv
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

interface ContactedAgent {
  propertyAddress: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  stage: string;
  status: string;
  createdOn: string;
  firebase_id?: string;
  opportunityId?: string;

  // For deduplication
  addressNormalized: string;
  phoneNormalized: string;
}

/**
 * Normalize address for comparison
 */
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/[#,\.]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|circle|cir)\b/g, '')
    .trim();
}

/**
 * Normalize phone for comparison
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, ''); // Remove all non-digits
}

/**
 * Parse CSV file
 */
function parseCSV(filePath: string): ContactedAgent[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const contacts: ContactedAgent[] = [];

  // Find column indices
  const addressIdx = headers.findIndex(h => h.toLowerCase().includes('property address'));
  const nameIdx = headers.findIndex(h => h.toLowerCase().includes('contact name'));
  const phoneIdx = headers.findIndex(h => h.toLowerCase() === 'phone');
  const emailIdx = headers.findIndex(h => h.toLowerCase() === 'email');
  const stageIdx = headers.findIndex(h => h.toLowerCase() === 'stage');
  const statusIdx = headers.findIndex(h => h.toLowerCase() === 'status');
  const createdIdx = headers.findIndex(h => h.toLowerCase().includes('created on'));
  const firebaseIdIdx = headers.findIndex(h => h.toLowerCase() === 'firebase_id');
  const oppIdIdx = headers.findIndex(h => h.toLowerCase().includes('opportunity id'));

  console.log(`📋 Found columns:
    Address: ${addressIdx}
    Name: ${nameIdx}
    Phone: ${phoneIdx}
    Email: ${emailIdx}
    Stage: ${stageIdx}
    Status: ${statusIdx}
    Created: ${createdIdx}
    Firebase ID: ${firebaseIdIdx}
    Opportunity ID: ${oppIdIdx}
  `);

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',');

    const address = values[addressIdx]?.trim() || '';
    const phone = values[phoneIdx]?.trim() || '';

    // Skip if no address or phone
    if (!address || !phone) {
      continue;
    }

    contacts.push({
      propertyAddress: address,
      contactName: values[nameIdx]?.trim() || '',
      contactPhone: phone,
      contactEmail: values[emailIdx]?.trim() || '',
      stage: values[stageIdx]?.trim() || '',
      status: values[statusIdx]?.trim() || '',
      createdOn: values[createdIdx]?.trim() || '',
      firebase_id: values[firebaseIdIdx]?.trim() || '',
      opportunityId: values[oppIdIdx]?.trim() || '',

      // Normalized for deduplication
      addressNormalized: normalizeAddress(address),
      phoneNormalized: normalizePhone(phone),
    });
  }

  return contacts;
}

/**
 * Import contacts to Firestore
 */
async function importContacts(contacts: ContactedAgent[]) {
  console.log(`\n🔄 Importing ${contacts.length} contacted agents...\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const contact of contacts) {
    try {
      // Check if already exists (same address + same phone)
      const existingQuery = await db
        .collection('contacted_agents')
        .where('addressNormalized', '==', contact.addressNormalized)
        .where('phoneNormalized', '==', contact.phoneNormalized)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        skipped++;
        console.log(`   ⏭️  Skipped: ${contact.propertyAddress} (already contacted this agent)`);
        continue;
      }

      // Add to contacted_agents collection
      await db.collection('contacted_agents').add({
        propertyAddress: contact.propertyAddress,
        contactName: contact.contactName,
        contactPhone: contact.contactPhone,
        contactEmail: contact.contactEmail,
        stage: contact.stage,
        status: contact.status,
        createdOn: contact.createdOn,
        firebase_id: contact.firebase_id,
        opportunityId: contact.opportunityId,

        // Normalized for fast queries
        addressNormalized: contact.addressNormalized,
        phoneNormalized: contact.phoneNormalized,

        // Metadata
        importedAt: new Date(),
        source: 'csv_import',
      });

      imported++;
      console.log(`   ✅ Imported: ${contact.propertyAddress} - ${contact.contactName}`);

    } catch (error: any) {
      errors++;
      console.error(`   ❌ Error importing ${contact.propertyAddress}: ${error.message}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Import Complete');
  console.log(`${'='.repeat(60)}`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`${'='.repeat(60)}\n`);
}

/**
 * Main function
 */
async function main() {
  const csvPath = process.argv[2] || '/Users/abdullahabunasrah/Downloads/opportunities-2.csv';

  console.log('📥 Importing Previously Contacted Agents\n');
  console.log(`📄 CSV File: ${csvPath}\n`);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  try {
    // Parse CSV
    const contacts = parseCSV(csvPath);
    console.log(`✅ Parsed ${contacts.length} contacts from CSV`);

    // Import to Firestore
    await importContacts(contacts);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
