/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';

export async function POST(request: NextRequest) {
  try {
    const { email, credits } = await request.json();
    
    
    // Find user by email
    const user = await FirebaseDB.findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Get current credits and add new ones
    const currentCredits = (user as { realtorData?: { credits?: number } }).realtorData?.credits || 0;
    const newCredits = currentCredits + parseInt(credits);
    
    // Update user with new credits
    const updatedRealtorData = {
      ...(user as { realtorData?: Record<string, unknown> }).realtorData || {},
      credits: newCredits,
      updatedAt: new Date()
    };

    await FirebaseDB.updateDocument('users', user.id, {
      realtorData: updatedRealtorData,
      updatedAt: new Date()
    });

    
    return NextResponse.json({
      success: true,
      message: `Added ${credits} credits. New balance: ${newCredits}`,
      newBalance: newCredits
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}