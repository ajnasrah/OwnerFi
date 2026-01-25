'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DoNotSellPage() {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone && !email) {
      setResult({ success: false, message: 'Please provide your phone number or email address.' });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch('/api/do-not-sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: 'Your request has been processed. Your information will no longer be shared with third parties.'
        });
        setPhone('');
        setEmail('');
      } else {
        setResult({
          success: false,
          message: data.error || 'We could not find your information in our system. If you believe this is an error, please contact support@ownerfi.ai'
        });
      }
    } catch {
      setResult({
        success: false,
        message: 'An error occurred. Please try again or contact support@ownerfi.ai'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-orange-400 hover:text-orange-300 mb-8 inline-block">
          &larr; Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-white mb-4">Do Not Sell or Share My Personal Information</h1>

        <div className="bg-slate-800 rounded-lg p-6 mb-8">
          <p className="text-slate-300 mb-4">
            Under the California Consumer Privacy Act (CCPA) and other state privacy laws, you have the right
            to opt out of the sale or sharing of your personal information.
          </p>
          <p className="text-slate-300 mb-4">
            By submitting this form, your information will be marked as unavailable and will no longer be
            shared with real estate professionals or other third parties.
          </p>
          <p className="text-slate-400 text-sm">
            Please enter the phone number or email address associated with your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-lg p-6 space-y-6">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="text-center text-slate-400">or</div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {result && (
            <div className={`p-4 rounded-lg ${result.success ? 'bg-green-900/50 border border-green-700' : 'bg-red-900/50 border border-red-700'}`}>
              <p className={result.success ? 'text-green-300' : 'text-red-300'}>
                {result.message}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {isSubmitting ? 'Processing...' : 'Submit Opt-Out Request'}
          </button>
        </form>

        <div className="mt-8 text-center text-slate-400 text-sm">
          <p>Questions? Contact us at <a href="mailto:support@ownerfi.ai" className="text-orange-400 hover:text-orange-300">support@ownerfi.ai</a></p>
        </div>
      </div>
    </div>
  );
}
