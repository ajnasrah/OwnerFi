import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logInfo, logError } from '@/lib/logger';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Get the reset token document
    const resetDoc = await getDoc(doc(db, 'passwordResets', token));
    
    if (!resetDoc.exists()) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    const resetData = resetDoc.data();
    
    // Check if token is expired
    const now = new Date();
    const expiresAt = resetData.expires.toDate();
    
    if (now > expiresAt) {
      // Clean up expired token
      await deleteDoc(doc(db, 'passwordResets', token));
      return NextResponse.json(
        { error: 'Reset token has expired' },
        { status: 400 }
      );
    }

    // Check if token has been used
    if (resetData.used) {
      return NextResponse.json(
        { error: 'This password reset link has already been used' },
        { status: 400 }
      );
    }

    // Get user document
    const userQuery = query(
      collection(db, 'users'),
      where('email', '==', resetData.email)
    );
    const userDocs = await getDocs(userQuery);

    if (userDocs.empty) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 400 }
      );
    }

    const userDoc = userDocs.docs[0];
    
    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update user's password
    await updateDoc(userDoc.ref, {
      password: hashedPassword,
      updatedAt: new Date()
    });

    // Mark token as used
    await updateDoc(doc(db, 'passwordResets', token), {
      used: true,
      usedAt: new Date()
    });

    await logInfo('Password reset completed', {
      action: 'password_reset_completed',
      userId: userDoc.id,
      metadata: {
        email: resetData.email,
        tokenUsed: token
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully'
    });

  } catch {
    await logError('Password reset failed', {
      action: 'password_reset_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}