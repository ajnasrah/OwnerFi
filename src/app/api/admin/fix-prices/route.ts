import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';

/**
 * One-time admin endpoint to fix property prices.
 *
 * Problem: Scraper was using Apify's `price` field (tax-assessed/stale value)
 * instead of `listPrice` (actual Zillow asking price).
 *
 * Fix: For all active properties where listPrice exists and differs from price,
 * update price = listPrice. Cloud Functions will auto-sync to Typesense.
 */
export async function POST(request: NextRequest) {
  const { db } = getFirebaseAdmin();

  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const snapshot = await db.collection('properties').where('isActive', '==', true).get();
    console.log(`[fix-prices] Found ${snapshot.size} active properties`);

    let fixed = 0;
    let alreadyCorrect = 0;
    let noListPrice = 0;
    let batchCount = 0;
    let batch = db.batch();
    const fixes: Array<{ address: string; oldPrice: number; newPrice: number }> = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const price = data.price || 0;
      const listPrice = data.listPrice || 0;

      if (!listPrice || listPrice === 0) {
        noListPrice++;
        continue;
      }

      if (price === listPrice) {
        alreadyCorrect++;
        continue;
      }

      // listPrice exists and differs from price — fix it
      batch.update(doc.ref, { price: listPrice });
      fixes.push({
        address: data.streetAddress || data.address || doc.id,
        oldPrice: price,
        newPrice: listPrice,
      });
      fixed++;
      batchCount++;

      // Firestore batch limit is 500
      if (batchCount >= 450) {
        await batch.commit();
        console.log(`[fix-prices] Committed batch of ${batchCount}`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`[fix-prices] Committed final batch of ${batchCount}`);
    }

    const result = {
      success: true,
      total: snapshot.size,
      fixed,
      alreadyCorrect,
      noListPrice,
      sampleFixes: fixes.slice(0, 20),
    };

    console.log(`[fix-prices] Done:`, result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('[fix-prices] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
