const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const files = fs.readdirSync('/Users/abdullahabunasrah/Downloads');
const csvFile = files.find(f => f.includes('9.45.40') && f.endsWith('.csv'));
const fullPath = path.join('/Users/abdullahabunasrah/Downloads', csvFile);
const content = fs.readFileSync(fullPath, 'utf-8');
const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
const prop = records.find(r => r['Property Address']?.includes('2842 LUCOMA'));

console.log('All column names and values for 2842 LUCOMA property:\n');
let counter = 1;
for (const [key, value] of Object.entries(prop)) {
  const displayValue = typeof value === 'string' && value.length > 50
    ? value.substring(0, 50) + '...'
    : value;
  console.log(`${counter++}. "${key}" = "${displayValue}"`);
}
