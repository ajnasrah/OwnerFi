#!/usr/bin/env npx tsx

import * as XLSX from 'xlsx';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: npx tsx check-excel-columns.ts <path-to-excel-file>');
  process.exit(1);
}

console.log(`\n📊 Analyzing Excel File: ${filePath}\n`);

const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data: any[] = XLSX.utils.sheet_to_json(worksheet);

console.log(`Sheet Name: ${sheetName}`);
console.log(`Total Rows: ${data.length}\n`);

if (data.length > 0) {
  const columns = Object.keys(data[0]);
  console.log(`Total Columns: ${columns.length}\n`);

  console.log('📋 Column Names:');
  console.log('='.repeat(60));
  columns.forEach((col, index) => {
    console.log(`${(index + 1).toString().padStart(2)}. ${col}`);
  });

  // Check for specific fields
  console.log('\n\n🔍 Checking for Requested Fields:');
  console.log('='.repeat(60));

  const fieldsToCheck = [
    { name: 'Agent Name', keys: ['agent_name', 'agentName', 'Agent Name'] },
    { name: 'Agent Phone', keys: ['agent_phone', 'agentPhone', 'Agent Phone'] },
    { name: 'Property Image URL', keys: ['property_image_url', 'imageUrl', 'Image URL'] },
    { name: 'All Images', keys: ['all_images', 'allImages', 'All Images'] },
    { name: 'Annual Tax', keys: ['annual_tax', 'annualTax', 'Annual Tax'] },
  ];

  fieldsToCheck.forEach(field => {
    const found = field.keys.find(key => columns.includes(key));
    const status = found ? '✅' : '❌';
    const foundText = found ? `(column: "${found}")` : '(NOT FOUND)';
    console.log(`${status} ${field.name.padEnd(25)} ${foundText}`);
  });

  // Show sample data for found fields
  console.log('\n\n📄 Sample Data (First Row):');
  console.log('='.repeat(60));

  const sampleRow = data[0];
  fieldsToCheck.forEach(field => {
    const found = field.keys.find(key => columns.includes(key));
    if (found) {
      let value = sampleRow[found];
      if (typeof value === 'string' && value.length > 50) {
        value = value.substring(0, 50) + '...';
      }
      console.log(`${field.name}:`);
      console.log(`  ${value || '(empty)'}\n`);
    }
  });
}

console.log('\n');
