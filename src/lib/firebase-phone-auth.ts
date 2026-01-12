import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { auth } from './firebase';
import { normalizePhone as normalizePhoneUtil, isValidPhone as isValidPhoneUtil } from './phone-utils';

// Re-export from phone-utils for backward compatibility
export const formatPhoneNumber = normalizePhoneUtil;
export const isValidPhoneNumber = isValidPhoneUtil;

// Initialize reCAPTCHA verifier
// Uses invisible reCAPTCHA for better mobile experience
export async function setupRecaptcha(containerId: string): Promise<RecaptchaVerifier | null> {
  if (!auth) {
    console.error('❌ Firebase Auth not initialized');
    return null;
  }

  try {
    // Clear any existing reCAPTCHA first
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }

    const recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible', // Invisible reCAPTCHA - works better on mobile
      callback: () => {
        console.log('✅ reCAPTCHA verified');
      },
      'expired-callback': () => {
        console.log('⚠️ reCAPTCHA expired - will refresh');
      }
    });

    // Pre-render the reCAPTCHA (important for invisible mode)
    await recaptchaVerifier.render();
    console.log('✅ reCAPTCHA rendered successfully');

    return recaptchaVerifier;
  } catch (error) {
    console.error('❌ Error setting up reCAPTCHA:', error);
    return null;
  }
}

// Send SMS verification code
export async function sendVerificationCode(
  phoneNumber: string,
  recaptchaVerifier: RecaptchaVerifier
): Promise<{ success: boolean; confirmationResult?: ConfirmationResult; error?: string }> {
  if (!auth) {
    return { success: false, error: 'Authentication not initialized' };
  }

  try {
    const normalizedPhone = normalizePhoneUtil(phoneNumber);
    console.log('📱 [FIREBASE-PHONE-AUTH] Sending SMS to:', normalizedPhone);
    const confirmationResult = await signInWithPhoneNumber(auth, normalizedPhone, recaptchaVerifier);

    return {
      success: true,
      confirmationResult
    };
  } catch (error: any) {
    console.error('❌ [FIREBASE-PHONE-AUTH] Error sending verification code:', error);
    console.error('❌ [FIREBASE-PHONE-AUTH] Error code:', error.code);
    console.error('❌ [FIREBASE-PHONE-AUTH] Error message:', error.message);

    let errorMessage = 'Failed to send verification code';
    if (error.code === 'auth/invalid-phone-number') {
      errorMessage = 'Invalid phone number format';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many attempts. Please try again later';
    } else if (error.code === 'auth/quota-exceeded') {
      errorMessage = 'SMS quota exceeded. Please try again later';
    } else if (error.code === 'auth/captcha-check-failed') {
      errorMessage = 'reCAPTCHA verification failed. Please refresh and try again';
    } else if (error.code === 'auth/missing-phone-number') {
      errorMessage = 'Phone number is missing';
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMessage = 'Phone authentication is not enabled';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
}

// Verify SMS code
export async function verifyCode(
  confirmationResult: ConfirmationResult,
  code: string
): Promise<{ success: boolean; phoneNumber?: string; error?: string }> {
  try {
    const result = await confirmationResult.confirm(code);
    const phoneNumber = result.user.phoneNumber;

    if (!phoneNumber) {
      return { success: false, error: 'Phone number not found' };
    }

    return {
      success: true,
      phoneNumber
    };
  } catch (error: any) {
    console.error('Error verifying code:', error);

    let errorMessage = 'Invalid verification code';
    if (error.code === 'auth/invalid-verification-code') {
      errorMessage = 'Invalid code. Please try again';
    } else if (error.code === 'auth/code-expired') {
      errorMessage = 'Code expired. Please request a new one';
    }

    return { success: false, error: errorMessage };
  }
}
