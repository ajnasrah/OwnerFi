/**
 * Cross-reference zillow_imports with GHL opportunities CSV
 * Verify all scraped properties are in GoHighLevel
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

const db = getFirestore(app);

function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');

  const data: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // Simple CSV parser (doesn't handle commas in quoted fields perfectly)
    const values = lines[i].split(',');
    const row: any = {};

    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });

    data.push(row);
  }

  return data;
}

async function crossReference() {
  console.log('🔍 CROSS-REFERENCING ZILLOW IMPORTS WITH GHL CSV');
  console.log('=================================================\n');

  try {
    // 1. Load zillow_imports from Firebase
    console.log('📊 Loading zillow_imports from Firebase...');
    const importsSnapshot = await getDocs(collection(db, 'zillow_imports'));

    const zillowProperties = new Map();
    let withContact = 0;
    let sentToGHL = 0;

    importsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const hasContact = !!(data.agentPhoneNumber || data.brokerPhoneNumber);

      if (hasContact) {
        withContact++;
        if (data.sentToGHL === true) {
          sentToGHL++;
        }

        // Store by address for matching
        const address = (data.fullAddress || data.streetAddress || '').toLowerCase().trim();
        zillowProperties.set(address, {
          id: doc.id,
          address: data.fullAddress || data.streetAddress,
          phone: data.agentPhoneNumber || data.brokerPhoneNumber,
          zpid: data.zpid,
          sentToGHL: data.sentToGHL,
        });
      }
    });

    console.log(`   Total: ${importsSnapshot.size}`);
    console.log(`   With contact: ${withContact}`);
    console.log(`   Marked as sent: ${sentToGHL}\n`);

    // 2. Load GHL CSV
    console.log('📊 Loading GHL opportunities CSV...');
    const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';

    if (!fs.existsSync(csvPath)) {
      console.error(`❌ File not found: ${csvPath}`);
      return;
    }

    const ghlOpportunities = parseCSV(csvPath);
    console.log(`   Total opportunities: ${ghlOpportunities.length}\n`);

    // 3. Find Zillow properties in GHL
    console.log('🔍 Matching Zillow properties to GHL opportunities...\n');

    let foundInGHL = 0;
    let notFoundInGHL = 0;
    const notFound: any[] = [];

    // Check if Zillow properties are in GHL by source field
    const zillowSourceOps = ghlOpportunities.filter(op =>
      op.source && op.source.toLowerCase().includes('zillow')
    );

    console.log(`   GHL opportunities with Zillow source: ${zillowSourceOps.length}`);

    // Match by address
    for (const [address, property] of zillowProperties.entries()) {
      const found = ghlOpportunities.find(op => {
        const ghlAddress = (op['Property Address'] || '').toLowerCase().trim();
        return ghlAddress === address ||
               ghlAddress.includes(address.split(',')[0]) || // Match street address
               address.includes(ghlAddress.split(',')[0]);
      });

      if (found) {
        foundInGHL++;
      } else {
        notFoundInGHL++;
        notFound.push(property);
      }
    }

    // 4. Results
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 CROSS-REFERENCE RESULTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Zillow imports with contact: ${withContact}`);
    console.log(`Found in GHL CSV: ${foundInGHL} (${Math.round(foundInGHL/withContact*100)}%)`);
    console.log(`NOT found in GHL CSV: ${notFoundInGHL} (${Math.round(notFoundInGHL/withContact*100)}%)\n`);

    console.log(`GHL opportunities breakdown:`);
    console.log(`   Total: ${ghlOpportunities.length}`);
    console.log(`   With Zillow source: ${zillowSourceOps.length}`);
    console.log(`   Difference: ${ghlOpportunities.length - zillowSourceOps.length} (non-Zillow sources)\n`);

    if (notFoundInGHL > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`❌ ${notFoundInGHL} ZILLOW PROPERTIES NOT IN GHL CSV:`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      notFound.slice(0, 20).forEach((prop, idx) => {
        console.log(`${idx + 1}. ${prop.address}`);
        console.log(`   Phone: ${prop.phone}`);
        console.log(`   ZPID: ${prop.zpid}`);
        console.log(`   Sent to GHL: ${prop.sentToGHL}\n`);
      });

      if (notFoundInGHL > 20) {
        console.log(`   ... and ${notFoundInGHL - 20} more\n`);
      }

      console.log('💡 POSSIBLE REASONS:');
      console.log('   1. Properties sent to GHL but CSV is outdated');
      console.log('   2. Address matching issues (different formats)');
      console.log('   3. Properties merged/deduplicated in GHL');
      console.log('   4. Export CSV doesn\'t include all opportunities\n');
    } else {
      console.log('✅ ALL ZILLOW PROPERTIES FOUND IN GHL CSV!\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

crossReference().catch(console.error);
