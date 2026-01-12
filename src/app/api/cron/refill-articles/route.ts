// Cron job to auto-refill article queue when running low
// Runs every 6 hours to ensure articles are always available
// Unmarks processed articles if queue drops below threshold

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { withCronLock } from '@/lib/cron-lock';

export const maxDuration = 60;

const REFILL_THRESHOLD = 15; // Refill if fewer than 15 unprocessed articles with score >= 70

export async function GET(request: NextRequest) {
  // Verify cron secret first (before acquiring lock)
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = userAgent === 'vercel-cron/1.0';

  // SECURITY: Require CRON_SECRET to be configured (no defaults)
  if (!cronSecret) {
    console.error('❌ CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('⚠️  Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use cron lock to prevent concurrent execution
  const result = await withCronLock('refill-articles', async () => {
    try {
      if (!db) {
        return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
      }

      console.log('🔄 Starting article refill check at', new Date().toISOString());

      const results = {
        carz: await refillBrand('carz'),
        ownerfi: await refillBrand('ownerfi'),
        gaza: await refillBrand('gaza')
      };

      console.log('✅ Article refill check complete:', results);

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        results
      });

    } catch (error) {
      console.error('❌ Article refill error:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  });

  // If lock wasn't acquired, return early
  if (result === null) {
    return NextResponse.json({
      success: false,
      message: 'Another instance is already running',
      skipped: true
    }, { status: 200 });
  }

  return result;
}

async function refillBrand(brand: 'carz' | 'ownerfi' | 'gaza') {
  const collectionName = `${brand}_articles`;

  console.log(`\n🔍 [${brand}] Checking article queue...`);

  // Get all unprocessed articles
  const unprocessedQuery = query(
    collection(db!, collectionName),
    where('processed', '==', false)
  );

  const snapshot = await getDocs(unprocessedQuery);
  const articles = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as any[];

  // Count high-quality unprocessed articles
  const highQuality = articles.filter(a =>
    typeof a.qualityScore === 'number' && a.qualityScore >= 70
  );

  console.log(`📊 [${brand}] Queue status:`);
  console.log(`   Total unprocessed: ${articles.length}`);
  console.log(`   High quality (>=70): ${highQuality.length}`);

  // If queue is healthy, do nothing
  if (highQuality.length >= REFILL_THRESHOLD) {
    console.log(`✅ [${brand}] Queue is healthy (${highQuality.length} >= ${REFILL_THRESHOLD})`);
    return {
      action: 'none',
      queueSize: highQuality.length,
      threshold: REFILL_THRESHOLD
    };
  }

  // Queue is low - refill by unmarking processed articles
  console.log(`⚠️  [${brand}] Queue is LOW (${highQuality.length} < ${REFILL_THRESHOLD})`);
  console.log(`🔄 [${brand}] Unmarking processed articles...`);

  const processedQuery = query(
    collection(db!, collectionName),
    where('processed', '==', true)
  );

  const processedSnapshot = await getDocs(processedQuery);

  // Get top 10 processed articles by score
  const processedArticles = processedSnapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    .filter((a: any) => typeof a.qualityScore === 'number' && a.qualityScore >= 70)
    .sort((a: any, b: any) => (b.qualityScore || 0) - (a.qualityScore || 0))
    .slice(0, 10);

  if (processedArticles.length === 0) {
    console.log(`⚠️  [${brand}] No processed articles to refill from`);
    return {
      action: 'none',
      queueSize: highQuality.length,
      reason: 'No processed articles available to refill'
    };
  }

  // Unmark top articles
  let unmarked = 0;
  for (const article of processedArticles) {
    await updateDoc(doc(db!, collectionName, article.id), {
      processed: false
    });
    unmarked++;
  }

  console.log(`✅ [${brand}] Unmarked ${unmarked} articles`);
  console.log(`   New queue size: ${highQuality.length + unmarked}`);

  return {
    action: 'refilled',
    unmarked,
    previousQueueSize: highQuality.length,
    newQueueSize: highQuality.length + unmarked,
    threshold: REFILL_THRESHOLD
  };
}
