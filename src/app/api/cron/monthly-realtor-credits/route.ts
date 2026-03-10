/**
 * Monthly Realtor Credits Cron
 *
 * Gives all active realtors 1 free credit per month.
 *
 * Schedule: 0 0 1 * * (midnight on the 1st of each month)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin, FieldValue } from '@/lib/scraper-v2/firebase-admin';

const CRON_SECRET = process.env.CRON_SECRET;
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');

    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = getFirebaseAdmin();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 [MONTHLY-CREDITS] Starting monthly credit distribution...');
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get all users with role 'realtor'
    const realtorsSnapshot = await db
      .collection('users')
      .where('role', '==', 'realtor')
      .get();

    console.log(`📊 Found ${realtorsSnapshot.size} realtors`);

    let successCount = 0;
    let errorCount = 0;

    // Give each realtor 1 credit
    for (const realtorDoc of realtorsSnapshot.docs) {
      try {
        const realtorData = realtorDoc.data();
        const currentCredits = realtorData.realtorData?.credits || 0;

        await realtorDoc.ref.update({
          'realtorData.credits': FieldValue.increment(1),
          'realtorData.lastFreeCredit': new Date().toISOString(),
          'realtorData.updatedAt': new Date(),
        });

        console.log(`✅ Gave 1 credit to ${realtorData.email} (${currentCredits} → ${currentCredits + 1})`);
        successCount++;
      } catch (error: unknown) {
        console.error(`❌ Failed to give credit to ${realtorDoc.id}:`, error);
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;

    // Log to cron_logs
    await db.collection('cron_logs').add({
      cron: 'monthly-realtor-credits',
      status: 'completed',
      timestamp: new Date(),
      totalRealtors: realtorsSnapshot.size,
      successCount,
      errorCount,
      durationMs: duration,
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 [MONTHLY-CREDITS] Completed');
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Duration: ${duration}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({
      success: true,
      message: 'Monthly credits distributed',
      stats: {
        totalRealtors: realtorsSnapshot.size,
        successCount,
        errorCount,
        durationMs: duration,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ [MONTHLY-CREDITS] Error:', errorMessage);

    try {
      const { db } = getFirebaseAdmin();
      await db.collection('cron_logs').add({
        cron: 'monthly-realtor-credits',
        status: 'error',
        error: errorMessage,
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
      });
    } catch { /* ignore logging failure */ }

    return NextResponse.json(
      { error: 'Failed to distribute monthly credits' },
      { status: 500 }
    );
  }
}
