/**
 * Monthly Realtor Credits Cron
 *
 * Gives all active realtors 1 free credit per month.
 *
 * Schedule: 0 0 1 * * (midnight on the 1st of each month)
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logInfo, logError } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!db) {
      console.error('❌ Firebase db not available');
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 [MONTHLY-CREDITS] Starting monthly credit distribution...');
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get all users with role 'realtor'
    const realtorsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'realtor')
    );
    const realtorsSnapshot = await getDocs(realtorsQuery);

    console.log(`📊 Found ${realtorsSnapshot.size} realtors`);

    let successCount = 0;
    let errorCount = 0;

    // Give each realtor 1 credit
    for (const realtorDoc of realtorsSnapshot.docs) {
      try {
        const realtorData = realtorDoc.data();
        const currentCredits = realtorData.realtorData?.credits || 0;

        // Update credits using increment to avoid race conditions
        await updateDoc(doc(db, 'users', realtorDoc.id), {
          'realtorData.credits': increment(1),
          'realtorData.lastFreeCredit': new Date().toISOString(),
          'realtorData.updatedAt': new Date()
        });

        console.log(`✅ Gave 1 credit to ${realtorData.email} (${currentCredits} → ${currentCredits + 1})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to give credit to ${realtorDoc.id}:`, error);
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;

    await logInfo('Monthly realtor credits distributed', {
      action: 'monthly_credits_cron',
      metadata: {
        totalRealtors: realtorsSnapshot.size,
        successCount,
        errorCount,
        durationMs: duration
      }
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
        durationMs: duration
      }
    });

  } catch (error) {
    await logError('Monthly credits cron failed', {
      action: 'monthly_credits_cron_error'
    }, error as Error);

    console.error('❌ [MONTHLY-CREDITS] Error:', error);

    return NextResponse.json(
      { error: 'Failed to distribute monthly credits' },
      { status: 500 }
    );
  }
}
