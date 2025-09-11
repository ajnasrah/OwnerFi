'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BuyCredits() {
  const router = useRouter();
  const [selectedPack, setSelectedPack] = useState('4_credits');
  const [loading, setLoading] = useState(false);

  const creditPacks = [
    { 
      id: '1_credit', 
      credits: 1, 
      price: 8, 
      popular: false, 
      recurring: false, 
      description: 'Try it out',
      savings: null
    },
    { 
      id: '4_credits', 
      credits: 4, 
      price: 25, 
      popular: true, 
      recurring: true, 
      description: 'Most popular',
      savings: '22% off'
    },
    { 
      id: '10_credits', 
      credits: 10, 
      price: 50, 
      popular: false, 
      recurring: true, 
      description: 'Best value',
      savings: '38% off'
    },
    { 
      id: '60_credits', 
      credits: 60, 
      price: 240, 
      popular: false, 
      recurring: false, 
      description: 'Enterprise',
      savings: '50% off'
    },
  ];

  const handlePurchase = async () => {
    if (!selectedPack) return;
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/stripe/simple-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditPackId: selectedPack
        })
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert('Error creating checkout');
      }
      
    } catch (error) {
      alert('Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23059669%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%224%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40"></div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          {/* Header */}
          <div className="text-center mb-16">
            <Link href="/realtor-dashboard" className="inline-block mb-8">
              <div className="flex items-center justify-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">O</span>
                </div>
                <span className="text-3xl font-bold text-white">OwnerFi</span>
              </div>
            </Link>
            
            <h1 className="text-5xl font-bold text-white mb-4">
              Get More <span className="text-emerald-400">Qualified Leads</span>
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              Stop wasting time on unqualified prospects. Our pre-screened buyers are ready to purchase owner-financed properties in your area.
            </p>
            
            {/* Value Props */}
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
              <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl p-6 border border-slate-700/50">
                <div className="text-emerald-400 text-4xl mb-3">🎯</div>
                <h3 className="text-white font-semibold mb-2">Pre-Qualified Buyers</h3>
                <p className="text-slate-300 text-sm">Every lead has confirmed income, down payment ready, and credit pre-screened</p>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl p-6 border border-slate-700/50">
                <div className="text-emerald-400 text-4xl mb-3">💰</div>
                <h3 className="text-white font-semibold mb-2">Owner Finance Ready</h3>
                <p className="text-slate-300 text-sm">Buyers specifically seeking creative financing - no bank approval needed</p>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl p-6 border border-slate-700/50">
                <div className="text-emerald-400 text-4xl mb-3">⚡</div>
                <h3 className="text-white font-semibold mb-2">Instant Contact Info</h3>
                <p className="text-slate-300 text-sm">Get phone, email, and buyer preferences immediately - no waiting</p>
              </div>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">Choose Your Lead Package</h2>
              <p className="text-slate-300 text-lg">Industry's best prices - competitors charge $50-200+ per lead</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {creditPacks.map((pack) => (
                <div
                  key={pack.id}
                  onClick={() => setSelectedPack(pack.id)}
                  className={`relative cursor-pointer transition-all duration-300 ${
                    selectedPack === pack.id
                      ? 'scale-105 shadow-2xl shadow-emerald-500/20'
                      : 'hover:scale-102'
                  }`}
                >
                  <div className={`p-8 rounded-2xl border-2 h-full ${
                    selectedPack === pack.id
                      ? 'border-emerald-400 bg-gradient-to-b from-slate-800/90 to-emerald-900/20'
                      : pack.popular
                      ? 'border-emerald-500/50 bg-slate-800/70'
                      : 'border-slate-700 bg-slate-800/50'
                  } backdrop-blur-lg`}>
                    
                    {pack.popular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                          MOST POPULAR
                        </div>
                      </div>
                    )}
                    
                    {pack.savings && (
                      <div className="absolute -top-2 -right-2">
                        <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                          {pack.savings}
                        </div>
                      </div>
                    )}
                    
                    <div className="text-center">
                      <div className="text-emerald-400 text-5xl font-bold mb-2">{pack.credits}</div>
                      <div className="text-slate-300 text-lg mb-4">{pack.credits === 1 ? 'Lead' : 'Leads'}</div>
                      
                      <div className="mb-6">
                        <div className="text-4xl font-bold text-white mb-1">${pack.price}</div>
                        <div className="text-emerald-400 text-lg font-semibold">
                          ${(pack.price / pack.credits).toFixed(0)} per lead
                        </div>
                        <div className="text-slate-400 text-sm mt-2">{pack.description}</div>
                      </div>
                      
                      {pack.recurring && (
                        <div className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm font-medium mb-4">
                          Monthly Subscription
                        </div>
                      )}
                      
                      {/* Features */}
                      <div className="space-y-2 text-left">
                        <div className="flex items-center text-slate-300 text-sm">
                          <span className="text-emerald-400 mr-2">✓</span>
                          Full contact details
                        </div>
                        <div className="flex items-center text-slate-300 text-sm">
                          <span className="text-emerald-400 mr-2">✓</span>
                          Pre-screened buyers
                        </div>
                        <div className="flex items-center text-slate-300 text-sm">
                          <span className="text-emerald-400 mr-2">✓</span>
                          Owner finance ready
                        </div>
                        <div className="flex items-center text-slate-300 text-sm">
                          <span className="text-emerald-400 mr-2">✓</span>
                          Budget & preferences
                        </div>
                        {pack.credits >= 4 && (
                          <div className="flex items-center text-emerald-300 text-sm font-medium">
                            <span className="text-emerald-400 mr-2">✓</span>
                            Priority support
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {selectedPack === pack.id && (
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-2xl -z-10 opacity-75"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Purchase Section */}
            <div className="text-center mt-16">
              <button
                onClick={handlePurchase}
                disabled={!selectedPack || loading}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-16 py-5 rounded-2xl font-bold text-xl transition-all duration-300 hover:scale-105 shadow-2xl shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <span className="flex items-center gap-3">
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </span>
                ) : (
                  'Get Qualified Leads Now'
                )}
              </button>
              
              <div className="mt-8 space-y-2">
                <p className="text-slate-300 font-medium">
                  🔒 Secure payment via Stripe • Credits never expire
                </p>
                <p className="text-emerald-400 text-lg font-semibold">
                  30-day money-back guarantee on all purchases
                </p>
              </div>
            </div>
          </div>
          
          {/* Social Proof */}
          <div className="mt-20 text-center">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-2xl font-bold text-white mb-8">Trusted by 500+ Real Estate Professionals</h3>
              
              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/50">
                  <div className="text-emerald-400 mb-3">⭐⭐⭐⭐⭐</div>
                  <p className="text-slate-300 mb-4">"Closed 3 deals in my first month. These buyers actually have money and are ready to move."</p>
                  <p className="text-white font-semibold">- Sarah M., Dallas Agent</p>
                </div>
                
                <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/50">
                  <div className="text-emerald-400 mb-3">⭐⭐⭐⭐⭐</div>
                  <p className="text-slate-300 mb-4">"Way better than Zillow leads. Every contact actually answers their phone."</p>
                  <p className="text-white font-semibold">- Mike T., Houston Realtor</p>
                </div>
                
                <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/50">
                  <div className="text-emerald-400 mb-3">⭐⭐⭐⭐⭐</div>
                  <p className="text-slate-300 mb-4">"$8 per lead vs $150+ elsewhere. No brainer for owner finance deals."</p>
                  <p className="text-white font-semibold">- Jennifer R., Austin Agent</p>
                </div>
              </div>
            </div>
          </div>

          {/* Back Link */}
          <div className="text-center mt-16">
            <Link href="/realtor-dashboard" className="text-slate-400 hover:text-white transition-colors text-lg">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}