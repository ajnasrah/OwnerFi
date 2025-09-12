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
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

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

    // Send email using Firebase extension or function
    const resetLink = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;
    
    try {
      // Try to send email via Firebase extension (trigger-email)
      await setDoc(doc(db, 'mail', resetToken), {
        to: [email.toLowerCase()],
        message: {
          subject: 'Reset your password - OwnerFi',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Password Reset Request</h2>
              <p>You requested to reset your password for your OwnerFi account.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; color: #666;">${resetLink}</p>
              <p><small>This link will expire in 1 hour.</small></p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 14px;">
                If you didn't request this password reset, please ignore this email.
              </p>
            </div>
          `,
          text: `
Password Reset Request

You requested to reset your password for your OwnerFi account.

Click this link to reset your password: ${resetLink}

This link will expire in 1 hour.

If you didn't request this password reset, please ignore this email.
          `
        }
      });
      
      await logInfo('Password reset email sent', {
        action: 'password_reset_email_sent',
        userId: user.id,
        metadata: {
          resetToken,
          email: email.toLowerCase(),
          expiresAt: resetExpires.toISOString()
        }
      });
      
    } catch (emailError) {
      // Fallback: log the reset link if email fails
      await logError('Email sending failed, logging reset link', {
        action: 'password_reset_email_fallback',
        userId: user.id,
        metadata: {
          resetToken,
          resetLink,
          email: email.toLowerCase(),
          expiresAt: resetExpires.toISOString()
        }
      }, emailError as Error);
    }

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