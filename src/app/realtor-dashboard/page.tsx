'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface BuyerLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
  matchPercentage?: number;
  createdAt: string;
}

interface OwnedBuyer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
  purchasedAt: string;
  status: 'purchased' | 'contacted' | 'converted' | 'refunded';
}

interface Transaction {
  id: string;
  type: 'lead_purchase' | 'credit_purchase' | 'subscription_credit' | 'trial_credit' | 'refund';
  description: string;
  creditsChange: number;
  runningBalance: number;
  createdAt: string;
}

interface DashboardData {
  availableLeads: BuyerLead[];
  ownedBuyers: OwnedBuyer[];
  transactions: Transaction[];
  realtorData: {
    firstName: string;
    lastName: string;
    credits: number;
    isOnTrial: boolean;
    trialDaysRemaining: number;
  };
}

export default function RealtorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'owned' | 'transactions'>('available');
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [viewingProperties, setViewingProperties] = useState<{
    buyer: {
      id: string;
      firstName: string;
      lastName: string;
    };
    properties: {
      id: string;
      address: string;
      city: string;
      state: string;
      listPrice?: number;
      monthlyPayment?: number;
      downPaymentAmount?: number;
      bedrooms?: number;
      bathrooms?: number;
      squareFeet?: number;
    }[];
  } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated' && session?.user?.role !== 'realtor') {
      router.push('/');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'realtor') {
      loadDashboardData();
    }
  }, [status, session]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/realtor/dashboard');
      
      if (!response.ok) {
        throw new Error('Failed to load dashboard data');
      }
      
      const data = await response.json();
      setDashboardData(data);
      
      // Auto-switch to 'owned' tab if no available leads but has purchased leads
      if (data.availableLeads.length === 0 && data.ownedBuyers.length > 0) {
        setActiveTab('owned');
      }
    } catch (err) {
      setError('Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const purchaseLead = async (leadId: string, leadName: string) => {
    if (!dashboardData || dashboardData.realtorData.credits < 1) {
      setError('Insufficient credits.');
      return;
    }

    setPurchaseLoading(leadId);
    setError('');

    try {
      const response = await fetch('/api/realtor/purchase-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      await loadDashboardData();
      alert(`Successfully purchased lead for ${leadName}!`);
    } catch (err) {
      setError('Failed to purchase lead');
    } finally {
      setPurchaseLoading(null);
    }
  };

  const viewBuyerProperties = async (buyerId: string) => {
    try {
      const response = await fetch(`/api/realtor/buyer-liked-properties?buyerId=${buyerId}`);
      const data = await response.json();
      
      if (data.error) {
        alert(`Error: ${data.error}`);
        return;
      }

      setViewingProperties(data);
    } catch (err) {
      alert('Failed to load buyer properties');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <div className="text-2xl font-bold text-white">LOADING DASHBOARD</div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-6 text-lg">{error || 'Failed to load dashboard'}</p>
          <button onClick={loadDashboardData} className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold">
            TRY AGAIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* HEADER */}
      <header className="bg-slate-800/50 border-b border-slate-700/50 px-6 py-4">
        <div className="space-y-4">
          {/* Top Row - Logo + 4 Buttons */}
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">O</span>
                </div>
                <span className="text-xl font-bold text-white">OwnerFi</span>
              </div>
            </Link>
            
            <div className="flex gap-3">
              <Link href="/realtor-dashboard" className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                <span className="text-white">📊</span>
              </Link>
              <Link href="/buy-credits" className="w-10 h-10 bg-slate-600 hover:bg-orange-500 rounded-lg flex items-center justify-center transition-colors">
                <span className="text-white">💳</span>
              </Link>
              <Link href="/realtor-dashboard/settings" className="w-10 h-10 bg-slate-600 hover:bg-slate-500 rounded-lg flex items-center justify-center transition-colors">
                <span className="text-white">⚙</span>
              </Link>
              <button onClick={() => signOut({ callbackUrl: '/' })} className="w-10 h-10 bg-slate-600 hover:bg-red-500 rounded-lg flex items-center justify-center transition-colors">
                <span className="text-white">⏻</span>
              </button>
            </div>
          </div>
          
          {/* Bottom Row - Welcome + Credits */}
          <div className="flex items-center justify-between">
            <div className="text-slate-300">
              Welcome, <span className="text-white font-bold">Abdullah</span>
            </div>
            <div className="text-emerald-400 font-bold text-lg">
              {dashboardData.realtorData.credits} credits
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="bg-red-500/20 border border-red-400/30 text-red-300 px-4 py-3 rounded-xl">{error}</div>
        </div>
      )}

      {/* MINIMAL DASHBOARD */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Simple Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'available' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Available ({dashboardData.availableLeads.length})
          </button>
          <button
            onClick={() => setActiveTab('owned')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'owned' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Purchased ({dashboardData.ownedBuyers.length})
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'transactions' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            History ({dashboardData.transactions.length})
          </button>
        </div>

        {/* Clean Content Area */}
        <div className="bg-slate-800/30 rounded-xl overflow-hidden">
          
          {/* Available Leads - SCALABLE TABLE */}
          {activeTab === 'available' && (
            <div className="p-6">
              {dashboardData.availableLeads.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-slate-300 mb-4 text-6xl">📭</div>
                  <h3 className="text-xl font-semibold text-slate-200 mb-2">No leads available</h3>
                  <p className="text-slate-300">New buyer leads will appear here when they register in your area.</p>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto space-y-3">
                  {dashboardData.availableLeads.map((lead) => (
                    <div key={lead.id} className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4 hover:bg-slate-700/40 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-white text-lg">{lead.firstName} {lead.lastName}</h3>
                          <div className="text-slate-300 text-sm">{lead.city}, {lead.state}</div>
                        </div>
                        <div className="text-right">
                          <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs font-bold">
                            {lead.matchPercentage || 85}% match
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <span className="text-emerald-400 font-semibold">${lead.maxMonthlyPayment.toLocaleString()}/mo</span>
                          <span className="text-slate-400 mx-2">•</span>
                          <span className="text-blue-400 font-semibold">${lead.maxDownPayment.toLocaleString()} down</span>
                        </div>
                        <button
                          onClick={() => purchaseLead(lead.id, `${lead.firstName} ${lead.lastName}`)}
                          disabled={purchaseLoading === lead.id || dashboardData.realtorData.credits < 1}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
                        >
                          {purchaseLoading === lead.id ? 'Buying...' : 'Buy (1 Credit)'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Purchased Leads - SCALABLE TABLE */}
          {activeTab === 'owned' && (
            <div className="p-6">
              {dashboardData.ownedBuyers.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-slate-300 mb-4 text-6xl">👥</div>
                  <h3 className="text-xl font-semibold text-slate-200 mb-2">No purchased leads</h3>
                  <p className="text-slate-300">Purchased leads will appear here with full contact details.</p>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto space-y-3">
                  {dashboardData.ownedBuyers.map((buyer) => (
                    <div key={buyer.id} className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <h3 className="font-medium text-white text-lg">{buyer.firstName} {buyer.lastName}</h3>
                          <div className="text-slate-300 text-sm">{buyer.city}, {buyer.state}</div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            buyer.status === 'purchased' ? 'bg-yellow-500/20 text-yellow-400' :
                            buyer.status === 'contacted' ? 'bg-blue-500/20 text-blue-400' :
                            buyer.status === 'converted' ? 'bg-green-500/20 text-green-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {buyer.status}
                          </span>
                          <div className="text-slate-400 text-xs mt-1">
                            {new Date(buyer.purchasedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <div className="text-emerald-300 text-sm font-normal">{buyer.email}</div>
                          <div className="text-blue-300 text-sm font-normal">{buyer.phone}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-300 font-medium">${buyer.maxMonthlyPayment.toLocaleString()}/mo</div>
                          <div className="text-blue-300 text-sm">${buyer.maxDownPayment.toLocaleString()} down</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <a 
                          href={`sms:${buyer.phone}?body=${encodeURIComponent(`Hey ${buyer.firstName}, this is ${dashboardData.realtorData.firstName} from OwnerFi. I see you're interested in owner-financed properties in ${buyer.city}. When would you like to see some options?`)}`}
                          className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 py-2 px-3 rounded text-center text-sm font-semibold transition-colors"
                        >
                          Text
                        </a>
                        <button 
                          onClick={() => viewBuyerProperties(buyer.id)}
                          className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 py-2 px-3 rounded text-center text-sm font-semibold transition-colors"
                        >
                          Properties
                        </button>
                        <button 
                          onClick={() => {
                            alert(`Dispute feature coming soon for ${buyer.firstName} ${buyer.lastName}`);
                          }}
                          className="bg-red-600/20 hover:bg-red-600/30 text-red-400 py-2 px-3 rounded text-center text-sm font-semibold transition-colors"
                        >
                          Dispute
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Transaction History - SCALABLE TABLE */}
          {activeTab === 'transactions' && (
            <div className="p-6">
              {dashboardData.transactions.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-slate-300 mb-4 text-6xl">📊</div>
                  <h3 className="text-xl font-semibold text-slate-200 mb-2">No transactions</h3>
                  <p className="text-slate-300">Transaction history will appear as you purchase leads and credits.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700/50">
                        <th className="text-left py-3 text-slate-400 font-semibold text-sm">DESCRIPTION</th>
                        <th className="text-right py-3 text-slate-400 font-semibold text-sm">CREDITS</th>
                        <th className="text-right py-3 text-slate-400 font-semibold text-sm">BALANCE</th>
                        <th className="text-right py-3 text-slate-400 font-semibold text-sm">TYPE</th>
                        <th className="text-right py-3 text-slate-400 font-semibold text-sm">DATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.transactions.map((transaction) => (
                        <tr key={transaction.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                          <td className="py-4 text-slate-300">
                            {transaction.description}
                          </td>
                          <td className="py-4 text-right">
                            <span className={`font-semibold ${transaction.creditsChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {transaction.creditsChange > 0 ? '+' : ''}{transaction.creditsChange}
                            </span>
                          </td>
                          <td className="py-4 text-right text-white font-semibold">
                            {transaction.runningBalance}
                          </td>
                          <td className="py-4 text-right">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              transaction.type === 'lead_purchase' ? 'bg-red-500/20 text-red-400' :
                              transaction.type === 'credit_purchase' ? 'bg-green-500/20 text-green-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {transaction.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-4 text-right text-slate-300 text-sm">
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Buyer Liked Properties Modal */}
      {viewingProperties && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {viewingProperties.buyer.firstName}'s Liked Properties
                </h2>
                <button 
                  onClick={() => setViewingProperties(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {viewingProperties.properties.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-slate-400 mb-4 text-4xl">💔</div>
                  <h3 className="text-lg font-semibold text-white mb-2">No liked properties</h3>
                  <p className="text-slate-400">This buyer hasn't liked any properties yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {viewingProperties.properties.map((property) => (
                    <div key={property.id} className="bg-slate-700/30 border border-slate-600/50 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-3 gap-4 p-4">
                        <div className="col-span-2">
                          <h3 className="font-semibold text-white mb-1">{property.address}</h3>
                          <p className="text-slate-300 text-sm mb-2">{property.city}, {property.state}</p>
                          <div className="space-y-1 text-sm">
                            <div className="text-slate-300">
                              <span className="text-emerald-400">${property.listPrice?.toLocaleString()}</span> list price
                            </div>
                            <div className="text-slate-300">
                              <span className="text-emerald-400">${Math.ceil(property.monthlyPayment || 0).toLocaleString()}</span>/mo est
                            </div>
                            <div className="text-slate-300">
                              <span className="text-blue-400">${property.downPaymentAmount?.toLocaleString()}</span> down est
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-slate-300 mb-3">
                            <div>{property.bedrooms} bed</div>
                            <div>{property.bathrooms} bath</div>
                            <div>{property.squareFeet?.toLocaleString()} sq ft</div>
                          </div>
                          <button
                            onClick={() => {
                              const searchQuery = `${property.address}, ${property.city}, ${property.state}`;
                              window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank');
                            }}
                            className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-2 rounded text-sm font-semibold transition-colors w-full"
                          >
                            Google Search
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}