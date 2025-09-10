'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface BuyerLead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
  preferredCity: string;
  preferredState: string;
  searchRadius: number;
  minBedrooms?: number;
  minBathrooms?: number;
  matchedProperties: number;
  perfectMatches?: number;
  goodMatches?: number;
  createdAt: string;
  matchPercentage?: number;
  matchReasoning?: string[];
  languages?: string[];
  alreadyPurchased?: boolean;
  propertyMatchSummary?: string;
}

interface PurchasedLead extends BuyerLead {
  purchasedAt: string;
  status: string;
  notes?: string;
}

interface RealtorProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  credits: number;
  isOnTrial: boolean;
  trialEndDate: string;
  profileComplete: boolean;
}

interface TransactionHistory {
  id: string;
  type: 'lead_purchase' | 'credit_purchase' | 'subscription_credit' | 'trial_credit';
  description: string;
  creditsChange: number;
  runningBalance: number;
  timestamp: string;
  details?: {
    buyerName?: string;
    buyerCity?: string;
    purchasePrice?: number;
    subscriptionPlan?: string;
  };
}

export default function BuyerLinkDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<RealtorProfile | null>(null);
  const [availableLeads, setAvailableLeads] = useState<BuyerLead[]>([]);
  const [purchasedLeads, setPurchasedLeads] = useState<PurchasedLead[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [transactionHistory, setTransactionHistory] = useState<TransactionHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionHistory | null>(null);
  const [disputeForm, setDisputeForm] = useState({
    reason: '',
    explanation: '',
    contactAttempts: '',
    evidence: ''
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/realtor/signin');
    }
    
    // Strict role checking - realtors only
    if (status === 'authenticated' && session?.user?.role !== 'realtor') {
      if (session?.user?.role === 'buyer') {
        router.push('/dashboard');
      } else {
        router.push('/realtor/signin');
      }
    }
  }, [status, router, session]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'realtor') {
      loadDashboardData();
    }
  }, [status, session]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load realtor profile with cache busting
      const profileResponse = await fetch(`/api/realtor/profile?t=${Date.now()}`);
      const profileData = await profileResponse.json();
      
      if (!profileData.profile) {
        router.push('/realtor/setup');
        return;
      }
      
      if (!profileData.profile.profileComplete) {
        router.push('/realtor/setup');
        return;
      }
      
      setProfile(profileData.profile);
      
      // Load available leads
      const leadsResponse = await fetch('/api/realtor/leads');
      const leadsData = await leadsResponse.json();
      
      if (leadsData.availableLeads) {
        setAvailableLeads(leadsData.availableLeads);
      }
      
      if (leadsData.purchasedLeads) {
        setPurchasedLeads(leadsData.purchasedLeads);
      }

      // Load transaction history
      const historyResponse = await fetch('/api/realtor/transaction-history');
      const historyData = await historyResponse.json();
      
      if (historyData.transactions) {
        setTransactionHistory(historyData.transactions);
      }
      
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const purchaseLead = async (leadId: string) => {
    if (!profile || profile.credits < 1) {
      setError('Insufficient credits. Please purchase more credits to continue.');
      return;
    }
    
    setPurchaseLoading(leadId);
    setError('');
    
    try {
      const response = await fetch('/api/realtor/purchase-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      // Update state smoothly instead of harsh page reload
      const purchasedLead = availableLeads.find(lead => lead.id === leadId);
      if (purchasedLead) {
        // Move lead from available to purchased
        setAvailableLeads(prev => prev.filter(lead => lead.id !== leadId));
        setPurchasedLeads(prev => [...prev, { 
          ...purchasedLead, 
          fullContactAccess: true,
          purchasedAt: new Date().toISOString(),
          status: 'active'
        }]);
        
        // Update credit balance
        if (profile) {
          setProfile(prev => prev ? { ...prev, credits: prev.credits - 1 } : prev);
        }
      }
      
      setError('✅ Lead purchased successfully! Contact information is now available in your purchased leads.');
      
    } catch (err) {
      setError('Failed to purchase lead. Please try again.');
    } finally {
      setPurchaseLoading(null);
    }
  };

  const openDisputeModal = (transaction: TransactionHistory) => {
    setSelectedTransaction(transaction);
    setShowDisputeModal(true);
    setDisputeForm({
      reason: '',
      explanation: '',
      contactAttempts: '',
      evidence: ''
    });
  };

  const submitDispute = async () => {
    // Validate all required fields
    if (!selectedTransaction) {
      setError('No transaction selected');
      return;
    }
    
    if (!disputeForm.reason) {
      setError('Please select a reason for the dispute');
      return;
    }
    
    if (!disputeForm.explanation || disputeForm.explanation.trim().length === 0) {
      setError('Please provide an explanation');
      return;
    }
    
    

    try {
      const response = await fetch('/api/realtor/dispute-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: selectedTransaction.id,
          reason: disputeForm.reason,
          explanation: disputeForm.explanation,
          contactAttempts: disputeForm.contactAttempts,
          evidence: disputeForm.evidence,
          buyerName: selectedTransaction.details?.buyerName || '',
          purchaseDate: selectedTransaction.timestamp
        })
      });

      const data = await response.json();
      
      console.log('🚨 Dispute API response:', data);

      if (data.error) {
        console.error('Dispute error:', data.error);
        alert(`Dispute failed: ${data.error}`);
        return;
      } else {
        setError('');
        setShowDisputeModal(false);
        setSuccessMessage('✅ Dispute submitted successfully. We will review and respond within 24 hours.');
        await loadDashboardData();
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      setError('Failed to submit dispute. Please try again.');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTrialDaysRemaining = () => {
    if (!profile?.isOnTrial || !profile?.trialEndDate) return 0;
    const endDate = new Date(profile.trialEndDate);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-bg">
      {/* Mobile-First Header */}
      <div className="bg-gradient-to-r from-accent-primary to-accent-success shadow-medium">
        <div className="px-6 py-4">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="flex items-center space-x-2 text-surface-bg/80 hover:text-surface-bg">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Home</span>
            </Link>
            
            <div className="flex items-center space-x-3">
              <Link 
                href="/realtor/settings" 
                className="flex items-center space-x-2 text-surface-bg/80 hover:text-surface-bg bg-white/10 rounded-lg px-3 py-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Settings</span>
              </Link>
              <button
                onClick={async () => {
                  try {
                    await signOut({ redirect: false });
                    router.push('/');
                  } catch (error) {
                    console.error('Sign out error:', error);
                  }
                }}
                className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-surface-bg rounded-lg text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
          
          {/* Welcome Header */}
          <div className="text-surface-bg">
            <h1 className="text-2xl font-bold mb-2">
              Welcome back, {profile?.firstName}! 👋
            </h1>
            <p className="text-surface-bg/80 text-sm">
              Your professional lead management center
            </p>
            {/* Debug info - remove in production */}
            <div className="text-xs text-surface-bg/60 mt-1">
              Account: {profile?.email || 'Loading...'} | Credits: {profile?.credits} | Profile ID: {profile?.id?.substring(0, 8)}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto">
        {/* Compact Stats - Only What Matters */}
        <div className="grid grid-cols-2 gap-3 mb-4 max-w-lg">
          <div className="bg-surface-bg rounded-lg p-3 shadow-soft border border-neutral-border h-20">
            <div className="flex items-center space-x-3 h-full">
              <div className="w-8 h-8 bg-accent-primary/10 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-accent-primary">{profile?.credits || 0}</div>
                <div className="text-xs text-secondary-text">Credits Balance</div>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-bg rounded-lg p-3 shadow-soft border border-neutral-border h-20">
            <div className="flex items-center space-x-3 h-full">
              <div className="w-8 h-8 bg-accent-success/10 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-accent-success" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-accent-success">{purchasedLeads.length}</div>
                <div className="text-xs text-secondary-text">Purchased Leads</div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-accent-danger/10 border border-accent-danger/20 rounded-xl p-4">
            <p className="text-accent-danger text-sm font-medium">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
            <p className="text-green-600 text-sm font-medium">{successMessage}</p>
          </div>
        )}

        {/* Trial Status Banner */}
        {profile?.isOnTrial && (
          <div className="mb-6 bg-gradient-to-r from-accent-success/10 to-accent-primary/10 border border-accent-success/20 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-8 h-8 bg-accent-success rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-surface-bg" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-accent-success text-lg">Free Trial Active</h3>
                </div>
                <p className="text-secondary-text">
                  <span className="font-medium text-primary-text">{getTrialDaysRemaining()} days remaining</span> with {profile.credits} credits available.
                </p>
              </div>
              <Link
                href="/realtor/settings#subscription"
                className="bg-accent-primary text-surface-bg px-6 py-3 rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors shadow-soft"
              >
                Upgrade Now
              </Link>
            </div>
          </div>
        )}

        {/* Available Leads Section */}
        <div className="bg-surface-bg rounded-xl shadow-soft border border-neutral-border">
          <div className="p-6 border-b border-neutral-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-accent-warm/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-warm" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary-text">
                    Available Buyer Leads
                  </h2>
                  <p className="text-sm text-secondary-text">
                    Pre-qualified buyers ready for owner financing
                  </p>
                </div>
              </div>
              <div className="bg-accent-warm/10 text-accent-warm font-bold text-lg px-3 py-1 rounded-lg">
                {availableLeads.length}
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {availableLeads.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-accent-warm/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-accent-warm" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="font-semibold text-primary-text mb-2 text-lg">No leads available right now</h3>
                <p className="text-secondary-text">
                  New buyer leads will appear here as they register for owner financing
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {availableLeads.map((lead) => (
                  <div key={lead.id} className="bg-gradient-to-r from-surface-bg to-accent-light/30 border border-neutral-border rounded-xl p-5 hover:shadow-medium transition-shadow">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-accent-success/10 rounded-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-accent-success" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-primary-text">
                                {lead.firstName} {lead.lastName}
                              </h3>
                              <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
                                {lead.alreadyPurchased ? (
                                  <span className="bg-green-500/10 text-green-600 text-xs font-medium px-2 py-1 rounded border border-green-200">
                                    ✅ Purchased
                                  </span>
                                ) : (
                                  <span className="bg-accent-success/10 text-accent-success text-xs font-medium px-2 py-1 rounded">
                                    🆕 Available
                                  </span>
                                )}
                                
                                {/* Property match count - most important metric */}
                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                  lead.matchedProperties >= 5 ? 'bg-emerald-500 text-white' :
                                  lead.matchedProperties >= 3 ? 'bg-blue-500 text-white' :
                                  lead.matchedProperties >= 1 ? 'bg-orange-500 text-white' :
                                  'bg-gray-400 text-white'
                                }`}>
                                  🏠 {lead.matchedProperties} {lead.perfectMatches > 0 ? `(${lead.perfectMatches} perfect)` : 'matches'}
                                </span>

                                {/* Realtor compatibility */}
                                {lead.matchPercentage && (
                                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                    lead.matchPercentage >= 80 ? 'bg-green-500 text-white' :
                                    lead.matchPercentage >= 60 ? 'bg-blue-500 text-white' :
                                    lead.matchPercentage >= 40 ? 'bg-yellow-500 text-white' :
                                    'bg-gray-500 text-white'
                                  }`}>
                                    🎯 {lead.matchPercentage}% Compatible
                                  </span>
                                )}

                                {/* Language indicator */}
                                {lead.languages && lead.languages.length > 0 && (
                                  <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-1 rounded">
                                    🗣️ {lead.languages.join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                          <div className="bg-surface-bg/50 rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-1">
                              <svg className="w-4 h-4 text-accent-success" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                              </svg>
                              <span className="font-medium text-primary-text">Budget</span>
                            </div>
                            <div className="font-semibold text-accent-success">{formatCurrency(lead.maxMonthlyPayment)}/mo</div>
                            <div className="text-secondary-text text-xs">{formatCurrency(lead.maxDownPayment)} down</div>
                          </div>
                          
                          <div className="bg-surface-bg/50 rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-1">
                              <svg className="w-4 h-4 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium text-primary-text">Location</span>
                            </div>
                            <div className="font-semibold text-primary-text">{lead.preferredCity}, {lead.preferredState}</div>
                            <div className="text-secondary-text text-xs">{lead.searchRadius} mile radius</div>
                          </div>
                          
                          <div className="bg-surface-bg/50 rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-1">
                              <svg className="w-4 h-4 text-accent-warm" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                              </svg>
                              <span className="font-medium text-primary-text">Needs</span>
                            </div>
                            <div className="font-semibold text-primary-text">
                              {lead.minBedrooms}+ bed, {lead.minBathrooms}+ bath
                            </div>
                            <div className="text-secondary-text text-xs">Created {formatDate(lead.createdAt)}</div>
                          </div>
                        </div>
                        
                        {/* Match reasoning - only show for high matches */}
                        {lead.matchPercentage && lead.matchPercentage >= 60 && lead.matchReasoning && (
                          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="text-xs font-medium text-green-800 mb-1">Why this is a great match:</div>
                            <div className="space-y-1">
                              {lead.matchReasoning.slice(0, 2).map((reason, index) => (
                                <div key={index} className="text-xs text-green-700 flex items-center space-x-1">
                                  <span>•</span>
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => purchaseLead(lead.id)}
                          disabled={purchaseLoading === lead.id || (profile?.credits || 0) < 1}
                          className="bg-accent-primary text-surface-bg px-6 py-3 rounded-lg font-semibold hover:bg-accent-hover disabled:bg-neutral-border disabled:cursor-not-allowed transition-colors shadow-soft min-h-[48px] flex items-center justify-center"
                        >
                          {purchaseLoading === lead.id ? (
                            <div className="flex items-center space-x-2">
                              <div className="w-4 h-4 border-2 border-surface-bg/30 border-t-surface-bg rounded-full animate-spin"></div>
                              <span>Purchasing...</span>
                            </div>
                          ) : (
                            <span>Accept Buyer (1 Credit)</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* My Purchased Leads Section */}
        <div className="bg-surface-bg rounded-xl shadow-soft border border-neutral-border">
          <div className="p-6 border-b border-neutral-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-accent-success/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-success" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary-text">
                    My Leads
                  </h2>
                  <p className="text-sm text-secondary-text">
                    Your purchased buyer leads
                  </p>
                </div>
              </div>
              <div className="bg-accent-success/10 text-accent-success font-bold text-lg px-3 py-1 rounded-lg">
                {purchasedLeads.length}
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {purchasedLeads.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-accent-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-accent-success" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-primary-text mb-2 text-lg">No purchased leads yet</h3>
                <p className="text-secondary-text">
                  Your accepted buyers will appear here with full contact details and property recommendations
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {purchasedLeads.map((lead) => (
                  <div key={lead.id} className="bg-gradient-to-r from-accent-success/5 to-accent-primary/5 border border-accent-success/20 rounded-xl p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-accent-success/10 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-accent-success" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-semibold text-primary-text text-lg">
                              {lead.firstName} {lead.lastName}
                            </h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`text-xs font-medium px-2 py-1 rounded ${
                                lead.status === 'purchased' ? 'bg-accent-primary/10 text-accent-primary' :
                                lead.status === 'contacted' ? 'bg-accent-warm/10 text-accent-warm' :
                                lead.status === 'converted' ? 'bg-accent-success/10 text-accent-success' :
                                'bg-neutral-border text-secondary-text'
                              }`}>
                                {lead.status}
                              </span>
                              <span className="text-xs text-secondary-text">
                                Purchased {formatDate(lead.purchasedAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col space-y-3 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0 text-sm">
                          <div className="bg-surface-bg/70 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4 text-accent-success" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                </svg>
                                <span className="font-medium text-primary-text">Contact Info</span>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(lead.phone || '');
                                    alert('Copied to clipboard!');
                                  }}
                                  className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                                  title="Copy phone number"
                                >
                                  Copy
                                </button>
                                <button
                                  onClick={() => window.open(`sms:${lead.phone}?body=Hi ${lead.firstName}, I'm reaching out regarding your home search in ${lead.preferredCity}. I have some great properties that match your criteria. When would be a good time to discuss?`, '_blank')}
                                  className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors"
                                  title="Send text message"
                                >
                                  Text
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="font-semibold text-accent-success">{lead.phone || 'No phone'}</div>
                              <div className="text-xs text-gray-600 truncate">{lead.email}</div>
                            </div>
                          </div>
                          
                          <div className="bg-surface-bg/70 rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-1">
                              <svg className="w-4 h-4 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                              </svg>
                              <span className="font-medium text-primary-text">Budget</span>
                            </div>
                            <div className="space-y-1">
                              <div className="font-semibold text-primary-text">{formatCurrency(lead.maxMonthlyPayment)}/mo</div>
                              <div className="text-sm text-gray-600">{formatCurrency(lead.maxDownPayment)} max down</div>
                            </div>
                          </div>
                          
                          <div className="bg-surface-bg/70 rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-1">
                              <svg className="w-4 h-4 text-accent-warm" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium text-primary-text">Location</span>
                            </div>
                            <div className="font-semibold text-primary-text">{lead.preferredCity}, {lead.preferredState}</div>
                          </div>
                        </div>
                        
                        {/* Property Matches Section */}
                        <div className="mt-4 flex items-center justify-between bg-blue-50 rounded-lg p-3">
                          <div>
                            <div className="text-sm font-medium text-blue-800">
                              {lead.matchedProperties || 0} Available Properties
                            </div>
                            <div className="text-xs text-blue-600">
                              {lead.perfectMatches || 0} perfect • {lead.goodMatches || 0} good matches
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              // Open property viewer for this buyer
                              window.open(`/realtor/buyer-properties?buyerId=${lead.id}`, '_blank');
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            View Properties
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Transaction History Section */}
        <div className="bg-surface-bg rounded-xl shadow-soft border border-neutral-border">
          <div className="p-6 border-b border-neutral-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-accent-warm/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-warm" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary-text">Transaction History</h2>
                  <p className="text-sm text-secondary-text">Credit changes and lead purchases</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-accent-primary text-sm font-medium hover:text-accent-hover"
              >
                {showHistory ? 'Hide' : 'View All'}
              </button>
            </div>
          </div>
          
          {showHistory && (
            <div className="p-6">
              {transactionHistory.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-accent-warm/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-accent-warm" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-primary-text mb-2 text-lg">No transaction history yet</h3>
                  <p className="text-secondary-text">Purchase leads or add credits to see your history</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactionHistory.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-surface-bg to-neutral-hover/30 rounded-lg border border-neutral-border/50">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          transaction.creditsChange > 0 
                            ? 'bg-accent-success/10 text-accent-success' 
                            : 'bg-accent-danger/10 text-accent-danger'
                        }`}>
                          {transaction.creditsChange > 0 ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-primary-text">{transaction.description}</div>
                          <div className="flex items-center space-x-4 text-xs text-secondary-text">
                            <span>{formatDate(transaction.timestamp)}</span>
                            {transaction.details?.buyerCity && (
                              <span>📍 {transaction.details.buyerCity}</span>
                            )}
                            {transaction.details?.purchasePrice && (
                              <span>💰 ${transaction.details.purchasePrice}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <div className={`font-bold ${
                            transaction.creditsChange > 0 ? 'text-accent-success' : 'text-accent-danger'
                          }`}>
                            {transaction.creditsChange > 0 ? '+' : ''}{transaction.creditsChange}
                          </div>
                          <div className="text-xs text-secondary-text">Balance: {transaction.runningBalance}</div>
                        </div>
                        {transaction.type === 'lead_purchase' && (
                          <button
                            onClick={() => openDisputeModal(transaction)}
                            className="bg-accent-danger/10 text-accent-danger hover:bg-accent-danger/20 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                            title="File a complaint or request refund"
                          >
                            🚨 Dispute
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dispute Modal */}
      {showDisputeModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-bg rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-primary-text">File Lead Complaint</h3>
                  <p className="text-sm text-secondary-text">Request a credit refund for unresponsive lead</p>
                </div>
                <button
                  onClick={() => setShowDisputeModal(false)}
                  className="text-secondary-text hover:text-primary-text"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-neutral-hover/50 rounded-lg p-4">
                <div className="text-sm font-medium text-primary-text">Lead Purchase Details:</div>
                <div className="text-xs text-secondary-text mt-1">
                  <div><strong>Buyer:</strong> {selectedTransaction.details?.buyerName}</div>
                  <div><strong>Location:</strong> {selectedTransaction.details?.buyerCity}</div>
                  <div><strong>Purchase Date:</strong> {formatDate(selectedTransaction.timestamp)}</div>
                  <div><strong>Cost:</strong> {Math.abs(selectedTransaction.creditsChange)} credit(s)</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-text mb-2">
                  Reason for Dispute *
                </label>
                <select
                  value={disputeForm.reason}
                  onChange={(e) => setDisputeForm(prev => ({...prev, reason: e.target.value}))}
                  className="w-full p-3 border border-neutral-border rounded-lg focus:ring-accent-primary focus:border-accent-primary"
                  required
                >
                  <option value="">Select a reason...</option>
                  <option value="no_response">Buyer never responded to contact</option>
                  <option value="invalid_contact">Phone/email not working</option>
                  <option value="not_qualified">Buyer not actually qualified</option>
                  <option value="already_working">Buyer already working with another agent</option>
                  <option value="false_information">Lead contained false information</option>
                  <option value="duplicate">Duplicate lead I already purchased</option>
                  <option value="other">Other (explain below)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-text mb-2">
                  Detailed Explanation *
                </label>
                <textarea
                  value={disputeForm.explanation}
                  onChange={(e) => setDisputeForm(prev => ({...prev, explanation: e.target.value}))}
                  className="w-full p-3 border border-neutral-border rounded-lg focus:ring-accent-primary focus:border-accent-primary h-24"
                  placeholder="Provide specific details about the issue with this lead..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-text mb-2">
                  Contact Attempts *
                </label>
                <textarea
                  value={disputeForm.contactAttempts}
                  onChange={(e) => setDisputeForm(prev => ({...prev, contactAttempts: e.target.value}))}
                  className="w-full p-3 border border-neutral-border rounded-lg focus:ring-accent-primary focus:border-accent-primary h-20"
                  placeholder="List dates/times you attempted to contact the buyer (e.g., Called 12/1 2pm, 12/2 10am, texted 12/3...)"
                  required
                />
              </div>


              <div className="bg-accent-warm/10 border border-accent-warm/20 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-accent-warm mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-accent-warm">
                    <strong>Important:</strong> Disputes are reviewed manually. False or frivolous complaints may result in account restrictions. We investigate all claims thoroughly.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-neutral-border flex items-center justify-between">
              <button
                onClick={() => setShowDisputeModal(false)}
                className="px-4 py-2 text-secondary-text hover:text-primary-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitDispute}
                disabled={!disputeForm.reason || !disputeForm.explanation}
                className="bg-accent-danger text-surface-bg px-6 py-2 rounded-lg font-semibold hover:bg-red-600 disabled:bg-neutral-border disabled:cursor-not-allowed transition-colors"
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}