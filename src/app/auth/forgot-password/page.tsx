'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSent(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
        <div className="max-w-lg bg-white rounded-3xl shadow-2xl p-10">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Check Your Email</h2>
            <p className="text-slate-600 mb-6">
              We've sent password reset instructions to <strong>{email}</strong>
            </p>
            <div className="space-y-4">
              <a 
                href="/auth"
                className="w-full bg-blue-600 text-white py-4 px-4 rounded-2xl hover:bg-blue-700 transition-colors font-semibold text-lg shadow-lg transform active:scale-95 flex items-center justify-center"
              >
                Return to Sign In
              </a>
              <button
                onClick={() => {
                  setSent(false);
                  setEmail('');
                }}
                className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium py-2"
              >
                Try a different email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <div className="max-w-lg bg-white rounded-3xl shadow-2xl p-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Reset Password</h1>
          <p className="text-slate-600">
            Enter email to reset password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-3">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-500 text-lg"
              placeholder="Enter your email address"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 px-4 rounded-2xl hover:bg-blue-700 transition-colors font-semibold text-lg disabled:bg-slate-400 disabled:cursor-not-allowed shadow-lg transform active:scale-95"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Sending...
              </span>
            ) : (
              'Send Reset Instructions'
            )}
          </button>

          <div className="text-center">
            <Link href="/auth" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              ← Back to Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}