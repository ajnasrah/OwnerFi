#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env.local') });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function analyzeIDs() {
  const response = await fetch('https://api.heygen.com/v1/talking_photo.list', {
    headers: { 'accept': 'application/json', 'x-api-key': HEYGEN_API_KEY }
  });

  const data = await response.json();
  const photos = data.data || [];

  console.log('📊 Analyzing talking photo ID formats:\n');
  
  // Sample IDs
  console.log('Sample IDs (first 10):');
  photos.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.id} (length: ${p.id.length})`);
  });

  // Check if any match the pattern of user's IDs
  console.log('\n🔍 Searching for IDs matching user patterns:');
  const patterns = [
    /^5eb1adac/,
    /^c308729a/,
    /^1732832799$/,
    /^711a1d39/,
    /^1727676442$/,
    /^1375223b/
  ];

  patterns.forEach((pattern, i) => {
    const matches = photos.filter(p => pattern.test(p.id));
    console.log(`  Pattern ${i + 1} (${pattern}): ${matches.length} matches`);
    if (matches.length > 0) {
      matches.slice(0, 3).forEach(m => {
        console.log(`    - ${m.id}`);
      });
    }
  });

  // Check for numeric-only IDs
  const numericIds = photos.filter(p => /^\d+$/.test(p.id));
  console.log(`\n🔢 Pure numeric IDs: ${numericIds.length}`);
  if (numericIds.length > 0) {
    console.log('  Samples:');
    numericIds.slice(0, 5).forEach(p => console.log(`    - ${p.id}`));
  }
}

analyzeIDs().catch(console.error);
