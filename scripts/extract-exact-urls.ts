#!/usr/bin/env npx tsx
/**
 * Extract all 55 URLs from 4.30_target_zips.md and format for search config
 */

import * as fs from 'fs';

const docPath = '4.30_target_zips.md';
const content = fs.readFileSync(docPath, 'utf-8');

// Extract all URLs
const urlPattern = /https:\/\/www\.zillow\.com\/[^\s`]+/g;
const urls = content.match(urlPattern) || [];

console.log(`Found ${urls.length} URLs`);
console.log('\n// Use the exact URLs from 4.30_target_zips.md document (provided by user)');
console.log('const TARGETED_ZIP_URLS = [');

urls.forEach((url, index) => {
  // Extract zip code for comment
  const zipMatch = url.match(/(\d{5})/);
  const zip = zipMatch ? zipMatch[1] : 'unknown';
  
  console.log(`  '${url}',${index < urls.length - 1 ? '' : ''} // ${zip}`);
});

console.log('];');