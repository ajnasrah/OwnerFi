#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function testLateApi() {
  const LATE_API_KEY = process.env.LATE_API_KEY;
  const postId = '6775ee70a5b79be5e1bce4da'; // One from the sync output

  console.log('Testing Late API...');
  console.log('Post ID:', postId);

  const response = await fetch(`https://getlate.dev/api/v1/posts/${postId}`, {
    headers: {
      'Authorization': `Bearer ${LATE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

testLateApi().catch(console.error);
