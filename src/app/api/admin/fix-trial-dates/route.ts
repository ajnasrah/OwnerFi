import { NextRequest, NextResponse } from 'next/server';
import { logInfo } from '@/lib/logger';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    // Find all realtors on trial
    const realtorDocs = await adminDb.collection('realtors').where('isOnTrial', '==', true).get();
    
    const results = [];
    
    for (const realtorDoc of realtorDocs.docs) {
      const realtor = realtorDoc.data();
      
      // Get the creation date
      let createdAt;
      if (realtor.createdAt?.toDate) {
        createdAt = realtor.createdAt.toDate();
      } else if (realtor.createdAt) {
        createdAt = new Date(realtor.createdAt);
      } else {
        // If no creation date, use current date minus 2 days as estimate
        createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - 2);
      }
      
      // Calculate correct trial dates
      const trialStart = new Date(createdAt);
      const trialEnd = new Date(createdAt);
      trialEnd.setDate(trialEnd.getDate() + 7);
      
      // Update realtor document
      await adminDb.collection('realtors').doc(realtorDoc.id).update({
        trialStartDate: trialStart,
        trialEndDate: trialEnd,
        updatedAt: new Date()
      });
      
      // Update subscription record
      const subscriptionQuery = query(
        adminDb.collection('realtorSubscriptions'),
        where('realtorId', '==', realtorDoc.id),
        where('plan', '==', 'trial')
      );
      const subscriptionDocs = await subscriptionQuery.get();
      
      if (!subscriptionDocs.empty) {
        const subDoc = subscriptionDocs.docs[0];
        await adminDb.collection('realtorSubscriptions').doc(subDoc.id).update({
          currentPeriodStart: trialStart,
          currentPeriodEnd: trialEnd,
          updatedAt: new Date()
        });
      }
      
      results.push({
        realtorId: realtorDoc.id,
        name: `${realtor.firstName} ${realtor.lastName}`,
        createdAt: createdAt.toISOString(),
        trialStart: trialStart.toISOString(),
        trialEnd: trialEnd.toISOString(),
        daysRemaining: Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      });
    }
    
    await logInfo('Fixed trial dates for realtors', {
      action: 'fix_trial_dates',
      metadata: {
        count: results.length
      }
    });
    
    return NextResponse.json({
      success: true,
      message: `Fixed trial dates for ${results.length} realtors`,
      results
    });
    
  } catch (error) {
    console.error('Failed to fix trial dates:', error);
    return NextResponse.json(
      { error: 'Failed to fix trial dates' },
      { status: 500 }
    );
  }
}