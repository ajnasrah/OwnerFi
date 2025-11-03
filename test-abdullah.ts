// Test Abdullah endpoint
async function test() {
  console.log('Testing Abdullah endpoint without auth...\n');

  try {
    const res = await fetch('https://ownerfi.ai/api/workflow/complete-abdullah', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 1 })
    });

    console.log('Status:', res.status, res.statusText);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));

    const text = await res.text();
    console.log('\nResponse text:');
    console.log(text.substring(0, 500));

    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      console.log('\nParsed JSON:');
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('\nNot JSON - likely HTML error page');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
