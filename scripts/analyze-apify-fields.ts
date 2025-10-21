#!/usr/bin/env npx tsx

/**
 * Analyze all available fields in Apify JSON output
 */

import * as fs from 'fs';

const filePath = process.argv[2] || '/Users/abdullahabunasrah/Downloads/dataset_zillow-detail-scraper_2025-10-21_15-41-24-538.json';

console.log(`\n🔍 Analyzing Apify JSON Structure: ${filePath}\n`);

const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
const sample = rawData[0];

console.log('📊 ALL AVAILABLE TOP-LEVEL FIELDS:\n');
console.log('='.repeat(80));

const fields = Object.keys(sample);
fields.forEach((field, index) => {
  const value = sample[field];
  const type = Array.isArray(value) ? 'array' : typeof value;
  const preview = type === 'object' && !Array.isArray(value) && value !== null
    ? `{${Object.keys(value).slice(0, 3).join(', ')}...}`
    : type === 'array'
    ? `[${value.length} items]`
    : type === 'string' && value.length > 40
    ? value.substring(0, 40) + '...'
    : String(value);

  console.log(`${(index + 1).toString().padStart(3)}. ${field.padEnd(40)} ${type.padEnd(10)} ${preview}`);
});

console.log('\n\n🏠 PROPERTY DETAILS AVAILABLE:\n');
console.log('='.repeat(80));

const propertyFields = {
  'Basic Info': {
    'address': sample.address,
    'city': sample.city,
    'state': sample.state,
    'zipcode': sample.zipcode,
    'price': sample.price,
    'bedrooms': sample.bedrooms,
    'bathrooms': sample.bathrooms,
    'yearBuilt': sample.yearBuilt,
  },
  'Size/Area': {
    'livingArea': sample.livingArea,
    'lotSize': sample.lotSize,
    'lotAreaValue': sample.lotAreaValue,
  },
  'Property Type': {
    'homeType': sample.homeType,
    'propertyTypeDimension': sample.propertyTypeDimension,
    'homeStatus': sample.homeStatus,
  },
  'Financial': {
    'price': sample.price,
    'zestimate': sample.zestimate,
    'rentZestimate': sample.rentZestimate,
    'monthlyHoaFee': sample.monthlyHoaFee,
    'annualHomeownersInsurance': sample.annualHomeownersInsurance,
  },
  'Listing Info': {
    'daysOnZillow': sample.daysOnZillow,
    'datePostedString': sample.datePostedString,
    'listingDataSource': sample.listingDataSource,
  },
  'School Info': {
    'schools': Array.isArray(sample.schools) ? `${sample.schools.length} schools` : 'none',
  },
  'Tax Info': {
    'taxHistory': Array.isArray(sample.taxHistory) ? `${sample.taxHistory.length} entries` : 'none',
  },
  'Agent/Broker': {
    'attributionInfo.agentName': sample.attributionInfo?.agentName,
    'attributionInfo.agentPhoneNumber': sample.attributionInfo?.agentPhoneNumber,
    'attributionInfo.brokerName': sample.attributionInfo?.brokerName,
    'attributionInfo.brokerPhoneNumber': sample.attributionInfo?.brokerPhoneNumber,
    'attributionInfo.mlsId': sample.attributionInfo?.mlsId,
  },
  'Images': {
    'responsivePhotos': Array.isArray(sample.responsivePhotos) ? `${sample.responsivePhotos.length} photos` : 'none',
    'photoCount': sample.photoCount,
  },
  'Description': {
    'description': sample.description ? `${sample.description.substring(0, 60)}...` : 'none',
  },
  'URL': {
    'url': sample.url,
    'hdpUrl': sample.hdpUrl,
  }
};

Object.entries(propertyFields).forEach(([category, fields]) => {
  console.log(`\n${category}:`);
  Object.entries(fields).forEach(([key, value]) => {
    const displayValue = value === undefined || value === null ? '(not available)' :
                         value === '' ? '(empty)' :
                         typeof value === 'object' ? JSON.stringify(value) :
                         String(value);
    console.log(`  ${key.padEnd(35)} ${displayValue}`);
  });
});

console.log('\n\n💡 ADDITIONAL USEFUL FIELDS:\n');
console.log('='.repeat(80));

const additionalFields = {
  'Parking': sample.parkingFeatures || sample.parking,
  'Garage': sample.garageType || sample.garage,
  'Heating': sample.heating,
  'Cooling': sample.cooling,
  'Appliances': sample.appliances,
  'Basement': sample.basement,
  'Fireplace': sample.hasFireplace,
  'Pool': sample.hasPool,
  'HOA Fee': sample.monthlyHoaFee,
  'Property Tax Rate': sample.propertyTaxRate,
  'Mortgage Rates': sample.mortgageRates,
  'Neighborhood': sample.address?.neighborhood,
  'Subdivision': sample.address?.subdivision,
  'County': sample.county,
  'Parcel Number': sample.parcelId,
  'MLS ID': sample.attributionInfo?.mlsId,
  'Listing ID': sample.zpid,
  'Days on Market': sample.daysOnZillow,
  'Price History': Array.isArray(sample.priceHistory) ? `${sample.priceHistory.length} entries` : 'none',
};

Object.entries(additionalFields).forEach(([key, value]) => {
  const status = value ? '✅' : '❌';
  const displayValue = value === undefined || value === null ? '(not available)' :
                       value === '' ? '(empty)' :
                       typeof value === 'object' ? JSON.stringify(value).substring(0, 50) :
                       String(value);
  console.log(`${status} ${key.padEnd(30)} ${displayValue}`);
});

console.log('\n');
