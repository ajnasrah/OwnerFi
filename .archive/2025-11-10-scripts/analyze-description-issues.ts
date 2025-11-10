import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { validateDescription } from '../src/lib/description-sanitizer';

interface CSVProperty {
  'Opportunity ID': string;
  'Opportunity Name': string;
  'stage': string;
  'Property Address': string;
  'description': string;
}

function analyzeDescriptions() {
  console.log('🔍 Analyzing descriptions for GHL webhook issues...\n');

  // Read CSV file
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities-2.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  const records: CSVProperty[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  // Filter for "exported to website" stage
  const exportedProperties = records.filter(r =>
    r.stage && r.stage.toLowerCase().trim() === 'exported to website'
  );

  console.log(`📊 Total "exported to website": ${exportedProperties.length}\n`);

  // Analyze each description
  const issues: any[] = [];
  let totalWithWarnings = 0;

  for (const prop of exportedProperties) {
    const desc = prop.description;

    if (!desc || desc.trim().length === 0) {
      continue;
    }

    // Check for problematic patterns
    const warnings = validateDescription(desc);

    // Additional GHL-specific checks
    const additionalIssues: string[] = [];

    // Check for asterisks (markdown emphasis)
    if (/\*{1,2}[^*]+\*{1,2}/.test(desc)) {
      additionalIssues.push('Contains asterisk emphasis (*text*)');
    }

    // Check for special quotes
    if (/[""'']/.test(desc)) {
      additionalIssues.push('Contains smart quotes');
    }

    // Check for unusual Unicode
    if (/[^\x00-\x7F]/.test(desc)) {
      const unicodeChars = desc.match(/[^\x00-\x7F]/g) || [];
      additionalIssues.push(`Contains ${unicodeChars.length} non-ASCII characters`);
    }

    // Check for control characters
    if (/[\x00-\x1F\x7F]/.test(desc)) {
      additionalIssues.push('Contains control characters');
    }

    // Check for very long descriptions
    if (desc.length > 2000) {
      additionalIssues.push(`Very long description (${desc.length} chars)`);
    }

    // Check for HTML entities
    if (/&[a-z]+;/i.test(desc)) {
      additionalIssues.push('Contains HTML entities');
    }

    // Check for excessive special characters
    const specialCharCount = (desc.match(/[^\w\s\.,;:!?()\-'"/&$%]/g) || []).length;
    if (specialCharCount > 50) {
      additionalIssues.push(`${specialCharCount} special characters`);
    }

    const allIssues = [...warnings, ...additionalIssues];

    if (allIssues.length > 0) {
      totalWithWarnings++;
      issues.push({
        opportunityId: prop['Opportunity ID'],
        address: prop['Property Address'],
        descriptionLength: desc.length,
        issues: allIssues,
        descriptionPreview: desc.substring(0, 100) + (desc.length > 100 ? '...' : '')
      });
    }
  }

  console.log(`⚠️  Properties with description warnings: ${totalWithWarnings}/${exportedProperties.length}\n`);
  console.log('='.repeat(80));

  // Group by issue type
  const issueTypes: Record<string, number> = {};
  issues.forEach(item => {
    item.issues.forEach((issue: string) => {
      issueTypes[issue] = (issueTypes[issue] || 0) + 1;
    });
  });

  console.log('\n📊 ISSUE BREAKDOWN:\n');
  Object.entries(issueTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([issue, count]) => {
      console.log(`   ${count.toString().padStart(3)} - ${issue}`);
    });

  console.log('\n' + '='.repeat(80));
  console.log('\n🚨 TOP 20 MOST PROBLEMATIC DESCRIPTIONS:\n');

  // Sort by number of issues
  const topIssues = issues
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 20);

  topIssues.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.address}`);
    console.log(`   Opportunity ID: ${item.opportunityId}`);
    console.log(`   Length: ${item.descriptionLength} chars`);
    console.log(`   Issues (${item.issues.length}): ${item.issues.join(', ')}`);
    console.log(`   Preview: "${item.descriptionPreview}"`);
    console.log('');
  });

  // Save detailed report
  const reportPath = '/Users/abdullahabunasrah/Desktop/ownerfi/scripts/description-issues-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
  console.log('='.repeat(80));
  console.log(`\n💾 Full report saved to: ${reportPath}\n`);
}

analyzeDescriptions();
