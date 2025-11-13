import * as fs from 'fs';
import csv from 'csv-parser';

interface CSVProperty {
  'Opportunity ID': string;
  'Property Address': string;
  'Property city': string;
  'State ': string;
  'zip code ': string;
  'yearBuilt': string;
  'bedrooms': string;
  'bathrooms': string;
  'livingArea': string;
  'homeType': string;
  'Price ': string;
  'description ': string;
  'lot sizes': string;
  'Image link': string;
  'Tax amount ': string;
  'hoa ': string;
  'zestimate ': string;
  'Rental estimate ': string;
  'Contact ID': string;
  'phone': string;
  'email': string;
  'Contact Name': string;
  'daysOnZillow': string;
  'source': string;
}

interface ValidationIssue {
  opportunityId: string;
  address: string;
  field: string;
  value: any;
  issue: string;
}

async function readCSV(filePath: string): Promise<CSVProperty[]> {
  return new Promise((resolve, reject) => {
    const results: CSVProperty[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function validateEmail(email: string): boolean {
  if (!email || email.trim() === '') return true; // Empty is OK
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function validatePhone(phone: string): boolean {
  if (!phone || phone.trim() === '') return true; // Empty is OK
  // Check if it starts with + and has digits
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^\+?\d{10,15}$/.test(cleaned);
}

function validateURL(url: string): boolean {
  if (!url || url.trim() === '') return true; // Empty is OK
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function validateYear(year: string): boolean {
  if (!year || year.trim() === '' || year.trim() === ' ') return true; // Empty is OK
  const num = parseInt(year);
  return !isNaN(num) && num >= 1800 && num <= new Date().getFullYear() + 2;
}

function validateNumber(value: string, min?: number, max?: number): boolean {
  if (!value || value.trim() === '' || value.trim() === ' ') return true; // Empty is OK
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  return true;
}

function validateZipCode(zip: string): boolean {
  if (!zip || zip.trim() === '') return true; // Empty is OK
  const cleaned = zip.trim();
  // US zip: 5 digits or 5+4
  // Canada: A1A 1A1
  return /^\d{5}(-\d{4})?$/.test(cleaned) || /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(cleaned);
}

function validateState(state: string): boolean {
  if (!state || state.trim() === '' || state.trim() === ' ') return true; // Empty is OK
  const cleaned = state.trim();
  // Should be 2 letter state code
  return /^[A-Z]{2}$/i.test(cleaned);
}

async function validateCSVData() {
  console.log('🔍 Validating CSV Data Quality...\n');

  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';
  const csvRecords = await readCSV(csvPath);

  console.log(`📄 Analyzing ${csvRecords.length} records...\n`);

  const issues: ValidationIssue[] = [];
  const stats = {
    totalRecords: csvRecords.length,
    recordsWithIssues: 0,
    issuesByField: {} as { [key: string]: number },
    issuesByType: {} as { [key: string]: number },
  };

  for (const record of csvRecords) {
    const oppId = record['Opportunity ID'];
    const address = record['Property Address'];
    let hasIssue = false;

    // Validate Opportunity ID
    if (!oppId || oppId.trim() === '') {
      issues.push({
        opportunityId: 'MISSING',
        address: address || 'UNKNOWN',
        field: 'Opportunity ID',
        value: oppId,
        issue: 'Missing opportunity ID'
      });
      hasIssue = true;
      stats.issuesByField['Opportunity ID'] = (stats.issuesByField['Opportunity ID'] || 0) + 1;
      stats.issuesByType['Missing Required Field'] = (stats.issuesByType['Missing Required Field'] || 0) + 1;
    }

    // Validate Address
    if (!address || address.trim() === '') {
      issues.push({
        opportunityId: oppId,
        address: 'MISSING',
        field: 'Property Address',
        value: address,
        issue: 'Missing property address'
      });
      hasIssue = true;
      stats.issuesByField['Property Address'] = (stats.issuesByField['Property Address'] || 0) + 1;
      stats.issuesByType['Missing Required Field'] = (stats.issuesByType['Missing Required Field'] || 0) + 1;
    }

    // Validate Email
    if (!validateEmail(record['email'])) {
      issues.push({
        opportunityId: oppId,
        address: address,
        field: 'email',
        value: record['email'],
        issue: 'Invalid email format'
      });
      hasIssue = true;
      stats.issuesByField['email'] = (stats.issuesByField['email'] || 0) + 1;
      stats.issuesByType['Invalid Format'] = (stats.issuesByType['Invalid Format'] || 0) + 1;
    }

    // Validate Phone
    if (!validatePhone(record['phone'])) {
      issues.push({
        opportunityId: oppId,
        address: address,
        field: 'phone',
        value: record['phone'],
        issue: 'Invalid phone format'
      });
      hasIssue = true;
      stats.issuesByField['phone'] = (stats.issuesByField['phone'] || 0) + 1;
      stats.issuesByType['Invalid Format'] = (stats.issuesByType['Invalid Format'] || 0) + 1;
    }

    // Validate Image URL
    if (!validateURL(record['Image link'])) {
      issues.push({
        opportunityId: oppId,
        address: address,
        field: 'Image link',
        value: record['Image link'],
        issue: 'Invalid URL format'
      });
      hasIssue = true;
      stats.issuesByField['Image link'] = (stats.issuesByField['Image link'] || 0) + 1;
      stats.issuesByType['Invalid URL'] = (stats.issuesByType['Invalid URL'] || 0) + 1;
    }

    // Validate Source URL
    if (!validateURL(record['source'])) {
      issues.push({
        opportunityId: oppId,
        address: address,
        field: 'source',
        value: record['source'],
        issue: 'Invalid source URL'
      });
      hasIssue = true;
      stats.issuesByField['source'] = (stats.issuesByField['source'] || 0) + 1;
      stats.issuesByType['Invalid URL'] = (stats.issuesByType['Invalid URL'] || 0) + 1;
    }

    // Validate Year Built
    if (!validateYear(record['yearBuilt'])) {
      issues.push({
        opportunityId: oppId,
        address: address,
        field: 'yearBuilt',
        value: record['yearBuilt'],
        issue: 'Invalid year (must be between 1800 and current year + 2)'
      });
      hasIssue = true;
      stats.issuesByField['yearBuilt'] = (stats.issuesByField['yearBuilt'] || 0) + 1;
      stats.issuesByType['Invalid Range'] = (stats.issuesByType['Invalid Range'] || 0) + 1;
    }

    // Validate Bedrooms
    if (!validateNumber(record['bedrooms'], 0, 50)) {
      issues.push({
        opportunityId: oppId,
        address: address,
        field: 'bedrooms',
        value: record['bedrooms'],
        issue: 'Invalid bedrooms (must be 0-50)'
      });
      hasIssue = true;
      stats.issuesByField['bedrooms'] = (stats.issuesByField['bedrooms'] || 0) + 1;
      stats.issuesByType['Invalid Range'] = (stats.issuesByType['Invalid Range'] || 0) + 1;
    }

    // Validate Bathrooms
    if (!validateNumber(record['bathrooms'], 0, 50)) {
      issues.push({
        opportunityId: oppId,
        address: address,
        field: 'bathrooms',
        value: record['bathrooms'],
        issue: 'Invalid bathrooms (must be 0-50)'
      });
      hasIssue = true;
      stats.issuesByField['bathrooms'] = (stats.issuesByField['bathrooms'] || 0) + 1;
      stats.issuesByType['Invalid Range'] = (stats.issuesByType['Invalid Range'] || 0) + 1;
    }

    // Validate Living Area
    if (!validateNumber(record['livingArea'], 0, 100000)) {
      issues.push({
        opportunityId: oppId,
        address: address,
        field: 'livingArea',
        value: record['livingArea'],
        issue: 'Invalid living area (must be 0-100,000 sqft)'
      });
      hasIssue = true;
      stats.issuesByField['livingArea'] = (stats.issuesByField['livingArea'] || 0) + 1;
      stats.issuesByType['Invalid Range'] = (stats.issuesByType['Invalid Range'] || 0) + 1;
    }

    // Validate Price
    if (!validateNumber(record['Price '], 0, 1000000000)) {
      issues.push({
        opportunityId: oppId,
        address: address,
        field: 'Price',
        value: record['Price '],
        issue: 'Invalid price'
      });
      hasIssue = true;
      stats.issuesByField['Price'] = (stats.issuesByField['Price'] || 0) + 1;
      stats.issuesByType['Invalid Range'] = (stats.issuesByType['Invalid Range'] || 0) + 1;
    }

    // Validate Zip Code
    if (!validateZipCode(record['zip code '])) {
      issues.push({
        opportunityId: oppId,
        address: address,
        field: 'zip code',
        value: record['zip code '],
        issue: 'Invalid zip code format'
      });
      hasIssue = true;
      stats.issuesByField['zip code'] = (stats.issuesByField['zip code'] || 0) + 1;
      stats.issuesByType['Invalid Format'] = (stats.issuesByType['Invalid Format'] || 0) + 1;
    }

    // Validate State
    if (!validateState(record['State '])) {
      issues.push({
        opportunityId: oppId,
        address: address,
        field: 'State',
        value: record['State '],
        issue: 'Invalid state code (must be 2 letters)'
      });
      hasIssue = true;
      stats.issuesByField['State'] = (stats.issuesByField['State'] || 0) + 1;
      stats.issuesByType['Invalid Format'] = (stats.issuesByType['Invalid Format'] || 0) + 1;
    }

    if (hasIssue) {
      stats.recordsWithIssues++;
    }
  }

  // Print Report
  console.log('='.repeat(80));
  console.log('📊 DATA QUALITY VALIDATION REPORT');
  console.log('='.repeat(80) + '\n');

  console.log(`Total Records:           ${stats.totalRecords}`);
  console.log(`Records with Issues:     ${stats.recordsWithIssues} (${((stats.recordsWithIssues / stats.totalRecords) * 100).toFixed(1)}%)`);
  console.log(`Records Clean:           ${stats.totalRecords - stats.recordsWithIssues} (${(((stats.totalRecords - stats.recordsWithIssues) / stats.totalRecords) * 100).toFixed(1)}%)`);
  console.log(`Total Issues Found:      ${issues.length}\n`);

  console.log('='.repeat(80));
  console.log('❌ ISSUES BY FIELD');
  console.log('='.repeat(80) + '\n');

  const sortedByField = Object.entries(stats.issuesByField).sort((a, b) => b[1] - a[1]);
  sortedByField.forEach(([field, count]) => {
    const percentage = ((count / stats.totalRecords) * 100).toFixed(1);
    console.log(`  ${field.padEnd(25)} → ${count} issues (${percentage}%)`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('⚠️  ISSUES BY TYPE');
  console.log('='.repeat(80) + '\n');

  const sortedByType = Object.entries(stats.issuesByType).sort((a, b) => b[1] - a[1]);
  sortedByType.forEach(([type, count]) => {
    console.log(`  ${type.padEnd(25)} → ${count} issues`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('📋 EXAMPLE ISSUES (First 20)');
  console.log('='.repeat(80) + '\n');

  issues.slice(0, 20).forEach((issue, i) => {
    console.log(`${i + 1}. ${issue.opportunityId} - ${issue.address}`);
    console.log(`   Field: ${issue.field}`);
    console.log(`   Value: "${issue.value}"`);
    console.log(`   Issue: ${issue.issue}`);
    console.log();
  });

  if (issues.length > 20) {
    console.log(`... and ${issues.length - 20} more issues\n`);
  }

  console.log('='.repeat(80));

  if (stats.recordsWithIssues === 0) {
    console.log('✅ DATA QUALITY CHECK PASSED - All records are valid!');
  } else {
    console.log('⚠️  DATA QUALITY ISSUES FOUND');
    console.log('\nRecommendation: Review and fix these issues before importing.');
    console.log('Note: Some fields (like year, state) might be intentionally empty.');
  }

  console.log('='.repeat(80) + '\n');

  // Write detailed report to file
  if (issues.length > 0) {
    const reportPath = '/Users/abdullahabunasrah/Desktop/ownerfi/CSV_DATA_QUALITY_ISSUES.json';
    fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
    console.log(`📝 Detailed issues saved to: CSV_DATA_QUALITY_ISSUES.json\n`);
  }
}

validateCSVData()
  .then(() => {
    console.log('✅ Validation complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
