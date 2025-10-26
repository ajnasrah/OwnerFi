/**
 * Get full Submagic API response
 */

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
const projectId = 'af998ae2-b2ad-493e-9743-118ff319e9a1';

async function getFullResponse() {
  const response = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
    headers: {
      'x-api-key': SUBMAGIC_API_KEY!
    }
  });

  const data = await response.json();
  console.log('📦 Full Submagic Response:');
  console.log(JSON.stringify(data, null, 2));
}

getFullResponse().catch(console.error);
