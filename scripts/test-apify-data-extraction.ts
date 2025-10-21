import * as fs from 'fs';
import * as path from 'path';

/**
 * Test script to verify agent/broker data extraction from Apify JSON
 *
 * Usage:
 *   npx tsx scripts/test-apify-data-extraction.ts <path-to-apify-json-file>
 *
 * Example:
 *   npx tsx scripts/test-apify-data-extraction.ts apify-output/zillow-details-complete.json
 */

interface ApifyProperty {
  zpid?: number;
  address?: any;
  streetAddress?: string;
  attributionInfo?: any;
  agentPhoneNumber?: string;
  brokerPhoneNumber?: string;
  [key: string]: any;
}

function extractContactInfo(apifyData: ApifyProperty) {
  const addressObj = apifyData.address || {};
  const streetAddress = addressObj.streetAddress || apifyData.streetAddress || '';
  const zpid = apifyData.zpid || 0;

  // ===== ENHANCED AGENT/BROKER EXTRACTION =====
  // Try multiple paths for agent phone
  const agentPhone = apifyData.attributionInfo?.agentPhoneNumber
    || apifyData.agentPhoneNumber
    || apifyData.agentPhone
    || '';

  // Try multiple paths for broker phone
  const brokerPhone = apifyData.attributionInfo?.brokerPhoneNumber
    || apifyData.brokerPhoneNumber
    || apifyData.brokerPhone
    || '';

  // Use broker phone as fallback if agent phone is missing
  const finalAgentPhone = agentPhone || brokerPhone;

  // Extract agent name from multiple sources
  const agentName = apifyData.attributionInfo?.agentName
    || apifyData.agentName
    || apifyData.listingAgent
    || (Array.isArray(apifyData.attributionInfo?.listingAgents) && apifyData.attributionInfo.listingAgents[0]?.memberFullName)
    || '';

  // Extract broker name from multiple sources
  const brokerName = apifyData.attributionInfo?.brokerName
    || apifyData.brokerName
    || apifyData.brokerageName
    || (Array.isArray(apifyData.attributionInfo?.listingOffices) && apifyData.attributionInfo.listingOffices[0]?.officeName)
    || '';

  return {
    zpid,
    streetAddress,
    agentName,
    agentPhone,
    brokerName,
    brokerPhone,
    finalAgentPhone,
    hasContact: !!(agentPhone || brokerPhone),
    attributionInfoExists: !!apifyData.attributionInfo,
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Test Apify Data Extraction
===========================

This script verifies that agent/broker contact information is being
correctly extracted from Apify JSON data.

Usage:
  npx tsx scripts/test-apify-data-extraction.ts <json-file>

Example:
  npx tsx scripts/test-apify-data-extraction.ts apify-output/zillow-details-complete.json

The script will:
  1. Read the Apify JSON file
  2. Extract contact info from each property
  3. Show statistics on how many have contacts
  4. Display sample extracted data
    `);
    process.exit(0);
  }

  const filePath = args[0];

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`📂 Reading file: ${filePath}\n`);

  const rawData = fs.readFileSync(filePath, 'utf-8');
  const properties: ApifyProperty[] = JSON.parse(rawData);

  console.log(`✅ Found ${properties.length} properties\n`);
  console.log('='.repeat(80));

  // Statistics
  let totalWithContact = 0;
  let totalWithAgentPhone = 0;
  let totalWithBrokerPhone = 0;
  let totalWithAgentName = 0;
  let totalWithBrokerName = 0;
  let totalWithoutContact = 0;

  const sampleWithContact: any[] = [];
  const sampleWithoutContact: any[] = [];

  // Process each property
  properties.forEach((property, index) => {
    const contact = extractContactInfo(property);

    if (contact.hasContact) {
      totalWithContact++;
      if (contact.agentPhone) totalWithAgentPhone++;
      if (contact.brokerPhone) totalWithBrokerPhone++;
      if (contact.agentName) totalWithAgentName++;
      if (contact.brokerName) totalWithBrokerName++;

      if (sampleWithContact.length < 3) {
        sampleWithContact.push(contact);
      }
    } else {
      totalWithoutContact++;
      if (sampleWithoutContact.length < 3) {
        sampleWithoutContact.push(contact);
      }
    }
  });

  // Display statistics
  console.log('\n📊 STATISTICS');
  console.log('='.repeat(80));
  console.log(`Total properties:           ${properties.length}`);
  console.log(`Properties WITH contact:    ${totalWithContact} (${Math.round(totalWithContact / properties.length * 100)}%)`);
  console.log(`Properties WITHOUT contact: ${totalWithoutContact} (${Math.round(totalWithoutContact / properties.length * 100)}%)`);
  console.log();
  console.log(`  - With agent phone:       ${totalWithAgentPhone} (${Math.round(totalWithAgentPhone / properties.length * 100)}%)`);
  console.log(`  - With broker phone:      ${totalWithBrokerPhone} (${Math.round(totalWithBrokerPhone / properties.length * 100)}%)`);
  console.log(`  - With agent name:        ${totalWithAgentName} (${Math.round(totalWithAgentName / properties.length * 100)}%)`);
  console.log(`  - With broker name:       ${totalWithBrokerName} (${Math.round(totalWithBrokerName / properties.length * 100)}%)`);

  // Display samples WITH contact
  if (sampleWithContact.length > 0) {
    console.log('\n\n✅ SAMPLE PROPERTIES WITH CONTACT INFO');
    console.log('='.repeat(80));
    sampleWithContact.forEach((contact, index) => {
      console.log(`\nProperty ${index + 1}:`);
      console.log(`  ZPID:              ${contact.zpid}`);
      console.log(`  Address:           ${contact.streetAddress}`);
      console.log(`  Agent Name:        ${contact.agentName || '(not found)'}`);
      console.log(`  Agent Phone:       ${contact.agentPhone || '(not found)'}`);
      console.log(`  Broker Name:       ${contact.brokerName || '(not found)'}`);
      console.log(`  Broker Phone:      ${contact.brokerPhone || '(not found)'}`);
      console.log(`  Final Agent Phone: ${contact.finalAgentPhone}`);
      console.log(`  attributionInfo:   ${contact.attributionInfoExists ? 'Present ✓' : 'Missing ✗'}`);
    });
  }

  // Display samples WITHOUT contact
  if (sampleWithoutContact.length > 0) {
    console.log('\n\n⚠️  SAMPLE PROPERTIES WITHOUT CONTACT INFO');
    console.log('='.repeat(80));
    sampleWithoutContact.forEach((contact, index) => {
      console.log(`\nProperty ${index + 1}:`);
      console.log(`  ZPID:              ${contact.zpid}`);
      console.log(`  Address:           ${contact.streetAddress}`);
      console.log(`  attributionInfo:   ${contact.attributionInfoExists ? 'Present ✓' : 'Missing ✗'}`);
      console.log(`  Issue:             No agent or broker phone number found`);
    });
  }

  // Final verdict
  console.log('\n\n📋 VERDICT');
  console.log('='.repeat(80));
  if (totalWithContact === properties.length) {
    console.log('✅ ALL properties have contact information!');
    console.log('   Your data is ready for import.');
  } else if (totalWithContact > 0) {
    console.log(`⚠️  ${totalWithContact} out of ${properties.length} properties have contact info.`);
    console.log(`   ${totalWithoutContact} properties will be SKIPPED during import.`);
    console.log(`   This is expected - some listings may not have public contact info.`);
  } else {
    console.log('❌ NO properties have contact information!');
    console.log('   Check if the Apify actor is returning the correct data structure.');
    console.log('   Expected fields: attributionInfo.agentPhoneNumber or attributionInfo.brokerPhoneNumber');
  }
  console.log();
}

main().catch(console.error);
