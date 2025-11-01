import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

interface CSVProperty {
  'Opportunity ID': string;
  'Opportunity Name': string;
  'stage': string;
  'Property Address': string;
  'description': string;
  'Created on': string;
  'Updated on': string;
}

function checkRejectionPatterns() {
  console.log('🔍 Checking for GHL webhook rejection patterns...\n');

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

  const problematicPatterns: Record<string, any[]> = {
    'Asterisks': [],
    'EmDash': [],
    'EnDash': [],
    'SmartQuotes': [],
    'SmartApostrophes': [],
    'Ellipsis': [],
    'DegreeSymbol': [],
    'Trademark': [],
    'BulletPoints': []
  };

  for (const prop of exportedProperties) {
    const desc = prop.description || '';
    const oppId = prop['Opportunity ID'];
    const address = prop['Property Address'];

    // Check for each pattern
    if (/\*/.test(desc)) {
      problematicPatterns['Asterisks'].push({ oppId, address, match: desc.match(/\*+[^*]*\*+/)?.[0] || '*' });
    }
    if (/—/.test(desc)) {
      problematicPatterns['EmDash'].push({ oppId, address });
    }
    if (/–/.test(desc)) {
      problematicPatterns['EnDash'].push({ oppId, address });
    }
    if (/[""]/.test(desc)) {
      problematicPatterns['SmartQuotes'].push({ oppId, address });
    }
    if (/['']/.test(desc)) {
      problematicPatterns['SmartApostrophes'].push({ oppId, address });
    }
    if (/…/.test(desc)) {
      problematicPatterns['Ellipsis'].push({ oppId, address });
    }
    if (/°/.test(desc)) {
      problematicPatterns['DegreeSymbol'].push({ oppId, address });
    }
    if (/[™®]/.test(desc)) {
      problematicPatterns['Trademark'].push({ oppId, address });
    }
    if (/[•·]/.test(desc)) {
      problematicPatterns['BulletPoints'].push({ oppId, address });
    }
  }

  console.log('📋 PROBLEMATIC PATTERNS FOUND:\n');
  console.log('='.repeat(80));

  Object.entries(problematicPatterns).forEach(([pattern, properties]) => {
    if (properties.length > 0) {
      console.log(`\n${pattern}: ${properties.length} properties`);
      console.log('-'.repeat(80));

      properties.slice(0, 5).forEach((prop, idx) => {
        console.log(`  ${idx + 1}. ${prop.address}`);
        console.log(`     Opportunity ID: ${prop.oppId}`);
        if (prop.match) {
          console.log(`     Example: "${prop.match}"`);
        }
      });

      if (properties.length > 5) {
        console.log(`     ... and ${properties.length - 5} more`);
      }
    }
  });

  // Find the 3 missing properties specifically
  const missingOppIds = ['3UkFKDwjcnzChe75SdHc', 'AXu6fUYcdMgUYSlgQII5', 'VFFVan1Gq7e7DA4i8vIR'];
  console.log('\n' + '='.repeat(80));
  console.log('\n🚨 ANALYSIS OF THE 3 MISSING PROPERTIES:\n');

  for (const oppId of missingOppIds) {
    const prop = exportedProperties.find(p => p['Opportunity ID'] === oppId);
    if (prop) {
      const desc = prop.description || '';
      console.log(`\n${prop['Property Address']}`);
      console.log(`Opportunity ID: ${oppId}`);
      console.log(`Created: ${prop['Created on']}`);
      console.log(`Description length: ${desc.length} chars`);

      const patterns = [];
      if (/\*/.test(desc)) patterns.push('Asterisks');
      if (/—/.test(desc)) patterns.push('Em dash');
      if (/–/.test(desc)) patterns.push('En dash');
      if (/[""]/.test(desc)) patterns.push('Smart quotes');
      if (/['']/.test(desc)) patterns.push('Smart apostrophes');
      if (/…/.test(desc)) patterns.push('Ellipsis');

      console.log(`Problematic patterns: ${patterns.length > 0 ? patterns.join(', ') : 'None found'}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n💡 LIKELY REASON FOR REJECTION:\n');
  console.log('These properties have special Unicode characters (em dashes, asterisks, etc.)');
  console.log('that GHL may not handle properly in webhook headers or body.');
  console.log('\nThe description sanitizer we created will fix these issues going forward,');
  console.log('but these 3 were likely rejected before the sanitizer was in place.\n');
}

checkRejectionPatterns();
