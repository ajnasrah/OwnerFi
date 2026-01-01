#!/usr/bin/env tsx
/**
 * Check article content quality to understand low scores
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function checkArticles() {
  console.log('\n=== CHECKING ARTICLE CONTENT QUALITY ===\n');

  const brands = ['carz', 'ownerfi', 'vassdistro', 'gaza'];

  for (const brand of brands) {
    console.log(`\n📱 ${brand.toUpperCase()}:`);
    console.log('─'.repeat(70));

    const collection = `${brand}_articles`;

    // Get unprocessed articles
    const snapshot = await db.collection(collection)
      .where('processed', '==', false)
      .limit(10)
      .get();

    if (snapshot.empty) {
      console.log('   No unprocessed articles');
      continue;
    }

    console.log(`   Found ${snapshot.size} unprocessed articles\n`);

    let shortContent = 0;
    let veryShortContent = 0;
    let noContent = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const content = data.content || data.description || '';
      const contentLen = content.length;
      const title = data.title || 'No title';
      const score = data.qualityScore;

      if (contentLen === 0) noContent++;
      else if (contentLen < 100) veryShortContent++;
      else if (contentLen < 200) shortContent++;

      console.log(`   📰 "${title.substring(0, 50)}..."`);
      console.log(`      Score: ${score ?? 'Not rated'}`);
      console.log(`      Content length: ${contentLen} chars`);
      console.log(`      Source: ${data.source || 'RSS'}`);
      if (contentLen < 200 && contentLen > 0) {
        console.log(`      Preview: "${content.substring(0, 100)}..."`);
      }
      console.log('');
    }

    console.log(`   Summary:`);
    console.log(`      No content: ${noContent}`);
    console.log(`      Very short (<100 chars): ${veryShortContent}`);
    console.log(`      Short (100-200 chars): ${shortContent}`);
  }

  // Check feed sources to see how many are configured
  console.log('\n\n=== FEED SOURCES ===');
  const feedSources = await db.collection('feed_sources').get();
  console.log(`   Total feed sources: ${feedSources.size}`);

  const brandCounts: Record<string, number> = {};
  feedSources.docs.forEach(doc => {
    const data = doc.data();
    const category = data.category || 'unknown';
    brandCounts[category] = (brandCounts[category] || 0) + 1;
  });
  console.log('   By category:', brandCounts);
}

checkArticles().catch(console.error);
