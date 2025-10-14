#!/usr/bin/env node
// Complete both failed workflows by re-triggering Submagic webhooks

const workflows = [
  {
    title: 'Government Shutdown Housing',
    submagicId: '03e4ac9b-c03' // Partial ID - need full one
  },
  {
    title: 'Kubota Hydrogen Tractor',
    submagicId: '41fb93e2-931' // Partial ID - need full one
  }
];

console.log('🎬 Completing failed workflows...\n');
console.log('Both workflows completed Submagic but failed at Metricool posting.');
console.log('The LinkedIn visibility error is now fixed.\n');

console.log('⚠️  I need the FULL Submagic project IDs to complete these.');
console.log('The IDs shown are truncated. Please provide the complete IDs.\n');

console.log('To get the full IDs, you can:');
console.log('1. Check the workflow details in your dashboard');
console.log('2. Or run this command to find them:\n');
console.log('   node check-workflows.mjs\n');

console.log('Once you have the full IDs, I can trigger the webhooks to retry posting.');
