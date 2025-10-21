#!/usr/bin/env node

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
const projectId = '4f71a86f-6c9a-4304-94e7-27eeff0ed16e';

async function checkProject() {
  const response = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
    headers: { 'x-api-key': SUBMAGIC_API_KEY }
  });

  const data = await response.json();
  console.log('Full Submagic Response:');
  console.log(JSON.stringify(data, null, 2));
}

checkProject().catch(console.error);
