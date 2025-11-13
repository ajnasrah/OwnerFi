import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

async function diagnoseGHLOpportunities() {
  try {
    console.log('\n🔍 Diagnosing GoHighLevel Opportunities');
    console.log('='.repeat(80));

    if (!GHL_API_KEY || !GHL_LOCATION_ID) {
      console.log('❌ Missing GHL_API_KEY or GHL_LOCATION_ID in environment');
      return;
    }

    console.log(`\nLocation ID: ${GHL_LOCATION_ID}`);
    console.log(`API Key: ${GHL_API_KEY.substring(0, 10)}...`);

    // Fetch opportunities from GHL
    console.log('\n\n📋 Fetching recent opportunities from GoHighLevel...');
    console.log('='.repeat(80));

    const response = await fetch(
      `https://services.leadconnectorhq.com/opportunities/search?location_id=${GHL_LOCATION_ID}&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.log(`❌ GHL API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`Response: ${errorText}`);
      return;
    }

    const data = await response.json() as any;
    const opportunities = data.opportunities || [];

    console.log(`\n✅ Found ${opportunities.length} opportunities in GHL\n`);

    // Analyze opportunities created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysOpportunities = opportunities.filter((opp: any) => {
      const createdDate = new Date(opp.createdAt || opp.dateAdded);
      return createdDate >= today;
    });

    console.log(`📅 Opportunities created today: ${todaysOpportunities.length}\n`);

    if (todaysOpportunities.length === 0) {
      console.log('No opportunities were created today in GHL.');
      console.log('This explains why only 6 properties exist - they may be from previous days.\n');

      // Show recent opportunities
      const recentOpps = opportunities
        .sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || a.dateAdded);
          const dateB = new Date(b.createdAt || b.dateAdded);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 20);

      console.log('\n📊 20 Most Recent Opportunities:');
      console.log('='.repeat(80));
      recentOpps.forEach((opp: any, i: number) => {
        const createdDate = new Date(opp.createdAt || opp.dateAdded);
        console.log(`\n${i + 1}. ${opp.name || 'Unnamed'}`);
        console.log(`   ID: ${opp.id}`);
        console.log(`   Created: ${createdDate.toLocaleString()}`);
        console.log(`   Status: ${opp.status}`);
        console.log(`   Pipeline: ${opp.pipelineId}`);
      });

      return;
    }

    // Analyze today's opportunities for webhook compatibility
    console.log('\n🔬 Analyzing Today\'s Opportunities for Webhook Compatibility');
    console.log('='.repeat(80));

    let validCount = 0;
    let invalidCount = 0;

    todaysOpportunities.forEach((opp: any, i: number) => {
      console.log(`\n${i + 1}. ${opp.name || 'Unnamed Opportunity'}`);
      console.log(`   ID: ${opp.id}`);
      console.log(`   Created: ${new Date(opp.createdAt || opp.dateAdded).toLocaleString()}`);

      const customFields = opp.customFields || [];
      const getField = (name: string) => {
        const field = customFields.find((f: any) =>
          f.key?.toLowerCase() === name.toLowerCase() ||
          f.id?.toLowerCase() === name.toLowerCase()
        );
        return field?.value || '';
      };

      // Check required fields for webhook
      const propertyAddress = getField('propertyAddress') || getField('address') || opp.name;
      const propertyCity = getField('propertyCity') || getField('city');
      const state = getField('state');
      const price = parseFloat(String(getField('price') || '0').replace(/[$,]/g, ''));

      const validationErrors = [];
      if (!opp.id) validationErrors.push('Missing opportunityId');
      if (!propertyAddress || propertyAddress.trim().length === 0) validationErrors.push('Missing propertyAddress');
      if (!propertyCity || propertyCity.trim().length === 0) validationErrors.push('Missing propertyCity');
      if (!state) validationErrors.push('Missing state');
      if (!price || price <= 0) validationErrors.push('Missing or invalid price');

      if (validationErrors.length === 0) {
        console.log(`   ✅ VALID - Would pass webhook validation`);
        console.log(`      Address: ${propertyAddress}`);
        console.log(`      City: ${propertyCity}`);
        console.log(`      State: ${state}`);
        console.log(`      Price: $${price.toLocaleString()}`);
        validCount++;
      } else {
        console.log(`   ❌ INVALID - Would fail webhook validation`);
        validationErrors.forEach(err => console.log(`      - ${err}`));
        console.log(`      Custom Fields: ${customFields.map((f: any) => f.key || f.id).join(', ')}`);
        invalidCount++;
      }
    });

    console.log('\n\n📊 Summary');
    console.log('='.repeat(80));
    console.log(`Total opportunities today: ${todaysOpportunities.length}`);
    console.log(`Valid (would pass webhook): ${validCount}`);
    console.log(`Invalid (would fail webhook): ${invalidCount}`);

    if (invalidCount > 0) {
      console.log('\n\n💡 Common Issues:');
      console.log('='.repeat(80));
      console.log('1. Missing custom fields (propertyAddress, propertyCity, state, price)');
      console.log('2. Price field is empty or zero');
      console.log('3. Custom field names don\'t match expected names');
      console.log('\nTo fix: Ensure your GHL pipeline has these custom fields properly configured:');
      console.log('  - propertyAddress (or address)');
      console.log('  - propertyCity (or city)');
      console.log('  - state');
      console.log('  - price (must be > 0)');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

diagnoseGHLOpportunities();
