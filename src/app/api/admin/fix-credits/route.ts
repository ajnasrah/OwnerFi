import { NextRequest, NextResponse } from 'next/server';
import { firestoreHelpers } from '@/lib/firestore';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    // Add back 10 credits to your account
    const realtorId = 'idjfqlXrzobyRoFVRTUO';
    
    await adminDb.collection('realtors').doc(realtorId).update({
      credits: 758, // 748 + 10 Professional credits
      updatedAt: new Date()
    });
    
    // Add transaction record
    await setDoc(adminDb.collection('transactions').doc(firestoreHelpers.generateId()), {
      realtorId: realtorId,
      type: 'credit_adjustment',
      description: 'Added Professional Package credits (10 credits)',
      amount: 0,
      credits: 10,
      createdAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Added 10 Professional credits',
      newBalance: 758
    });
    
  } catch (error) {
    console.error('Failed to fix credits:', error);
    return NextResponse.json(
      { error: 'Failed to fix credits' },
      { status: 500 }
    );
  }
}