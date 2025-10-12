// Test Metricool API with brand routing
const fetch = require('node-fetch');

const METRICOOL_API_KEY = 'CWYJZYORLGMQRYGAJHAGICULMYKTNPEYBWHGDXICJQMHSAGMJUXFKEECTBURNSXZ';
const METRICOOL_USER_ID = '2946453';
const METRICOOL_CARZ_BRAND_ID = '4562985';
const METRICOOL_OWNERFI_BRAND_ID = '4562987';

async function testMetricoolPost(brand) {
  const brandId = brand === 'carz' ? METRICOOL_CARZ_BRAND_ID : METRICOOL_OWNERFI_BRAND_ID;
  const brandName = brand === 'carz' ? 'Carz Inc' : 'OwnerFi';

  console.log(`\n🧪 Testing ${brandName} (Brand ID: ${brandId})...`);

  try {
    const response = await fetch(`https://app.metricool.com/api/v2/scheduler/posts?blogId=${brandId}&userId=${METRICOOL_USER_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mc-Auth': METRICOOL_API_KEY
      },
      body: JSON.stringify({
        text: `TEST POST for ${brandName} - Please ignore this test 🔥`,
        publicationDate: {
          dateTime: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
          timezone: 'America/New_York'
        },
        providers: [
          { network: 'instagram' },
          { network: 'tiktok' },
          { network: 'youtube' },
          { network: 'facebook' },
          { network: 'linkedin' },
          { network: 'threads' }
        ],
        media: [{
          url: 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/d4e569b142034fd5b97ea4f7aa6da05f.mp4'
        }],
        youtubeData: {
          title: `TEST POST for ${brandName} - Please ignore`,
          privacy: 'PUBLIC',
          madeForKids: false,
          category: brand === 'carz' ? 'AUTOS_VEHICLES' : 'NEWS_POLITICS'
        }
      })
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    const text = await response.text();
    console.log('Response:', text);

    let data;
    try {
      data = JSON.parse(text);
      console.log('Parsed:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Not JSON, raw text:', text.substring(0, 500));
    }

    if (response.ok) {
      console.log(`✅ ${brandName} test PASSED!`);
    } else {
      console.log(`❌ ${brandName} test FAILED!`);
    }

    return response.ok;
  } catch (error) {
    console.error(`❌ Error testing ${brandName}:`, error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing Metricool Multi-Brand API Integration\n');
  console.log('API Key:', METRICOOL_API_KEY.substring(0, 20) + '...');
  console.log('User ID:', METRICOOL_USER_ID);

  const carzResult = await testMetricoolPost('carz');
  const ownerfiResult = await testMetricoolPost('ownerfi');

  console.log('\n📊 Results:');
  console.log(`  Carz Inc: ${carzResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  OwnerFi: ${ownerfiResult ? '✅ PASS' : '❌ FAIL'}`);
}

runTests();
