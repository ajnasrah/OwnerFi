'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ConfirmationResult } from 'firebase/auth';
import {
  formatPhoneNumber,
  isValidPhoneNumber,
  setupRecaptcha,
  sendVerificationCode,
  verifyCode
} from '@/lib/firebase-phone-auth';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Initialize reCAPTCHA on mount
  useEffect(() => {
    const recaptchaContainer = document.getElementById('recaptcha-container');
    if (recaptchaContainer && !recaptchaContainer.hasChildNodes()) {
      setupRecaptcha('recaptcha-container');
    }
  }, []);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!isValidPhoneNumber(phone)) {
      setError('Please enter a valid 10-digit phone number');
      setLoading(false);
      return;
    }

    try {
      // Set up reCAPTCHA if not already set up
      let recaptchaVerifier = (window as any).recaptchaVerifier;

      if (!recaptchaVerifier) {
        recaptchaVerifier = setupRecaptcha('recaptcha-container');
        (window as any).recaptchaVerifier = recaptchaVerifier;
      }

      if (!recaptchaVerifier) {
        setError('Failed to initialize verification. Please refresh and try again.');
        setLoading(false);
        return;
      }

      // Send verification code
      const result = await sendVerificationCode(phone, recaptchaVerifier);

      if (result.success && result.confirmationResult) {
        setConfirmationResult(result.confirmationResult);
        setStep('code');
      } else {
        setError(result.error || 'Failed to send code');
      }
    } catch (err: any) {
      console.error('Phone verification error:', err);
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!confirmationResult) {
      setError('Verification session expired. Please start over.');
      setLoading(false);
      return;
    }

    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      setLoading(false);
      return;
    }

    try {
      // Verify the code
      const result = await verifyCode(confirmationResult, code);

      if (!result.success || !result.phoneNumber) {
        setError(result.error || 'Invalid code');
        setLoading(false);
        return;
      }

      const verifiedPhone = result.phoneNumber;

      // Check if user exists in database
      const checkResponse = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: verifiedPhone })
      });

      const checkData = await checkResponse.json();

      if (checkData.exists) {
        // Existing user - sign them in
        const signInResult = await signIn('credentials', {
          phone: verifiedPhone,
          redirect: false,
        });

        if (signInResult?.ok) {
          // Redirect based on role (will be handled by the API)
          const redirectTo = searchParams?.get('callbackUrl') ||
                            (checkData.role === 'realtor' ? '/realtor-dashboard' : '/dashboard');
          router.push(redirectTo);
        } else {
          setError('Failed to sign in. Please try again.');
          setLoading(false);
        }
      } else {
        // New user - redirect to setup
        // Store verified phone in session storage for setup page
        sessionStorage.setItem('verified_phone', verifiedPhone);
        router.push('/auth/setup');
      }
    } catch (err: any) {
      console.error('Code verification error:', err);
      setError(err.message || 'Failed to verify code');
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setCode('');
    setError('');
    setStep('phone');
    setConfirmationResult(null);
  };

  const formatPhoneDisplay = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      return !match[2] ? match[1] : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`;
    }
    return value;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* reCAPTCHA container (invisible) */}
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl mb-6 shadow-2xl">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Welcome to OwnerFi</h1>
          <p className="text-slate-300 text-lg">Skip the bank. Buy direct.</p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4">
              <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formatPhoneDisplay(phone)}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="(555) 123-4567"
                  maxLength={14}
                  required
                  className="w-full px-4 py-4 bg-slate-900/50 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white text-lg placeholder-slate-500 transition-all"
                />
                <p className="mt-2 text-xs text-slate-400">
                  We'll send you a verification code via SMS
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || phone.replace(/\D/g, '').length < 10}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending code...
                  </span>
                ) : (
                  'Send Verification Code'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCodeSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3">
                  Verification Code
                </label>
                <p className="text-slate-400 text-sm mb-4">
                  Enter the 6-digit code sent to <span className="text-white font-semibold">{formatPhoneDisplay(phone)}</span>
                </p>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                  className="w-full px-4 py-4 bg-slate-900/50 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white text-2xl text-center tracking-widest placeholder-slate-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  'Verify & Continue'
                )}
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                className="w-full text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition-colors"
              >
                Didn't receive a code? Try again
              </button>
            </form>
          )}
        </div>

        {/* Info */}
        <div className="mt-6 bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 text-sm mb-1">Secure & Fast</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We use SMS verification for secure, password-free authentication. Standard message rates may apply.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
