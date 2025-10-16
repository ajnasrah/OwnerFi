/**
 * Debug Late API accounts structure
 */

require('dotenv').config();

const LATE_API_KEY = process.env.LATE_API_KEY;
const LATE_OWNERFI_PROFILE_ID = process.env.LATE_OWNERFI_PROFILE_ID;

async function debugAccounts() {
  console.log('🔍 Debugging Late API accounts structure\n');

  const response = await fetch(
    `https://getlate.dev/api/v1/accounts?profileId=${LATE_OWNERFI_PROFILE_ID}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();

  console.log('📊 Full Response:\n');
  console.log(JSON.stringify(data, null, 2));
}

debugAccounts();
