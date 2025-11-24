'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExtendedSession } from '@/types/session';
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
  purchaseDate: string;
}

interface Transaction {
  id: string;
  description: string;
  creditsChange: number;
  runningBalance: number;
  type: string;
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
  const [disputeModal, setDisputeModal] = useState<{
    buyer: OwnedBuyer | null;
    reason: string;
    description: string;
    submitting: boolean;
  }>({
    buyer: null,
    reason: '',
    description: '',
    submitting: false
  });

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    } else if (status === 'authenticated' && (session as unknown as ExtendedSession)?.user?.role !== 'realtor') {
      router.push('/');
    }
  }, [status, session, router]);

  // Load dashboard data
  useEffect(() => {
    if (status === 'authenticated' && (session as unknown as ExtendedSession)?.user?.role === 'realtor') {
      loadDashboardData();
    }
  }, [status, session]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/realtor/dashboard');
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setDashboardData(data);
      }
    } catch {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const purchaseLead = async (leadId: string) => {
    setPurchaseLoading(leadId);
    try {
      const response = await fetch('/api/realtor/purchase-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId })
      });

      const result = await response.json();
      
      if (result.success) {
        await loadDashboardData(); // Refresh data
      } else {
        alert(result.error || 'Failed to purchase lead');
      }
    } catch {
      alert('Purchase failed');
    } finally {
      setPurchaseLoading(null);
    }
  };

  const openDisputeModal = (buyer: OwnedBuyer) => {
    setDisputeModal({
      buyer,
      reason: '',
      description: '',
      submitting: false
    });
  };

  const closeDisputeModal = () => {
    setDisputeModal({
      buyer: null,
      reason: '',
      description: '',
      submitting: false
    });
  };

  const submitDispute = async () => {
    if (!disputeModal.buyer || !disputeModal.reason || !disputeModal.description) {
      return;
    }

    setDisputeModal(prev => ({ ...prev, submitting: true }));

    try {
      const response = await fetch('/api/realtor/dispute-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: disputeModal.buyer.id,
          reason: disputeModal.reason,
          description: disputeModal.description
        })
      });

      const result = await response.json();

      if (result.success) {
        closeDisputeModal();
        await loadDashboardData(); // Refresh data
      } else {
        alert(result.error || 'Failed to submit dispute');
      }
    } catch {
      alert('Failed to submit dispute');
    } finally {
      setDisputeModal(prev => ({ ...prev, submitting: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-white font-medium">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">⚠️</div>
          <div className="text-white font-medium">{error || 'Failed to load dashboard'}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Clean Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50">
        {/* Top Row - Logo and Actions */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/realtor-dashboard" className="text-slate-400 hover:text-white transition-colors">
              ← Back to Hub
            </Link>
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="text-lg font-bold text-white">OwnerFi</span>
            </Link>
          </div>
          
          <div className="flex items-center gap-2">
            <Link
              href="/buy-credits"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              {dashboardData.realtorData.credits} Credits
            </Link>
            <Link
              href="/dashboard/settings"
              className="text-slate-400 hover:text-white transition-colors p-1.5"
              title="Settings"
            >
              ⚙️
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signout' })}
              className="text-slate-400 hover:text-red-400 transition-colors p-1.5"
              title="Logout"
            >
              ⏻
            </button>
          </div>
        </div>
        
        {/* Bottom Row - Welcome */}
        <div className="px-4 pb-3">
          <div className="text-slate-300 text-sm">Welcome back, <span className="text-white font-medium">{dashboardData.realtorData.firstName}</span></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        
        {/* Compact Navigation */}
        <div className="bg-slate-800/30 rounded-xl p-1 mb-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('available')}
              className={`flex-1 text-center py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'available' 
                  ? 'bg-emerald-500 text-white shadow-lg' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Available ({dashboardData.availableLeads.length})
            </button>
            <button
              onClick={() => setActiveTab('owned')}
              className={`flex-1 text-center py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'owned' 
                  ? 'bg-emerald-500 text-white shadow-lg' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Purchased ({dashboardData.ownedBuyers.length})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex-1 text-center py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'transactions' 
                  ? 'bg-emerald-500 text-white shadow-lg' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              History ({dashboardData.transactions.length})
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-slate-800/30 rounded-xl p-6">
          
          {/* Available Leads */}
          {activeTab === 'available' && (
            <div>
              {dashboardData.availableLeads.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">📭</div>
                  <h3 className="text-xl font-bold text-white mb-2">No leads available</h3>
                  <p className="text-slate-400">New buyer leads will appear here when they register in your area.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {dashboardData.availableLeads.map((lead) => (
                    <div key={lead.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-white font-bold text-lg">
                            {lead.firstName} {lead.lastName}
                          </h4>
                          <p className="text-slate-400 text-sm">{lead.city}, {lead.state}</p>
                        </div>
                        <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs font-medium">
                          New Lead
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => purchaseLead(lead.id)}
                          disabled={purchaseLoading === lead.id}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {purchaseLoading === lead.id ? 'Purchasing...' : 'Purchase Lead'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Purchased Buyers */}
          {activeTab === 'owned' && (
            <div>
              {dashboardData.ownedBuyers.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">👥</div>
                  <h3 className="text-xl font-bold text-white mb-2">No purchased leads</h3>
                  <p className="text-slate-400">Leads you purchase will appear here for ongoing communication.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {dashboardData.ownedBuyers.map((buyer) => (
                    <div key={buyer.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-white font-bold text-lg">
                            {buyer.firstName} {buyer.lastName}
                          </h4>
                          <p className="text-slate-400 text-sm">{buyer.city}, {buyer.state}</p>
                          <p className="text-emerald-400 text-sm font-medium">{buyer.phone}</p>
                          <p className="text-emerald-400 text-sm font-medium">{buyer.email}</p>
                        </div>
                        <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-medium">
                          Owned
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                          <div className="text-slate-400 text-xs">Budget Down</div>
                          <div className="text-white font-bold">${buyer.maxDownPayment.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                          <div className="text-slate-400 text-xs">Budget Payment</div>
                          <div className="text-white font-bold">${buyer.maxMonthlyPayment.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const searchQuery = `${buyer.firstName} ${buyer.lastName} ${buyer.city} ${buyer.state} real estate owner financing`;
                              window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank');
                            }}
                            className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                          >
                            View More Details
                          </button>
                          <a
                            href={`sms:${buyer.phone}&body=${encodeURIComponent("Hi, I see you&apos;re interested in owner finance properties through OwnerFi, how is everything going so far?")}`}
                            className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 px-3 rounded-lg text-sm font-medium transition-colors text-center"
                          >
                            Text
                          </a>
                        </div>
                        <button
                          onClick={() => openDisputeModal(buyer)}
                          className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
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

          {/* Transaction History */}
          {activeTab === 'transactions' && (
            <div>
              {dashboardData.transactions.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="text-xl font-bold text-white mb-2">No transactions</h3>
                  <p className="text-slate-400">Transaction history will appear as you purchase leads and credits.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboardData.transactions.map((transaction) => (
                    <div key={transaction.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            transaction.type === 'lead_purchase' ? 'bg-red-500/20 text-red-400' :
                            transaction.type === 'credit_purchase' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {transaction.type === 'lead_purchase' ? '📞' : 
                             transaction.type === 'credit_purchase' ? '💳' : '🔄'}
                          </div>
                          <div>
                            <div className="text-white font-medium">{transaction.description}</div>
                            <div className="text-slate-400 text-sm">
                              {new Date(transaction.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold text-lg ${transaction.creditsChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {transaction.creditsChange > 0 ? '+' : ''}{transaction.creditsChange}
                          </div>
                          <div className="text-slate-400 text-sm">Balance: {transaction.runningBalance}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Dispute Modal */}
      {disputeModal.buyer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Dispute Lead</h3>
              <button
                onClick={closeDisputeModal}
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <div className="text-white font-medium mb-1">
                {disputeModal.buyer.firstName} {disputeModal.buyer.lastName}
              </div>
              <div className="text-slate-400 text-sm">
                {disputeModal.buyer.city}, {disputeModal.buyer.state}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">Reason</label>
                <select
                  value={disputeModal.reason}
                  onChange={(e) => setDisputeModal(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white"
                >
                  <option value="">Select reason</option>
                  <option value="no_response">No response</option>
                  <option value="invalid_contact">Invalid contact info</option>
                  <option value="not_qualified">Not qualified</option>
                  <option value="already_working">Already working with another agent</option>
                  <option value="false_information">False information</option>
                  <option value="duplicate">Duplicate lead</option>
                  <option value="not_interested">Not interested</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">Description</label>
                <textarea
                  value={disputeModal.description}
                  onChange={(e) => setDisputeModal(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white h-24 resize-none"
                  placeholder="Please provide details about the issue..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={closeDisputeModal}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitDispute}
                  disabled={!disputeModal.reason || !disputeModal.description || disputeModal.submitting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {disputeModal.submitting ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}