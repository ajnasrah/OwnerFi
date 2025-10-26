#!/usr/bin/env npx tsx
// Check Submagic project status

import { config } from 'dotenv';

async function checkSubmagicStatus() {
  console.log('✨ Checking Submagic Project Status\n');

  try {
    config({ path: '.env.local' });

    const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

    if (!SUBMAGIC_API_KEY) {
      console.error('❌ SUBMAGIC_API_KEY not found');
      process.exit(1);
    }

    // Check the two stuck projects
    const projects = [
      '5a0d8ab2-fb87-42f7-a9fa-923ad65708b3', // Dr. Smith
      '55dc53e5-56a9-4881-a655-cc7b9ec40e7d'  // James Chen
    ];

    for (const projectId of projects) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Checking project: ${projectId.substring(0, 20)}...`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      const response = await fetch(
        `https://api.submagic.co/v1/projects/${projectId}`,
        {
          headers: {
            'x-api-key': SUBMAGIC_API_KEY
          }
        }
      );

      console.log(`Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        console.log('\nProject Details:');
        console.log(`  Status: ${data.status}`);
        console.log(`  Title: ${data.title || 'N/A'}`);

        if (data.media_url || data.video_url) {
          console.log(`  ✅ Video URL: ${data.media_url || data.video_url}`);
        }

        if (data.error) {
          console.log(`  ❌ Error: ${data.error}`);
        }

        console.log('\nFull Response:');
        console.log(JSON.stringify(data, null, 2));
      } else {
        const errorText = await response.text();
        console.log(`\n❌ Error Response: ${errorText}`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

checkSubmagicStatus();
