#!/usr/bin/env npx tsx
/**
 * Real County Assessor URLs and Tax Lookup Instructions
 * 
 * Provides actual assessor websites for manual tax lookup
 */

import * as fs from 'fs/promises';

interface PropertyTaxLookup {
  zpid: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  price: number;
  assessorWebsite: string;
  searchInstructions: string;
  estimatedTaxRange: string;
}

async function generateRealAssessorLookups() {
  console.log('=== REAL COUNTY ASSESSOR WEBSITES FOR TAX LOOKUP ===\n');
  
  const properties: PropertyTaxLookup[] = [
    {
      zpid: '333384174',
      address: '9385 Pocida CT #101',
      city: 'Naples',
      state: 'FL',
      zip: '34119',
      county: 'Collier County',
      price: 494977,
      assessorWebsite: 'https://www.collierpao.gov/',
      searchInstructions: 'Use "Property Search" > Enter address or parcel number',
      estimatedTaxRange: '$2,500 - $12,500 (0.5% - 2.5%)'
    },
    {
      zpid: '2060763121',
      address: '17 Pepperwood Way',
      city: 'Soquel',
      state: 'CA',
      zip: '95073',
      county: 'Santa Cruz County',
      price: 398000,
      assessorWebsite: 'https://assessor.santacruzcounty.us/',
      searchInstructions: 'Use "Property Tax Information" > Search by address',
      estimatedTaxRange: '$4,000 - $8,000 (1.0% - 2.0%)'
    },
    {
      zpid: '62865966',
      address: '8723 Carrollwood Cv N',
      city: 'Cordova',
      state: 'TN',
      zip: '38016',
      county: 'Shelby County',
      price: 225000,
      assessorWebsite: 'https://assessor.shelby.tn.us/',
      searchInstructions: 'Property Search > Enter address for current tax assessment',
      estimatedTaxRange: '$1,500 - $3,500 (0.67% - 1.5%)'
    },
    {
      zpid: '2068091278',
      address: '1194 State Hwy 12 #49',
      city: 'Montesano',
      state: 'WA',
      zip: '98563',
      county: 'Grays Harbor County',
      price: 47500,
      assessorWebsite: 'https://www.co.grays-harbor.wa.us/assessor',
      searchInstructions: 'Property Information Search > Address lookup',
      estimatedTaxRange: '$400 - $600 (0.88% rate)'
    },
    {
      zpid: '2126285116',
      address: '9402 Beech Park St',
      city: 'Capitol Heights',
      state: 'MD',
      zip: '20743',
      county: 'Prince Georges County',
      price: 79900,
      assessorWebsite: 'https://www.princegeorgescountymd.gov/1327/Real-Property-Assessment',
      searchInstructions: 'Property Search > Enter address for assessment and tax info',
      estimatedTaxRange: '$800 - $1,200 (1.06% rate)'
    },
    {
      zpid: '456181091',
      address: '530 New Ave SW',
      city: 'Grand Rapids',
      state: 'MI',
      zip: '49503',
      county: 'Kent County',
      price: 231700,
      assessorWebsite: 'https://www.accesskent.com/Departments/Equalization/',
      searchInstructions: 'Property Search > Address search for taxable value',
      estimatedTaxRange: '$3,500 - $4,500 (1.64% rate)'
    },
    {
      zpid: '2101498979',
      address: '18741 SW 344th Dr',
      city: 'Homestead',
      state: 'FL',
      zip: '33034',
      county: 'Miami-Dade County',
      price: 125000,
      assessorWebsite: 'https://www.miamidade.gov/propertyappraiser/',
      searchInstructions: 'Property Search > Enter address for current assessment',
      estimatedTaxRange: '$1,000 - $2,500 (0.83% rate)'
    },
    {
      zpid: '44809945',
      address: '8568 Heather Blvd',
      city: 'Weeki Wachee',
      state: 'FL',
      zip: '34613',
      county: 'Hernando County',
      price: 249900,
      assessorWebsite: 'https://www.hernandocounty.us/departments/departments-a-c/county-appraiser',
      searchInstructions: 'Property Information > Address search',
      estimatedTaxRange: '$2,000 - $4,000 (0.83% rate)'
    },
    {
      zpid: '460213806',
      address: '7152 Crowder Blvd',
      city: 'New Orleans',
      state: 'LA',
      zip: '70126',
      county: 'Orleans Parish',
      price: 97000,
      assessorWebsite: 'https://nola.gov/assessor/',
      searchInstructions: 'Property Search > Enter address for assessment information',
      estimatedTaxRange: '$500 - $1,000 (0.55% rate)'
    },
    {
      zpid: '58511348',
      address: '204 Wynnfield Way',
      city: 'McDonough',
      state: 'GA',
      zip: '30252',
      county: 'Henry County',
      price: 333750,
      assessorWebsite: 'https://www.henrycounty-ga.com/government/departments-services/tax-commissioner',
      searchInstructions: 'Property Tax Search > Enter address',
      estimatedTaxRange: '$3,000 - $4,000 (0.89% rate)'
    },
    {
      zpid: '193905590',
      address: '1608 Backus St',
      city: 'Paducah',
      state: 'TX',
      zip: '79248',
      county: 'Cottle County',
      price: 35000,
      assessorWebsite: 'https://www.cottlecad.org/',
      searchInstructions: 'Property Search > Enter address for appraisal information',
      estimatedTaxRange: '$600 - $900 (1.69% rate)'
    },
    {
      zpid: '443424247',
      address: '3200 N Port Royale Dr N #511',
      city: 'Fort Lauderdale',
      state: 'FL',
      zip: '33308',
      county: 'Broward County',
      price: 370000,
      assessorWebsite: 'https://www.bcpa.net/',
      searchInstructions: 'Property Search > Address lookup for current assessment',
      estimatedTaxRange: '$3,000 - $6,000 (0.83% rate)'
    },
    {
      zpid: '2071497189',
      address: '1375 Pasadena Ave S LOT 511',
      city: 'Saint Petersburg',
      state: 'FL',
      zip: '33707',
      county: 'Pinellas County',
      price: 69999,
      assessorWebsite: 'https://www.pcpao.org/',
      searchInstructions: 'Property Search > Enter address for property details',
      estimatedTaxRange: '$600 - $1,200 (0.83% rate)'
    }
  ];
  
  console.log('Generated real county assessor websites for all 13 properties\n');
  
  // Create detailed manual lookup instructions
  let instructions = '# REAL COUNTY ASSESSOR TAX LOOKUP GUIDE\n\n';
  instructions += 'Use these **actual** county assessor websites to find property tax amounts:\n\n';
  instructions += '## Quick Reference Summary\n';
  instructions += '| ZPID | Address | County | Estimated Tax |\n';
  instructions += '|------|---------|--------|---------------|\n';
  
  properties.forEach(prop => {
    instructions += `| ${prop.zpid} | ${prop.address} | ${prop.county} | ${prop.estimatedTaxRange} |\n`;
  });
  
  instructions += '\n## Detailed Lookup Instructions\n\n';
  
  properties.forEach((prop, i) => {
    instructions += `### ${i + 1}. ZPID ${prop.zpid} - ${prop.address}\n`;
    instructions += `**Location:** ${prop.city}, ${prop.state} ${prop.zip}\n`;
    instructions += `**County:** ${prop.county}\n`;
    instructions += `**Price:** $${prop.price.toLocaleString()}\n`;
    instructions += `**Assessor Website:** [${prop.assessorWebsite}](${prop.assessorWebsite})\n`;
    instructions += `**Instructions:** ${prop.searchInstructions}\n`;
    instructions += `**Expected Tax Range:** ${prop.estimatedTaxRange}\n`;
    instructions += `**What to look for:** Annual property tax, tax bill amount, current year assessment\n\n`;
    instructions += '---\n\n';
  });
  
  instructions += '## General Tips for Tax Lookup\n\n';
  instructions += '1. **Search Methods:** Try address search first, then parcel number if available\n';
  instructions += '2. **Tax vs Assessment:** Look for "Annual Tax" or "Tax Bill" not just assessed value\n';
  instructions += '3. **Current Year:** Make sure you\'re looking at 2025/2026 tax amounts\n';
  instructions += '4. **Homestead Exemption:** Note if property has homestead exemption (affects taxes)\n';
  instructions += '5. **Monthly Calculation:** Divide annual tax by 12 for monthly amount\n\n';
  
  instructions += '## Expected Results Template\n\n';
  instructions += '```csv\n';
  instructions += 'ZPID,Annual Tax Found,Monthly Tax,Source Website\n';
  properties.forEach(prop => {
    instructions += `${prop.zpid},ENTER_AMOUNT_HERE,ANNUAL/12,${prop.assessorWebsite}\n`;
  });
  instructions += '```\n';
  
  const timestamp = new Date().toISOString().split('T')[0];
  const instructionsFile = `REAL_county_assessor_lookup_guide_${timestamp}.md`;
  
  await fs.writeFile(instructionsFile, instructions);
  
  // Also create a quick lookup CSV
  const csvFile = `quick_assessor_lookup_${timestamp}.csv`;
  const csvHeaders = 'ZPID,Address,City,State,ZIP,County,Price,Assessor Website,Estimated Tax Range';
  const csvRows = properties.map(p => 
    `${p.zpid},"${p.address}","${p.city}",${p.state},${p.zip},"${p.county}",${p.price},${p.assessorWebsite},"${p.estimatedTaxRange}"`
  );
  
  await fs.writeFile(csvFile, csvHeaders + '\n' + csvRows.join('\n'));
  
  console.log('📋 MANUAL TAX LOOKUP SUMMARY:\n');
  
  // Group by state for efficiency
  const byState = properties.reduce((acc, prop) => {
    if (!acc[prop.state]) acc[prop.state] = [];
    acc[prop.state].push(prop);
    return acc;
  }, {} as Record<string, PropertyTaxLookup[]>);
  
  Object.entries(byState).forEach(([state, props]) => {
    console.log(`🏛️  ${state} (${props.length} properties):`);
    props.forEach(prop => {
      console.log(`   • ZPID ${prop.zpid}: ${prop.address} (${prop.county})`);
      console.log(`     ${prop.assessorWebsite}`);
      console.log(`     Expected: ${prop.estimatedTaxRange}\n`);
    });
  });
  
  console.log(`✅ Complete guide saved to: ${instructionsFile}`);
  console.log(`✅ Quick reference saved to: ${csvFile}`);
  console.log(`\n🎯 NEXT STEPS:`);
  console.log(`1. Open the markdown guide for detailed instructions`);
  console.log(`2. Visit each county assessor website`);
  console.log(`3. Search for property tax by address`);
  console.log(`4. Record annual tax amounts`);
  console.log(`5. Update your cash flow analysis with real tax data`);
  
  // Estimate time and priority
  const totalEstimatedTax = properties.reduce((sum, prop) => {
    const midRange = prop.price * 0.015; // 1.5% average
    return sum + midRange;
  }, 0);
  
  console.log(`\n💰 ESTIMATED TOTAL ANNUAL TAXES: $${Math.round(totalEstimatedTax).toLocaleString()}`);
  console.log(`📊 ESTIMATED TOTAL MONTHLY TAXES: $${Math.round(totalEstimatedTax/12).toLocaleString()}`);
  console.log(`⏱️  ESTIMATED LOOKUP TIME: 30-45 minutes (2-3 min per property)`);
  
  // Priority order by potential tax impact
  const priorityOrder = [...properties].sort((a, b) => b.price - a.price);
  console.log(`\n🔥 PRIORITY ORDER (highest value first):`);
  priorityOrder.slice(0, 5).forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address} ($${prop.price.toLocaleString()}) - ${prop.county}`);
  });
}

generateRealAssessorLookups().catch(console.error);