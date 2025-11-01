#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

const LATE_API_KEY = process.env.LATE_API_KEY;
const CARZ_PROFILE_ID = process.env.LATE_CARZ_PROFILE_ID;

async function test() {
  const response = await fetch(`https://getlate.dev/api/v1/queue/slots?profileId=${CARZ_PROFILE_ID}`, {
    headers: {
      'Authorization': `Bearer ${LATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

test();
