#!/usr/bin/env npx tsx

/**
 * Convert Apify JSON export to CSV with images and agent info
 * Creates a flattened CSV with first property image included
 */

import * as fs from 'fs';
import * as XLSX from 'xlsx';
import * as path from 'path';

interface FlattenedProperty {
  zpid: number;
  url: string;
  fullAddress: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFoot: number;
  lotSquareFoot: number;
  yearBuilt: number;
  homeType: string;
  homeStatus: string;

  // Agent/Broker
  agentName: string;
  agentPhoneNumber: string;
  agentEmail: string;
  agentLicenseNumber: string;
  brokerName: string;
  brokerPhoneNumber: string;

  // Images (first image for CSV/Excel compatibility)
  firstPropertyImage: string;
  allPropertyImages: string;
  totalImages: number;

  // Financial
  estimate: number;
  rentEstimate: number;
  hoa: number;
  annualTaxAmount: number;

  // Other
  daysOnZillow: number;
  description: string;
  mlsId: string;
}

function flattenProperty(raw: any): FlattenedProperty | null {
  // Extract address
  const addressObj = raw.address || {};
  const streetAddress = addressObj.streetAddress || raw.streetAddress || '';
  const city = addressObj.city || raw.city || '';
  const state = addressObj.state || raw.state || '';
  const zipCode = addressObj.zipcode || raw.zipcode || '';
  const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`.trim();

  // Extract agent/broker
  const agentPhone = raw.attributionInfo?.agentPhoneNumber || '';
  const brokerPhone = raw.attributionInfo?.brokerPhoneNumber || '';

  // Skip if no contact info
  if (!agentPhone && !brokerPhone) {
    return null;
  }

  // Extract images - use main listing photo (desktopWebHdpImageLink)
  let firstImage = raw.desktopWebHdpImageLink
    || raw.hiResImageLink
    || raw.mediumImageLink
    || (Array.isArray(raw.responsivePhotos) && raw.responsivePhotos[0]?.url)
    || (Array.isArray(raw.photos) && raw.photos[0] && (typeof raw.photos[0] === 'string' ? raw.photos[0] : raw.photos[0]?.url))
    || (Array.isArray(raw.images) && raw.images[0])
    || '';

  let totalImages = 0;
  if (Array.isArray(raw.responsivePhotos)) {
    totalImages = raw.responsivePhotos.length;
  } else if (Array.isArray(raw.photos)) {
    totalImages = raw.photos.length;
  } else if (Array.isArray(raw.images)) {
    totalImages = raw.images.length;
  }

  // Build URL
  const hdpUrl = raw.hdpUrl || '';
  const fullUrl = hdpUrl ? `https://www.zillow.com${hdpUrl}` : (raw.url || '');

  return {
    zpid: raw.zpid || 0,
    url: fullUrl,
    fullAddress,
    streetAddress,
    city,
    state,
    zipCode,
    price: raw.price || 0,
    bedrooms: raw.bedrooms || 0,
    bathrooms: raw.bathrooms || 0,
    squareFoot: raw.livingArea || raw.squareFoot || 0,
    lotSquareFoot: raw.lotSize || raw.lotAreaValue || 0,
    yearBuilt: raw.yearBuilt || 0,
    homeType: raw.homeType || '',
    homeStatus: raw.homeStatus || '',

    agentName: raw.attributionInfo?.agentName || '',
    agentPhoneNumber: agentPhone || brokerPhone,
    agentEmail: raw.attributionInfo?.agentEmail || '',
    agentLicenseNumber: raw.attributionInfo?.agentLicenseNumber || '',
    brokerName: raw.attributionInfo?.brokerName || '',
    brokerPhoneNumber: brokerPhone,

    firstPropertyImage: firstImage,
    allPropertyImages: Array.isArray(raw.responsivePhotos)
      ? raw.responsivePhotos.map((p: any) => p.url).filter(Boolean).join(' | ')
      : Array.isArray(raw.photos)
      ? raw.photos.map((p: any) => typeof p === 'string' ? p : p?.url || '').filter(Boolean).join(' | ')
      : Array.isArray(raw.images)
      ? raw.images.join(' | ')
      : '',
    totalImages: totalImages,

    estimate: raw.zestimate || raw.estimate || 0,
    rentEstimate: raw.rentZestimate || 0,
    hoa: raw.monthlyHoaFee || 0,
    annualTaxAmount: (Array.isArray(raw.taxHistory) && raw.taxHistory.find((t: any) => t.taxPaid)?.taxPaid) || 0,

    daysOnZillow: raw.daysOnZillow || 0,
    description: raw.description || '',
    mlsId: raw.attributionInfo?.mlsId || '',
  };
}

async function convertJsonToCsv(jsonPath: string) {
  console.log('\n📄 JSON to CSV Converter (with Images)');
  console.log('='.repeat(80));
  console.log(`Input: ${jsonPath}\n`);

  // Read JSON
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`✓ Loaded ${rawData.length} properties`);

  // Transform
  console.log('🔄 Flattening data...');
  const flattened: FlattenedProperty[] = [];
  let skipped = 0;

  for (const raw of rawData) {
    const flat = flattenProperty(raw);
    if (flat) {
      flattened.push(flat);
    } else {
      skipped++;
    }
  }

  console.log(`✓ Transformed ${flattened.length} properties`);
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} (no agent/broker phone)`);
  }

  // Stats
  const withImages = flattened.filter(p => p.firstPropertyImage).length;
  console.log(`📸 Properties with images: ${withImages}/${flattened.length}`);

  // Create CSV
  console.log('\n💾 Creating CSV...');
  const worksheet = XLSX.utils.json_to_sheet(flattened);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Properties');

  // Generate output filename
  const baseName = path.basename(jsonPath, path.extname(jsonPath));
  const outputDir = path.dirname(jsonPath);
  const csvPath = path.join(outputDir, `${baseName}_with_images.csv`);

  XLSX.writeFile(workbook, csvPath);

  console.log(`✓ Saved: ${csvPath}`);

  console.log('\n📊 CSV Columns:');
  console.log('   ✓ Property details (address, price, beds, baths)');
  console.log('   ✓ Agent/Broker info (name, phone, email)');
  console.log('   ✓ First property image URL');
  console.log('   ✓ Total images count');
  console.log('   ✓ Financial data (estimate, taxes, HOA)');

  console.log('\n✅ Done! You can now import this CSV with images included.\n');

  return csvPath;
}

// Main
const jsonPath = process.argv[2];

if (!jsonPath) {
  console.log(`
Usage:
  npx tsx scripts/json-to-csv-with-images.ts <json-file>

Example:
  npx tsx scripts/json-to-csv-with-images.ts apify-output/zillow-details-complete.json

Output:
  Creates a CSV file with the same name + "_with_images.csv"
  Includes first property image URL in each row
  `);
  process.exit(0);
}

if (!fs.existsSync(jsonPath)) {
  console.error(`❌ File not found: ${jsonPath}`);
  process.exit(1);
}

convertJsonToCsv(jsonPath).catch(console.error);
