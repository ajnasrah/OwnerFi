import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logInfo } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Find all realtors on trial
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('isOnTrial', '==', true)
    );
    const realtorDocs = await getDocs(realtorsQuery);
    
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
      await updateDoc(doc(db, 'realtors', realtorDoc.id), {
        trialStartDate: trialStart,
        trialEndDate: trialEnd,
        updatedAt: serverTimestamp()
      });
      
      // Update subscription record
      const subscriptionQuery = query(
        collection(db, 'realtorSubscriptions'),
        where('realtorId', '==', realtorDoc.id),
        where('plan', '==', 'trial')
      );
      const subscriptionDocs = await getDocs(subscriptionQuery);
      
      if (!subscriptionDocs.empty) {
        const subDoc = subscriptionDocs.docs[0];
        await updateDoc(doc(db, 'realtorSubscriptions', subDoc.id), {
          currentPeriodStart: trialStart,
          currentPeriodEnd: trialEnd,
          updatedAt: serverTimestamp()
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