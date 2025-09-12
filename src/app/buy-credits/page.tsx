'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ActiveSubscription {
  id: string;
  status: string;
  current_period_end: number;
  credits?: number;
  price?: number;
  items?: {
    data: Array<{
      price?: {
        nickname?: string;
      };
    }>;
  };
  cancel_at_period_end?: boolean;
}

export default function BuyCredits() {
  const router = useRouter();
  const [selectedPack, setSelectedPack] = useState('4_credits');
  const [loading, setLoading] = useState(false);
  const [activeSubscriptions, setActiveSubscriptions] = useState<ActiveSubscription[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true);
  const [canceling, setCanceling] = useState('');

  const creditPacks = [
    { 
      id: '1_credit', 
      credits: 1, 
      price: 300, 
      popular: false, 
      recurring: false,
      description: 'Single lead'
    },
    { 
      id: '4_credits', 
      credits: 4, 
      price: 500, 
      popular: true, 
      recurring: true,
      description: 'Most popular'
    },
    { 
      id: '10_credits', 
      credits: 10, 
      price: 1000, 
      popular: false, 
      recurring: true,
      description: 'Best value'
    },
    { 
      id: '60_credits', 
      credits: 60, 
      price: 3000, 
      popular: false, 
      recurring: false,
      description: 'Enterprise'
    }
  ];

  // Load active subscriptions
  useEffect(() => {
    const loadSubscriptions = async () => {
      try {
        const response = await fetch('/api/stripe/billing-portal', {
          method: 'GET',
        });
        if (response.ok) {
          const data = await response.json();
          setActiveSubscriptions(data.subscriptions || []);
        }
      } catch (error) {
        
      } finally {
        setLoadingSubscriptions(false);
      }
    };
    
    loadSubscriptions();
  }, []);

  const handleCancelSubscription = async (subscriptionId: string) => {
    setCanceling(subscriptionId);
    try {
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId })
      });

      if (response.ok) {
        // Remove from active subscriptions
        setActiveSubscriptions(prev => prev.filter(sub => sub.id !== subscriptionId));
      } else {
        alert('Failed to cancel subscription');
      }
    } catch (error) {
      alert('Failed to cancel subscription');
    } finally {
      setCanceling('');
    }
  };

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
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Simple Header */}
      <div className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-4 py-4">
        <Link href="/realtor-dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          <span className="text-lg font-bold text-white">OwnerFi</span>
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 py-3 max-w-md mx-auto w-full" style={{height: 'calc(100vh - 80px)', overflow: 'auto'}}>
        
        {/* Title */}
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-white mb-1">
            Choose Your Plan
          </h1>
          <p className="text-slate-300 text-sm">
            Select leads package
          </p>
        </div>

        {/* Active Subscriptions */}
        {!loadingSubscriptions && activeSubscriptions.length > 0 && (
          <div className="mb-4">
            <h3 className="text-base font-semibold text-white mb-2">Active Subscriptions</h3>
            <div className="space-y-2">
              {activeSubscriptions.map((subscription) => (
                <div
                  key={subscription.id}
                  className="p-4 bg-blue-500/10 border border-blue-400/30 rounded-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">
                        {subscription.credits} Leads - ${subscription.price}/month
                      </div>
                      <div className="text-slate-400 text-sm">
                        Next billing: {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelSubscription(subscription.id)}
                      disabled={canceling === subscription.id}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 px-3 py-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {canceling === subscription.id ? 'Canceling...' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simple Plan Options */}
        <div className="space-y-2 mb-4">
          {creditPacks.map((pack) => (
            <div
              key={pack.id}
              onClick={() => setSelectedPack(pack.id)}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                selectedPack === pack.id
                  ? 'border-emerald-400 bg-emerald-500/10'
                  : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">
                      {pack.credits} {pack.credits === 1 ? 'Lead' : 'Leads'}
                    </span>
                    {pack.popular && (
                      <span className="bg-emerald-500 text-white px-2 py-0.5 rounded text-xs font-bold">
                        POPULAR
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 text-sm mt-1">
                    {pack.description}
                    {pack.recurring && ' • Monthly'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">${pack.price}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Purchase Button */}
        <button
          onClick={handlePurchase}
          disabled={!selectedPack || loading}
          className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {loading ? 'Processing...' : 'Get Leads Now'}
        </button>
        
        <p className="text-center text-white text-sm">
          🔒 Secure payment • Credits never expire
        </p>

        {/* Back Link */}
        <div className="text-center mt-3">
          <Link href="/realtor-dashboard" className="text-slate-400 hover:text-white transition-colors text-sm">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}