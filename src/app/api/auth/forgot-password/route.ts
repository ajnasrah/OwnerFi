import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logInfo, logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase())
    );
    const userDocs = await getDocs(usersQuery);

    if (userDocs.empty) {
      // Don't reveal that user doesn't exist for security
      return NextResponse.json({
        success: true,
        message: 'If an account with this email exists, reset instructions have been sent.'
      });
    }

    const user = userDocs.docs[0];
    
    // Generate reset token
    const resetToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to database
    await setDoc(doc(db, 'passwordResets', resetToken), {
      userId: user.id,
      email: email.toLowerCase(),
      token: resetToken,
      expires: resetExpires,
      used: false,
      createdAt: serverTimestamp()
    });

    // In a real app, you would send an email here
    // For now, we'll log the reset link
    const resetLink = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;
    
    await logInfo('Password reset requested', {
      action: 'password_reset_request',
      userId: user.id,
      email: email.toLowerCase(),
      metadata: {
        resetToken,
        resetLink, // In production, this would be sent via email
        expiresAt: resetExpires.toISOString()
      }
    });

    // For development, return the reset link
    // In production, this would just confirm email was sent
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        success: true,
        message: 'Reset instructions sent to your email',
        resetLink: resetLink // Only for development
      });
    }

    return NextResponse.json({
      success: true,
      message: 'If an account with this email exists, reset instructions have been sent.'
    });

  } catch (error) {
    await logError('Password reset failed', {
      action: 'password_reset_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to process password reset' },
      { status: 500 }
    );
  }
}