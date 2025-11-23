import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  PhoneAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { auth } from './firebase';

// Format phone number to E.164 format (+1XXXXXXXXXX)
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // If it starts with 1 and is 11 digits, add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // If it's 10 digits, add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If it already starts with +, return as is
  if (phone.startsWith('+')) {
    return phone;
  }

  // Default: add +1
  return `+1${cleaned}`;
}

// Validate phone number format
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || cleaned.length === 11;
}

// Initialize reCAPTCHA verifier
export function setupRecaptcha(containerId: string): RecaptchaVerifier | null {
  if (!auth) {
    console.error('Firebase Auth not initialized');
    return null;
  }

  try {
    const recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved - allow user to proceed
        console.log('reCAPTCHA verified');
      },
      'expired-callback': () => {
        console.log('reCAPTCHA expired');
      }
    });

    return recaptchaVerifier;
  } catch (error) {
    console.error('Error setting up reCAPTCHA:', error);
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
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);

    return {
      success: true,
      confirmationResult
    };
  } catch (error: any) {
    console.error('Error sending verification code:', error);

    let errorMessage = 'Failed to send verification code';
    if (error.code === 'auth/invalid-phone-number') {
      errorMessage = 'Invalid phone number format';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many attempts. Please try again later';
    } else if (error.code === 'auth/quota-exceeded') {
      errorMessage = 'SMS quota exceeded. Please try again later';
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
