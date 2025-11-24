'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CREDIT_PACKAGES = [
  { id: '1_credit', credits: 1, price: 300, name: '1 Lead Credit', recurring: false, popular: false },
  { id: '4_credits', credits: 4, price: 500, name: '4 Lead Credits', recurring: true, popular: true },
  { id: '10_credits', credits: 10, price: 1000, name: '10 Lead Credits', recurring: true, popular: false },
  { id: '60_credits', credits: 60, price: 3000, name: '60 Lead Credits', recurring: false, popular: false },
];

export default function BuyCreditsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    }
  }, [status, router]);

  const handlePurchase = async (packageId: string) => {
    setLoading(packageId);
    setError('');

    try {
      const response = await fetch('/api/stripe/simple-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditPackId: packageId })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create checkout session');
        setLoading(null);
        return;
      }

      // Redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(null);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50">
        <div className="px-4 py-3 flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/realtor-dashboard" className="text-slate-400 hover:text-white transition-colors">
            ← Back to Dashboard
          </Link>
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <span className="text-lg font-bold text-white">OwnerFi</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            Buy Lead Credits
          </h1>
          <p className="text-slate-300 text-lg">
            Purchase credits to unlock qualified buyer leads in your area
          </p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4">
            <p className="text-red-300 text-center">{error}</p>
          </div>
        )}

        {/* Pricing Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {CREDIT_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative bg-slate-800/50 backdrop-blur-xl border ${
                pkg.popular ? 'border-emerald-500/50' : 'border-slate-700/50'
              } rounded-2xl p-6 hover:scale-105 transition-transform`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    POPULAR
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-white">${pkg.price.toLocaleString()}</span>
                  {pkg.recurring && (
                    <span className="text-slate-400 text-sm">/month</span>
                  )}
                </div>
                <p className="text-slate-400 text-sm mt-2">
                  {pkg.credits} lead credit{pkg.credits > 1 ? 's' : ''}
                  {pkg.recurring && ' per month'}
                </p>
              </div>

              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2 text-slate-300 text-sm">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Full buyer contact info</span>
                </li>
                <li className="flex items-start gap-2 text-slate-300 text-sm">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Pre-qualified leads</span>
                </li>
                <li className="flex items-start gap-2 text-slate-300 text-sm">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>In your service area</span>
                </li>
                {pkg.recurring && (
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>Renews automatically</span>
                  </li>
                )}
              </ul>

              <button
                onClick={() => handlePurchase(pkg.id)}
                disabled={loading === pkg.id}
                className={`w-full ${
                  pkg.popular
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-slate-700 hover:bg-slate-600'
                } text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === pkg.id ? 'Processing...' : 'Purchase'}
              </button>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-slate-800/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-3">How it works</h3>
            <ul className="space-y-2 text-slate-300 text-sm">
              <li>• Each credit unlocks one qualified buyer lead</li>
              <li>• Leads are matched to your service area and preferences</li>
              <li>• Get instant access to buyer contact information</li>
              <li>• Monthly plans renew automatically and can be cancelled anytime</li>
              <li>• One-time purchases never expire</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
