#!/usr/bin/env npx tsx

import { config } from 'dotenv';
config({ path: '.env.local' });

const LATE_API_KEY = process.env.LATE_API_KEY!;
const LATE_CARZ_PROFILE = process.env.LATE_CARZ_PROFILE_ID!;
const LATE_BENEFIT_PROFILE = process.env.LATE_BENEFIT_PROFILE_ID!;

async function postToLate(videoUrl: string, caption: string, brand: string) {
  const profileId = brand === 'carz' ? LATE_CARZ_PROFILE : LATE_BENEFIT_PROFILE;

  const response = await fetch('https://api.getlate.so/post', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': LATE_API_KEY
    },
    body: JSON.stringify({
      profileId,
      videoUrl,
      caption,
      platforms: ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads']
    })
  });

  return response.json();
}

async function forcePostAll() {
  const response = await fetch('https://ownerfi.ai/api/workflow/logs');
  const data = await response.json();

  const stuckPosting = [
    ...(data.workflows.carz || []).filter((w: any) => w.status === 'posting'),
    ...(data.workflows.benefit || []).filter((w: any) => w.status === 'posting' || w.status === 'submagic_processing')
  ];

  console.log(`📤 Found ${stuckPosting.length} workflows to post\n`);

  for (const workflow of stuckPosting.slice(0, 20)) {
    console.log(`\n📤 Posting: ${workflow.id} (${workflow.brand})`);

    if (!workflow.finalVideoUrl) {
      console.log('   ❌ No video URL, skipping');
      continue;
    }

    try {
      const result = await postToLate(workflow.finalVideoUrl, workflow.caption || 'Check this out!', workflow.brand);
      console.log(`   ✅ Posted: ${result.postId || result.id || 'success'}`);
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.log(`   ❌ Error:`, error instanceof Error ? error.message : error);
    }
  }

  console.log('\n✅ Done!');
}

forcePostAll();
