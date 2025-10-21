#!/usr/bin/env npx tsx

import * as XLSX from 'xlsx';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: npx tsx check-last-rows.ts <path-to-excel-file>');
  process.exit(1);
}

console.log(`\n📊 Checking LAST 5 rows (most recent imports):\n`);

const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

console.log(`Total Rows: ${data.length}\n`);
console.log('='.repeat(100));

const fieldsToCheck = [
  'agent_name',
  'agent_phone',
  'broker_phone',
  'property_image_url',
  'annual_tax_paid',
  'zpid',
  'imported_at'
];

const startIdx = Math.max(0, data.length - 5);
for (let i = startIdx; i < data.length; i++) {
  const row = data[i];
  console.log(`\n${i + 1}. ${row.property_address || 'N/A'}`);
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

console.log('\n');
