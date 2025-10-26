#!/usr/bin/env npx tsx
// Test script to trigger podcast generation workflow

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

async function testPodcast() {
  console.log('🎙️ Testing Podcast Generation Workflow\n');

  try {
    // Load environment variables from .env.local
    config({ path: '.env.local' });

    const CRON_SECRET = process.env.CRON_SECRET;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

    console.log(`Base URL: ${baseUrl}`);

    if (!CRON_SECRET) {
      console.error('❌ CRON_SECRET not found in environment');
      console.log('\nAvailable env vars:', Object.keys(process.env).filter(k => k.includes('CRON')));
      process.exit(1);
    }

    console.log(`CRON_SECRET: ${CRON_SECRET.substring(0, 10)}...\n`);

    // Trigger podcast cron with force flag
    const url = `${baseUrl}/api/podcast/cron?force=true`;
    console.log(`📡 Calling: ${url}\n`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'User-Agent': 'test-script'
      }
    });

    console.log(`Status: ${response.status} ${response.statusText}\n`);

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ Podcast generation started!');
      console.log(`   Episode: #${data.episode.number}`);
      console.log(`   Title: ${data.episode.title}`);
      console.log(`   Guest: ${data.episode.guest}`);
      console.log(`   Video ID: ${data.episode.video_id}`);
      console.log(`   Workflow ID: ${data.episode.workflow_id}`);
      console.log('\n📊 Monitor progress at: https://ownerfi.ai/admin/social-dashboard');
    } else {
      console.error('\n❌ Podcast generation failed:', data.error);
      if (data.details) {
        console.error('   Details:', data.details);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testPodcast();
