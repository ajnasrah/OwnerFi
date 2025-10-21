import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function debugApifyExtraction() {
  console.log('🔍 Testing Apify data extraction with a sample URL...\n');

  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
  const actorId = 'maxcopell/zillow-detail-scraper';

  // Test with a single URL
  const testUrl = 'https://www.zillow.com/homedetails/1512-W-Millman-St-Peoria-IL-61605/5160487_zpid/';

  console.log(`🚀 Scraping: ${testUrl}\n`);

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

  console.log('📦 RAW APIFY RESPONSE:\n');
  console.log('=== ATTRIBUTION INFO ===');
  console.log(JSON.stringify(apifyData.attributionInfo, null, 2));

  console.log('\n=== TOP LEVEL AGENT FIELDS ===');
  console.log('agentName:', apifyData.agentName);
  console.log('agentPhoneNumber:', apifyData.agentPhoneNumber);
  console.log('agentPhone:', apifyData.agentPhone);
  console.log('agentEmail:', apifyData.agentEmail);
  console.log('listingAgent:', apifyData.listingAgent);

  console.log('\n=== TOP LEVEL BROKER FIELDS ===');
  console.log('brokerName:', apifyData.brokerName);
  console.log('brokerPhoneNumber:', apifyData.brokerPhoneNumber);
  console.log('brokerPhone:', apifyData.brokerPhone);
  console.log('brokerageName:', apifyData.brokerageName);

  console.log('\n=== WHAT OUR EXTRACTION FINDS ===');

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

  console.log('✓ agentName:', agentName || '❌ NOT FOUND');
  console.log('✓ agentPhone:', agentPhone || '❌ NOT FOUND');
  console.log('✓ brokerName:', brokerName || '❌ NOT FOUND');
  console.log('✓ brokerPhone:', brokerPhone || '❌ NOT FOUND');
  console.log('✓ finalAgentPhone:', finalAgentPhone || '❌ NOT FOUND');

  console.log('\n=== ALL AVAILABLE KEYS IN APIFY RESPONSE ===');
  console.log(Object.keys(apifyData).sort().join(', '));

  if (finalAgentPhone) {
    console.log('\n✅ SUCCESS: Contact information extracted correctly');
  } else {
    console.log('\n⚠️ WARNING: No contact information found');
    console.log('\nSearching for phone-like fields in the entire response...');
    const phoneFields = findPhoneFields(apifyData);
    if (phoneFields.length > 0) {
      console.log('📞 Found phone-like fields:');
      phoneFields.forEach(field => console.log(`   - ${field.path}: ${field.value}`));
    }
  }
}

function findPhoneFields(obj: any, path: string = ''): Array<{path: string, value: any}> {
  const results: Array<{path: string, value: any}> = [];

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    // Check if key contains 'phone' or 'Phone'
    if (key.toLowerCase().includes('phone') && value) {
      results.push({ path: currentPath, value });
    }

    // Recurse into objects (but not arrays or null)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      results.push(...findPhoneFields(value, currentPath));
    }
  }

  return results;
}

debugApifyExtraction()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
