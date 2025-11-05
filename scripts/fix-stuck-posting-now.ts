#!/usr/bin/env tsx

/**
 * Manually trigger the process-video endpoint for stuck workflows
 * This bypasses Firestore client SDK issues
 */

// Get these from the admin dashboard or Firestore
const stuckWorkflows = [
  {
    address: '9938 W Century Dr',
    // We'll need to get the actual workflow ID
  },
  {
    address: '140 Great Oaks Blvd',
  },
  {
    address: '4955 Flat Creek Rd',
  },
  {
    address: '9 Apple Tree Cir',
  },
];

async function triggerProcessing() {
  console.log('🔄 Triggering process-video endpoint for stuck workflows...\n');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

  // First, let's just trigger the failsafe cron which should process all stuck workflows
  console.log('📡 Triggering failsafe cron job...');

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('❌ CRON_SECRET not found in environment');
    console.log('\nPlease run the failsafe cron manually:');
    console.log(`curl -X POST ${baseUrl}/api/cron/failsafe -H "Authorization: Bearer YOUR_CRON_SECRET"`);
    process.exit(1);
  }

  try {
    const response = await fetch(`${baseUrl}/api/cron/failsafe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Failsafe cron triggered successfully!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      const errorText = await response.text();
      console.error(`❌ Failed: ${response.status} - ${errorText}`);
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }
}

triggerProcessing();
