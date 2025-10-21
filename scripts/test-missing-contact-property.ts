import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testMissingContactProperty() {
  console.log('🔍 Testing property that has NO contact info in database...\n');

  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
  const actorId = 'maxcopell/zillow-detail-scraper';

  // Test with property that has no contact info in database
  const testUrl = 'https://www.zillow.com/homedetails/6515-Mayhill-Ct-Spring-Hill-FL-34606/44822781_zpid/';

  console.log(`🚀 Scraping: ${testUrl}`);
  console.log('   (This property has NO contact info in our database)\n');

  const input = { startUrls: [{ url: testUrl }] };
  const run = await client.actor(actorId).call(input);

  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    clean: false,
    limit: 1,
  });

  if (items.length === 0) {
    console.log('❌ No data returned from Apify');
    return;
  }

  const apifyData = items[0];

  console.log('📦 CHECKING ATTRIBUTION INFO:\n');
  if (!apifyData.attributionInfo) {
    console.log('❌ attributionInfo is NULL/MISSING!');
    console.log('\nThis is why we have no contact info for this property.');
  } else {
    console.log('✓ attributionInfo exists:');
    console.log(JSON.stringify(apifyData.attributionInfo, null, 2));
  }

  console.log('\n=== WHAT OUR EXTRACTION FINDS ===\n');

  const agentPhone = apifyData.attributionInfo?.agentPhoneNumber
    || apifyData.agentPhoneNumber
    || apifyData.agentPhone
    || '';

  const brokerPhone = apifyData.attributionInfo?.brokerPhoneNumber
    || apifyData.brokerPhoneNumber
    || apifyData.brokerPhone
    || '';

  const finalAgentPhone = agentPhone || brokerPhone;

  const agentName = apifyData.attributionInfo?.agentName
    || apifyData.agentName
    || apifyData.listingAgent
    || (Array.isArray(apifyData.attributionInfo?.listingAgents) && apifyData.attributionInfo.listingAgents[0]?.memberFullName)
    || '';

  const brokerName = apifyData.attributionInfo?.brokerName
    || apifyData.brokerName
    || apifyData.brokerageName
    || (Array.isArray(apifyData.attributionInfo?.listingOffices) && apifyData.attributionInfo.listingOffices[0]?.officeName)
    || '';

  console.log(`Agent Name: ${agentName || '❌ NOT FOUND'}`);
  console.log(`Agent Phone: ${agentPhone || '❌ NOT FOUND'}`);
  console.log(`Broker Name: ${brokerName || '❌ NOT FOUND'}`);
  console.log(`Broker Phone: ${brokerPhone || '❌ NOT FOUND'}`);
  console.log(`Final Agent Phone: ${finalAgentPhone || '❌ NOT FOUND'}`);

  if (!finalAgentPhone) {
    console.log('\n⚠️ CONCLUSION: Apify does NOT have contact info for this property');
    console.log('This is expected for some listings (FSBO, expired, etc.)');

    // Search for any phone-like values
    console.log('\n🔎 Searching entire response for any phone numbers...');
    const phoneFields = findPhoneFields(apifyData);
    if (phoneFields.length > 0) {
      console.log('📞 Found these phone-related fields:');
      phoneFields.forEach(field => console.log(`   - ${field.path}: ${field.value}`));
    } else {
      console.log('❌ No phone numbers found anywhere in the response');
    }
  } else {
    console.log('\n✅ Contact info FOUND! Something is wrong with our saving logic.');
  }
}

function findPhoneFields(obj: any, path: string = ''): Array<{path: string, value: any}> {
  const results: Array<{path: string, value: any}> = [];

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (key.toLowerCase().includes('phone') && value) {
      results.push({ path: currentPath, value });
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      results.push(...findPhoneFields(value, currentPath));
    }
  }

  return results;
}

testMissingContactProperty()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
