#!/usr/bin/env node

const fs = require('fs');
const { parse } = require('csv-parse');

const CSV_FILE_PATH = '/Users/abdullahabunasrah/Downloads/opportunities_geocoded.csv';

// Properties we know are in the database
const testAddresses = [
  '718 N Union St',
  '9543 Enstone Cir',
  '3482 Bandera Rd',
  '4504 Hunt Cir',
  '1049 Blythwood Dr',
  '6060 E River Rd'
];

async function checkCSVData() {
  console.log('Checking financial data in CSV for test properties:\n');

  const parser = fs
    .createReadStream(CSV_FILE_PATH)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: true
    }));

  for await (const row of parser) {
    const address = row['Property Address'];

    // Check if this is one of our test addresses
    const isTestAddress = testAddresses.some(testAddr =>
      address && address.toLowerCase().includes(testAddr.toLowerCase())
    );

    if (isTestAddress) {
      console.log(`\n📍 Property: ${address}`);
      console.log(`   Balloon: "${row['Balloon']}" -> ${parseFloat(row['Balloon']) || 'Not a number'}`);
      console.log(`   Interest rate: "${row['Interest rate']}" -> ${parseFloat(row['Interest rate']) || 'Not a number'}`);
      console.log(`   Down payment %: "${row['down payment']}" -> ${parseFloat(row['down payment']) || 'Not a number'}`);
      console.log(`   Down payment amt: "${row['down payment amount']}" -> ${parseFloat(row['down payment amount']) || 'Not a number'}`);
    }
  }
}

checkCSVData().catch(console.error);