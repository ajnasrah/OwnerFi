'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ConfirmationResult } from 'firebase/auth';
import Link from 'next/link';
import {
  setupRecaptcha,
  sendVerificationCode,
  verifyCode
} from '@/lib/firebase-phone-auth';
import { isValidPhone } from '@/lib/phone-utils';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

    if (!isValidPhone(phone)) {
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
      console.log('🔍 [AUTH-PAGE] Checking if user exists for phone:', verifiedPhone);
      const checkResponse = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: verifiedPhone })
      });

      const checkData = await checkResponse.json();
      console.log('📋 [AUTH-PAGE] check-phone response:', { status: checkResponse.status, data: checkData });

      if (checkData.exists) {
        // Existing user - sign them in
        console.log('✅ [AUTH-PAGE] User exists, attempting sign in...');
        const signInResult = await signIn('credentials', {
          phone: verifiedPhone,
          redirect: false,
        });
        console.log('🔐 [AUTH-PAGE] signIn result:', signInResult);

        if (signInResult?.ok) {
          // Check for shared property to auto-like
          const sharedPropertyId = sessionStorage.getItem('shared_property_id');
          sessionStorage.removeItem('shared_property_id');

          // Small delay to ensure session is established
          await new Promise(resolve => setTimeout(resolve, 500));

          // If there's a shared property, redirect to dashboard with the property to like
          // This works for all roles (buyer, admin, realtor)
          if (sharedPropertyId) {
            router.push(`/dashboard?likeProperty=${sharedPropertyId}`);
            return;
          }

          // Otherwise redirect based on role
          let redirectTo = searchParams?.get('callbackUrl') || '/dashboard';

          // Check role from the check-phone response
          if (checkData.role === 'admin') {
            redirectTo = '/admin';
          } else if (checkData.role === 'realtor') {
            redirectTo = '/realtor-dashboard';
          }

          router.push(redirectTo);
        } else {
          setError('Failed to sign in. Please try again.');
          setLoading(false);
        }
      } else {
        // New user - redirect to setup
        console.log('❌ [AUTH-PAGE] User NOT found, redirecting to setup. checkData:', checkData);
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

    // Reset the reCAPTCHA verifier so a fresh one is created
    if ((window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier.clear();
      } catch (e) {
        // Ignore clear errors
      }
      (window as any).recaptchaVerifier = null;
    }

    // Clear the reCAPTCHA container and recreate
    const container = document.getElementById('recaptcha-container');
    if (container) {
      container.innerHTML = '';
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    try {
      const signInResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.ok) {
        const redirectTo = searchParams?.get('callbackUrl') || '/dashboard';
        router.push(redirectTo);
      } else {
        setError('Invalid email or password');
      }
    } catch (err: any) {
      console.error('Email sign-in error:', err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
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
          <Link
            href="/"
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl mb-6 shadow-2xl hover:shadow-emerald-500/50 transition-all duration-300 hover:scale-105 active:scale-95"
            title="Back to Home"
          >
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </Link>
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

          {mode === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3">
                  Email Address
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-4 bg-slate-900/50 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white text-lg placeholder-slate-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-4 bg-slate-900/50 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white text-lg placeholder-slate-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setMode('phone')}
                  className="text-slate-400 hover:text-slate-200 text-sm transition-colors"
                >
                  Back to phone
                </button>
              </div>
            </form>
          ) : step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="tel"
                  autoComplete="tel"
                  inputMode="tel"
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

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setMode('email')}
                  className="text-slate-400 hover:text-slate-200 text-sm transition-colors"
                >
                  Continue with email
                </button>
              </div>
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
                  name="one-time-code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
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

        {/* Terms & Privacy */}
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400">
            By signing in, you agree to our{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline transition-colors"
            >
              Terms of Service
            </a>
            {' '}and{' '}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline transition-colors"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
