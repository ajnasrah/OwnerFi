#!/usr/bin/env npx tsx
import { config } from 'dotenv';
config({ path: '.env.local' });

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY!;
const workflowId = 'podcast_1761449336098_qtl2ic83q';
const videoUrl = 'https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/podcast/heygen-videos/podcast_1761449336098_qtl2ic83q.mp4';
const title = 'Mike Thompson on Trade-in Value Maximization';

console.log('🔧 Fixing Episode #4...');
const response = await fetch('https://api.submagic.co/v1/projects', {
  method: 'POST',
  headers: { 'x-api-key': SUBMAGIC_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title, language: 'en', videoUrl,
    templateName: 'Hormozi 2',
    magicBrolls: true, magicBrollsPercentage: 50, magicZooms: true,
    webhookUrl: 'https://ownerfi.ai/api/webhooks/submagic/podcast'
  })
});

const data = await response.json();
console.log('✅ Submagic project:', data.id);
console.log('View at: https://app.submagic.co/view/' + data.id);
