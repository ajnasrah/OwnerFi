import { NextResponse } from 'next/server';
import { 
  doc,
  updateDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { getSafeDb } from '@/lib/firebase-safe';
import { firestoreHelpers } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    const { realtorId, plan, creditsToAdd } = await request.json();
    
    // Update realtor to active subscription
    const db = getSafeDb();
    await updateDoc(doc(db, 'realtors', realtorId), {
      credits: 748 + creditsToAdd, // Keep existing credits plus new ones
      currentPlan: plan,
      subscriptionStatus: 'active',
      isOnTrial: false,
      updatedAt: serverTimestamp()
    });
    
    // Create subscription record
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);
    
    await setDoc(doc(db, 'realtorSubscriptions', firestoreHelpers.generateId()), {
      realtorId: realtorId,
      plan: plan,
      status: 'active',
      monthlyPrice: 1000,
      creditsPerMonth: 10,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Add transaction record
    await setDoc(doc(db, 'transactions', firestoreHelpers.generateId()), {
      realtorId: realtorId,
      type: 'subscription_start',
      description: 'Professional Package subscription activated',
      amount: 1000,
      credits: creditsToAdd,
      createdAt: serverTimestamp()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Subscription activated successfully',
      newCredits: 748 + creditsToAdd
    });
    
  } catch {
    return NextResponse.json(
      { error: 'Failed to activate subscription' },
      { status: 500 }
    );
  }
}