/**
 * Test R2 bucket public access
 * This will help diagnose why Late.dev can't download videos
 */

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-2476f0809ce64c369348d90eb220788e.r2.dev';

async function testR2Access() {
  console.log('🔍 Testing R2 bucket public access...\n');
  console.log(`R2_PUBLIC_URL: ${R2_PUBLIC_URL}\n`);

  // Test 1: Root bucket access
  console.log('Test 1: Root bucket access');
  try {
    const response = await fetch(R2_PUBLIC_URL);
    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (response.status === 401) {
      console.log('   ❌ BUCKET IS PRIVATE - Public access is DISABLED');
      console.log('   Solution: Enable public access in Cloudflare R2 dashboard');
    } else if (response.status === 404) {
      console.log('   ℹ️  Bucket exists but directory listing disabled (normal)');
    } else if (response.ok) {
      console.log('   ✅ Bucket is publicly accessible');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  console.log('\n---\n');

  // Test 2: Try to access a test file
  console.log('Test 2: Test file access (will be 404 if file doesn\'t exist)');
  const testPath = `${R2_PUBLIC_URL}/test-file.txt`;
  try {
    const response = await fetch(testPath, { method: 'HEAD' });
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   URL: ${testPath}`);

    if (response.status === 401) {
      console.log('   ❌ CRITICAL: Public access is DISABLED on the bucket');
      console.log('   This is why ALL Late.dev posts are failing!');
      console.log('\n📋 FIX STEPS:');
      console.log('   1. Go to Cloudflare Dashboard');
      console.log('   2. Navigate to R2 → ownerfi-podcast-videos bucket');
      console.log('   3. Click Settings');
      console.log('   4. Under "Public Access", click "Allow Access"');
      console.log('   5. Confirm the pub-*.r2.dev subdomain is enabled');
    } else if (response.status === 404) {
      console.log('   ✅ Bucket is accessible (file just doesn\'t exist - expected)');
    } else if (response.ok) {
      console.log('   ✅ File is accessible');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  console.log('\n---\n');
  console.log('📊 Summary:');
  console.log('If you see 401 errors above, you MUST enable public access in R2.');
  console.log('If you see 404 errors, public access is working - files just don\'t exist.');
}

testR2Access().catch(console.error);
