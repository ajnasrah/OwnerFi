import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testNewExtraction() {
  console.log('🔍 Testing UPDATED extraction logic...\n');

  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
  const actorId = 'maxcopell/zillow-detail-scraper';

  // Test with property that previously had no contact info
  const testUrl = 'https://www.zillow.com/homedetails/6515-Mayhill-Ct-Spring-Hill-FL-34606/44822781_zpid/';

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

  // ===== NEW EXTRACTION LOGIC (SAME AS UPDATED CODE) =====

  // Construct full URL
  let fullUrl = apifyData.url || '';
  if (!fullUrl || !fullUrl.startsWith('http')) {
    if (apifyData.hdpUrl) {
      fullUrl = `https://www.zillow.com${apifyData.hdpUrl}`;
    } else if (apifyData.zpid) {
      fullUrl = `https://www.zillow.com/homedetails/${apifyData.zpid}_zpid/`;
    }
  }

  // Try attributionInfo first
  let agentPhone = apifyData.attributionInfo?.agentPhoneNumber
    || apifyData.agentPhoneNumber
    || apifyData.agentPhone
    || '';

  // If not found, try contactFormRenderData (nested structure)
  if (!agentPhone && apifyData.contactFormRenderData?.data?.agent_module?.phone) {
    const phoneObj = apifyData.contactFormRenderData.data.agent_module.phone;
    if (phoneObj.areacode && phoneObj.prefix && phoneObj.number) {
      agentPhone = `${phoneObj.areacode}-${phoneObj.prefix}-${phoneObj.number}`;
    }
  }

  const brokerPhone = apifyData.attributionInfo?.brokerPhoneNumber
    || apifyData.brokerPhoneNumber
    || apifyData.brokerPhone
    || '';

  const finalAgentPhone = agentPhone || brokerPhone;

  const agentName = apifyData.attributionInfo?.agentName
    || apifyData.agentName
    || apifyData.listingAgent
    || (Array.isArray(apifyData.attributionInfo?.listingAgents) && apifyData.attributionInfo.listingAgents[0]?.memberFullName)
    || apifyData.contactFormRenderData?.data?.agent_module?.display_name
    || '';

  console.log('📊 EXTRACTION RESULTS:\n');
  console.log(`✓ Full URL: ${fullUrl}`);
  console.log(`✓ Agent Name: ${agentName || '❌ NOT FOUND'}`);
  console.log(`✓ Agent Phone: ${agentPhone || '❌ NOT FOUND'}`);
  console.log(`✓ Broker Phone: ${brokerPhone || '❌ NOT FOUND'}`);
  console.log(`✓ Final Agent Phone: ${finalAgentPhone || '❌ NOT FOUND'}`);

  if (finalAgentPhone) {
    console.log('\n🎉 SUCCESS! Contact information NOW extracted with updated logic!');
  } else {
    console.log('\n⚠️ Still no contact info - this property legitimately has none');

    // Debug: show what's in contactFormRenderData
    if (apifyData.contactFormRenderData?.data?.agent_module) {
      console.log('\n🔍 contactFormRenderData.data.agent_module structure:');
      console.log(JSON.stringify(apifyData.contactFormRenderData.data.agent_module, null, 2));
    }
  }
}

testNewExtraction()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
