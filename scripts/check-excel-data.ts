#!/usr/bin/env npx tsx

import * as XLSX from 'xlsx';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: npx tsx check-excel-data.ts <path-to-excel-file>');
  process.exit(1);
}

console.log(`\n📊 Analyzing Excel Data: ${filePath}\n`);

const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

console.log(`Total Rows: ${data.length}\n`);

// Check first 5 rows for key fields
const fieldsToCheck = [
  'agent_name',
  'agent_phone',
  'broker_name',
  'broker_phone',
  'property_image_url',
  'annual_tax_paid',
  'zpid',
  'property_address'
];

console.log('📋 Sample Data (First 5 Properties):\n');
console.log('='.repeat(100));

for (let i = 0; i < Math.min(5, data.length); i++) {
  const row = data[i];
  console.log(`\n${i + 1}. ${row.property_address || 'N/A'} (ZPID: ${row.zpid || 'N/A'})`);
  console.log('   ' + '-'.repeat(90));

  fieldsToCheck.forEach(field => {
    let value = row[field];
    if (value === undefined || value === null || value === '') {
      value = '(empty)';
    } else if (typeof value === 'string' && value.length > 60) {
      value = value.substring(0, 60) + '...';
    }
    console.log(`   ${field.padEnd(25)}: ${value}`);
  });
}

// Count how many have data
console.log('\n\n📊 Data Availability Statistics:\n');
console.log('='.repeat(100));

const stats: any = {};
fieldsToCheck.forEach(field => {
  const nonEmpty = data.filter(row => row[field] && row[field] !== '').length;
  stats[field] = {
    filled: nonEmpty,
    empty: data.length - nonEmpty,
    percentage: ((nonEmpty / data.length) * 100).toFixed(1)
  };
});

Object.entries(stats).forEach(([field, stat]: [string, any]) => {
  const status = stat.filled > 0 ? '✅' : '❌';
  console.log(`${status} ${field.padEnd(25)}: ${stat.filled}/${data.length} (${stat.percentage}%)`);
});

console.log('\n');
