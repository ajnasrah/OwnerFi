#!/usr/bin/env tsx
// Unmark one VassDistro article as processed so it can be used for video generation

import { getAdminDb } from '../src/lib/firebase-admin';

async function unmarkArticle() {
  const db = await getAdminDb();

  // Get one high-quality processed article
  const snapshot = await db
    .collection('vassdistro_articles')
    .where('processed', '==', true)
    .where('qualityScore', '>=', 70)
    .orderBy('qualityScore', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('No processed articles found');
    return;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();

  console.log(`Unmarking article:`);
  console.log(`  ID: ${doc.id}`);
  console.log(`  Title: ${data.title}`);
  console.log(`  Quality Score: ${data.qualityScore}`);

  await doc.ref.update({
    processed: false,
    processedAt: null,
    processingStartedAt: null
  });

  console.log(`✅ Article unmarked and ready for video generation`);
}

unmarkArticle()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
