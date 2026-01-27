'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExtendedSession } from '@/types/session';
import Link from 'next/link';
import { trackEvent } from '@/components/analytics/AnalyticsProvider';

interface BuyerLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  matchPercentage?: number;
  matchScore?: number;
  matchReasons?: string[];
  likedPropertiesCount?: number;
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

interface Agreement {
  id: string;
  agreementNumber: string;
  status: string;
  prospectFirstName?: string;
  prospectLastName?: string;
  prospectName?: string;
  prospectCity?: string;
  prospectState?: string;
  prospectEmail?: string | null;
  prospectPhone?: string | null;
  // Legacy field names for compatibility
  buyerFirstName?: string;
  buyerLastName?: string;
  buyerCity?: string;
  buyerState?: string;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  referralFeePercent: number;
  leadInfoReleased: boolean;
  effectiveDate: string;
  expirationDate: string;
  signedAt?: string | null;
  createdAt: string;
  // Re-referral fields
  isReReferral?: boolean;
  canBeReReferred?: boolean;
  referralInviteToken?: string;
  hasActiveInvite?: boolean;
  referralInviteFeePercent?: number;
}

interface ReferralModalState {
  isOpen: boolean;
  agreement: Agreement | null;
  feePercent: number;
  loading: boolean;
  success: boolean;
  inviteUrl: string | null;
  error: string | null;
  shareMethod: 'select' | 'email' | 'text' | 'copy';
  shareEmail: string;
  sharePhone: string;
  copied: boolean;
}

interface DashboardData {
  availableLeads: BuyerLead[];
  ownedBuyers: OwnedBuyer[];
  transactions: Transaction[];
  realtorData: {
    firstName: string;
    lastName: string;
    credits: number;
  };
}

interface AgreementModalState {
  isOpen: boolean;
  step: 'loading' | 'review' | 'signing' | 'success';
  leadId: string | null;
  agreementId: string | null;
  agreementNumber: string | null;
  agreementHTML: string | null;
  terms: {
    referralFeePercent: number;
    agreementTermDays: number;
    expirationDate: string;
  } | null;
  buyerName: string | null;
  buyerDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    state: string;
  } | null;
  typedName: string;
  agreeToTerms: boolean;
  agreeTCPA: boolean;
  agreeCreativeFinance: boolean;
  agreeDataAsIs: boolean;
  error: string | null;
}

export default function RealtorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'agreements' | 'owned' | 'transactions'>('available');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  // Agreement modal state
  const [agreementModal, setAgreementModal] = useState<AgreementModalState>({
    isOpen: false,
    step: 'loading',
    leadId: null,
    agreementId: null,
    agreementNumber: null,
    agreementHTML: null,
    terms: null,
    buyerName: null,
    buyerDetails: null,
    typedName: '',
    agreeToTerms: false,
    agreeTCPA: false,
    agreeCreativeFinance: false,
    agreeDataAsIs: false,
    error: null
  });

  // Dispute modal state
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

  // Referral modal state (for re-referring leads to other agents)
  const [referralModal, setReferralModal] = useState<ReferralModalState>({
    isOpen: false,
    agreement: null,
    feePercent: 25,
    loading: false,
    success: false,
    inviteUrl: null,
    error: null,
    shareMethod: 'select',
    shareEmail: '',
    sharePhone: '',
    copied: false
  });

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    } else if (status === 'authenticated' && (session as unknown as ExtendedSession)?.user?.role !== 'realtor') {
      router.push('/');
    }
  }, [status, session, router]);

  // Load data
  useEffect(() => {
    if (status === 'authenticated' && (session as unknown as ExtendedSession)?.user?.role === 'realtor') {
      loadDashboardData();
      loadAgreements();
    }
  }, [status, session]);

  const loadDashboardData = async (search?: string, city?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (city) params.set('city', city);

      const url = `/api/realtor/dashboard${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
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

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (status === 'authenticated') {
        loadDashboardData(searchQuery, cityFilter);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, cityFilter, status]);

  const loadAgreements = async () => {
    try {
      const response = await fetch('/api/realtor/agreements');
      const data = await response.json();

      if (data.success) {
        setAgreements(data.agreements);
      }
    } catch {
      console.error('Failed to load agreements');
    }
  };

  // Accept Lead Flow - Step 1: Generate Agreement
  const acceptLead = async (leadId: string, buyerName: string) => {
    setAgreementModal({
      isOpen: true,
      step: 'loading',
      leadId,
      agreementId: null,
      agreementNumber: null,
      agreementHTML: null,
      terms: null,
      buyerName,
      buyerDetails: null,
      typedName: '',
      agreeToTerms: false,
      agreeTCPA: false,
      agreeCreativeFinance: false,
      agreeDataAsIs: false,
      error: null
    });

    try {
      const response = await fetch('/api/realtor/agreements/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId })
      });

      const result = await response.json();

      if (result.success) {
        setAgreementModal(prev => ({
          ...prev,
          step: 'review',
          agreementId: result.agreementId,
          agreementNumber: result.agreementNumber,
          agreementHTML: result.agreementHTML,
          terms: result.terms
        }));
      } else {
        setAgreementModal(prev => ({
          ...prev,
          step: 'review',
          error: result.error || 'Failed to generate agreement'
        }));
      }
    } catch {
      setAgreementModal(prev => ({
        ...prev,
        step: 'review',
        error: 'Failed to generate agreement. Please try again.'
      }));
    }
  };

  // Accept Lead Flow - Step 2: Sign Agreement
  const signAgreement = async () => {
    // Validate all required fields including acknowledgments
    if (!agreementModal.agreementId || !agreementModal.typedName ||
        !agreementModal.agreeToTerms || !agreementModal.agreeTCPA ||
        !agreementModal.agreeCreativeFinance || !agreementModal.agreeDataAsIs) {
      return;
    }

    setAgreementModal(prev => ({ ...prev, step: 'signing', error: null }));

    try {
      const response = await fetch('/api/realtor/agreements/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreementId: agreementModal.agreementId,
          typedName: agreementModal.typedName,
          agreeToTerms: agreementModal.agreeToTerms,
          agreeTCPA: agreementModal.agreeTCPA,
          agreeCreativeFinance: agreementModal.agreeCreativeFinance,
          agreeDataAsIs: agreementModal.agreeDataAsIs
        })
      });

      const result = await response.json();

      if (result.success) {
        setAgreementModal(prev => ({
          ...prev,
          step: 'success',
          buyerDetails: result.buyerDetails
        }));
        // Refresh data
        loadDashboardData();
        loadAgreements();
      } else {
        setAgreementModal(prev => ({
          ...prev,
          step: 'review',
          error: result.error || 'Failed to sign agreement'
        }));
      }
    } catch {
      setAgreementModal(prev => ({
        ...prev,
        step: 'review',
        error: 'Failed to sign agreement. Please try again.'
      }));
    }
  };

  const closeAgreementModal = () => {
    setAgreementModal({
      isOpen: false,
      step: 'loading',
      leadId: null,
      agreementId: null,
      agreementNumber: null,
      agreementHTML: null,
      terms: null,
      buyerName: null,
      buyerDetails: null,
      typedName: '',
      agreeToTerms: false,
      agreeTCPA: false,
      agreeCreativeFinance: false,
      agreeDataAsIs: false,
      error: null
    });
  };

  // Dispute functions
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
        await loadDashboardData();
      } else {
        alert(result.error || 'Failed to submit dispute');
      }
    } catch {
      alert('Failed to submit dispute');
    } finally {
      setDisputeModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // Referral functions (for re-referring leads to other agents)
  const openReferralModal = (agreement: Agreement) => {
    // If there's already an active invite, skip to the share drawer
    if (agreement.hasActiveInvite) {
      // Fetch the existing invite URL from the API
      setReferralModal({
        isOpen: true,
        agreement,
        feePercent: agreement.referralInviteFeePercent || 25,
        loading: true,
        success: false,
        inviteUrl: null,
        error: null,
        shareMethod: 'select',
        shareEmail: '',
        sharePhone: '',
        copied: false
      });
      // Fetch existing invite
      fetch('/api/realtor/referral/create-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreementId: agreement.id,
          referralFeePercent: agreement.referralInviteFeePercent || 25
        })
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setReferralModal(prev => ({
              ...prev,
              loading: false,
              success: true,
              inviteUrl: data.inviteUrl
            }));
          } else {
            setReferralModal(prev => ({
              ...prev,
              loading: false,
              error: data.error
            }));
          }
        })
        .catch(() => {
          setReferralModal(prev => ({
            ...prev,
            loading: false,
            error: 'Failed to load invite link'
          }));
        });
    } else {
      setReferralModal({
        isOpen: true,
        agreement,
        feePercent: 25,
        loading: false,
        success: false,
        inviteUrl: null,
        error: null,
        shareMethod: 'select',
        shareEmail: '',
        sharePhone: '',
        copied: false
      });
    }
  };

  const closeReferralModal = () => {
    setReferralModal({
      isOpen: false,
      agreement: null,
      feePercent: 25,
      loading: false,
      success: false,
      inviteUrl: null,
      error: null,
      shareMethod: 'select',
      shareEmail: '',
      sharePhone: '',
      copied: false
    });
  };

  const createReferralInvite = async () => {
    if (!referralModal.agreement) return;

    setReferralModal(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/realtor/referral/create-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreementId: referralModal.agreement.id,
          referralFeePercent: referralModal.feePercent
        })
      });

      const result = await response.json();

      if (result.success) {
        setReferralModal(prev => ({
          ...prev,
          loading: false,
          success: true,
          inviteUrl: result.inviteUrl
        }));
        // Refresh agreements to update the UI
        loadAgreements();
      } else {
        setReferralModal(prev => ({
          ...prev,
          loading: false,
          error: result.error || 'Failed to create referral invite'
        }));
      }
    } catch {
      setReferralModal(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to create referral invite'
      }));
    }
  };

  const copyInviteLink = async () => {
    if (referralModal.inviteUrl) {
      await navigator.clipboard.writeText(referralModal.inviteUrl);
      setReferralModal(prev => ({ ...prev, copied: true }));
      setTimeout(() => {
        setReferralModal(prev => ({ ...prev, copied: false }));
      }, 2000);
    }
  };

  const sendShareEmail = () => {
    if (!referralModal.inviteUrl || !referralModal.shareEmail) return;
    const subject = encodeURIComponent('Lead Referral from OwnerFi');
    const body = encodeURIComponent(
      `I'm referring a buyer lead to you through OwnerFi.\n\nClick this link to view the lead details and accept the referral:\n${referralModal.inviteUrl}\n\nYou'll earn commission when you close this deal!`
    );
    window.location.href = `mailto:${referralModal.shareEmail}?subject=${subject}&body=${body}`;
  };

  const sendShareText = () => {
    if (!referralModal.inviteUrl || !referralModal.sharePhone) return;
    const body = encodeURIComponent(
      `I'm referring a buyer lead to you through OwnerFi. Accept it here: ${referralModal.inviteUrl}`
    );
    window.location.href = `sms:${referralModal.sharePhone}?body=${body}`;
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
          <div className="text-red-400 text-xl mb-4">!</div>
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

  const signedAgreements = agreements.filter(a => a.status === 'signed');
  const pendingAgreements = agreements.filter(a => a.status === 'pending');

  return (
    <div className="min-h-screen bg-slate-900 overflow-y-auto pb-20">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/realtor-dashboard" className="text-slate-400 hover:text-white transition-colors">
              Back to Hub
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
              href="/dashboard/settings"
              className="text-slate-400 hover:text-white transition-colors p-1.5"
              title="Settings"
            >
              Settings
            </Link>
            <button
              onClick={() => {
                trackEvent('auth_logout', { method: 'realtor_buyers' });
                signOut({ callbackUrl: '/auth/signout' });
              }}
              className="text-slate-400 hover:text-red-400 transition-colors p-1.5"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="text-slate-300 text-sm">Welcome back, <span className="text-white font-medium">{dashboardData.realtorData.firstName}</span></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">

        {/* Navigation Tabs */}
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
              onClick={() => setActiveTab('agreements')}
              className={`flex-1 text-center py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'agreements'
                  ? 'bg-emerald-500 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Agreements ({signedAgreements.length})
              {pendingAgreements.length > 0 && (
                <span className="ml-1 bg-yellow-500 text-black px-1.5 py-0.5 rounded text-[10px]">
                  {pendingAgreements.length} pending
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('owned')}
              className={`flex-1 text-center py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'owned'
                  ? 'bg-emerald-500 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              My Leads ({dashboardData.ownedBuyers.length})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex-1 text-center py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'transactions'
                  ? 'bg-emerald-500 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              History
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-slate-800/30 rounded-xl p-6">

          {/* Available Leads Tab */}
          {activeTab === 'available' && (
            <div>
              {/* Search and Filter Bar */}
              <div className="mb-6 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                </div>
                <div className="sm:w-48 relative">
                  <input
                    type="text"
                    placeholder="Filter by city..."
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📍</span>
                </div>
                {(searchQuery || cityFilter) && (
                  <button
                    onClick={() => { setSearchQuery(''); setCityFilter(''); }}
                    className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Pending Limit Status Banner */}
              {(() => {
                const FREE_LIMIT = 3;
                const pendingCount = pendingAgreements.length;
                const hasCredits = (dashboardData.realtorData.credits || 0) > 0;
                const atLimit = pendingCount >= FREE_LIMIT && !hasCredits;

                return (
                  <div className={`mb-6 p-4 rounded-lg border ${
                    atLimit
                      ? 'bg-yellow-500/10 border-yellow-500/30'
                      : 'bg-slate-700/30 border-slate-600/30'
                  }`}>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">Free Leads:</span>
                          <span className={`font-bold ${atLimit ? 'text-yellow-400' : 'text-emerald-400'}`}>
                            {pendingCount}/{FREE_LIMIT} pending
                          </span>
                          {hasCredits && (
                            <span className="text-blue-400 text-sm">
                              + {dashboardData.realtorData.credits} credits
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-sm">
                          {atLimit
                            ? 'Sign your pending agreements or buy credits to accept more leads'
                            : `You can have up to ${FREE_LIMIT} pending leads at a time`
                          }
                        </p>
                      </div>
                      <Link
                        href="/buy-credits"
                        className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                          atLimit
                            ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                            : 'bg-slate-600 hover:bg-slate-500 text-white'
                        }`}
                      >
                        {atLimit ? 'Buy More Leads' : 'Get More Leads'}
                      </Link>
                    </div>
                  </div>
                );
              })()}

              {dashboardData.availableLeads.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">📭</div>
                  <h3 className="text-xl font-bold text-white mb-2">No leads available</h3>
                  <p className="text-slate-400">New buyer leads will appear here when they register in your area.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {dashboardData.availableLeads.map((lead) => {
                    const FREE_LIMIT = 3;
                    const pendingCount = pendingAgreements.length;
                    const hasCredits = (dashboardData.realtorData.credits || 0) > 0;
                    const atLimit = pendingCount >= FREE_LIMIT && !hasCredits;

                    // Check if this lead has a pending agreement
                    const hasPendingAgreement = pendingAgreements.some(
                      a => a.buyerFirstName === lead.firstName && a.buyerLastName === lead.lastName
                    );

                    // Check if this lead has a signed agreement
                    const hasSignedAgreement = signedAgreements.some(
                      a => a.buyerFirstName === lead.firstName && a.buyerLastName === lead.lastName
                    );

                    // Determine status
                    let statusLabel = 'Available';
                    let statusColor = 'bg-emerald-500/20 text-emerald-400';
                    if (hasSignedAgreement) {
                      statusLabel = 'Accepted';
                      statusColor = 'bg-blue-500/20 text-blue-400';
                    } else if (hasPendingAgreement) {
                      statusLabel = 'Pending';
                      statusColor = 'bg-yellow-500/20 text-yellow-400';
                    }

                    return (
                      <div key={lead.id} className={`bg-slate-800/50 border rounded-lg p-4 ${
                        hasSignedAgreement ? 'border-blue-500/30' :
                        hasPendingAgreement ? 'border-yellow-500/30' :
                        'border-slate-700/50'
                      }`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="text-white font-bold text-lg">
                              {lead.firstName} {lead.lastName}
                            </h4>
                            <p className="text-slate-400 text-sm">{lead.city}, {lead.state}</p>
                            {lead.matchScore && (
                              <p className="text-emerald-400 text-xs mt-1">
                                {lead.matchScore}% match
                                {lead.likedPropertiesCount ? ` • ${lead.likedPropertiesCount} liked` : ''}
                              </p>
                            )}
                          </div>
                          <span className={`${statusColor} px-2 py-1 rounded text-xs font-medium`}>
                            {statusLabel}
                          </span>
                        </div>

                        {hasSignedAgreement ? (
                          <button
                            onClick={() => setActiveTab('agreements')}
                            className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 px-4 rounded-lg font-medium transition-colors"
                          >
                            View Agreement
                          </button>
                        ) : hasPendingAgreement ? (
                          <button
                            onClick={() => setActiveTab('agreements')}
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-4 rounded-lg font-medium transition-colors"
                          >
                            Complete Signature
                          </button>
                        ) : atLimit ? (
                          <Link
                            href="/buy-credits"
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-4 rounded-lg font-medium transition-colors block text-center"
                          >
                            Buy Credits to Accept
                          </Link>
                        ) : (
                          <button
                            onClick={() => acceptLead(lead.id, `${lead.firstName} ${lead.lastName}`)}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                          >
                            Accept Lead
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Agreements Tab */}
          {activeTab === 'agreements' && (
            <div>
              {agreements.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">📄</div>
                  <h3 className="text-xl font-bold text-white mb-2">No agreements yet</h3>
                  <p className="text-slate-400">When you accept a lead, your referral agreement will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pending Agreements */}
                  {pendingAgreements.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-yellow-400 font-semibold mb-3">Pending Signature</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {pendingAgreements.map((agreement) => (
                          <div key={agreement.id} className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="text-white font-bold">
                                  {agreement.buyerFirstName} {agreement.buyerLastName}
                                </h4>
                                <p className="text-slate-400 text-sm">{agreement.buyerCity}, {agreement.buyerState}</p>
                              </div>
                              <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-medium">
                                Pending
                              </span>
                            </div>
                            <p className="text-slate-500 text-xs mb-3">#{agreement.agreementNumber}</p>
                            <button
                              onClick={() => {
                                // Re-open the signing flow
                                setAgreementModal({
                                  isOpen: true,
                                  step: 'loading',
                                  leadId: null,
                                  agreementId: agreement.id,
                                  agreementNumber: agreement.agreementNumber,
                                  agreementHTML: null,
                                  terms: {
                                    referralFeePercent: agreement.referralFeePercent,
                                    agreementTermDays: 180,
                                    expirationDate: agreement.expirationDate
                                  },
                                  buyerName: `${agreement.buyerFirstName} ${agreement.buyerLastName}`,
                                  buyerDetails: null,
                                  typedName: '',
                                  agreeToTerms: false,
                                  agreeTCPA: false,
                                  agreeCreativeFinance: false,
                                  agreeDataAsIs: false,
                                  error: null
                                });
                                // Load the agreement details
                                fetch(`/api/realtor/agreements?id=${agreement.id}`)
                                  .then(r => r.json())
                                  .then(data => {
                                    if (data.success) {
                                      setAgreementModal(prev => ({
                                        ...prev,
                                        step: 'review',
                                        agreementHTML: data.agreementHTML
                                      }));
                                    }
                                  });
                              }}
                              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-4 rounded-lg font-medium transition-colors"
                            >
                              Complete Signature
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Signed Agreements */}
                  {signedAgreements.length > 0 && (
                    <div>
                      <h3 className="text-emerald-400 font-semibold mb-3">Active Agreements</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {signedAgreements.map((agreement) => (
                          <div key={agreement.id} className="bg-slate-800/50 border border-emerald-500/30 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="text-white font-bold">
                                  {agreement.buyerFirstName} {agreement.buyerLastName}
                                </h4>
                                <p className="text-slate-400 text-sm">{agreement.buyerCity}, {agreement.buyerState}</p>
                                {agreement.buyerPhone && (
                                  <p className="text-emerald-400 text-sm font-medium">{agreement.buyerPhone}</p>
                                )}
                                {agreement.buyerEmail && (
                                  <p className="text-emerald-400 text-sm">{agreement.buyerEmail}</p>
                                )}
                              </div>
                              <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs font-medium">
                                Active
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700">
                              <span>#{agreement.agreementNumber}</span>
                              <span>{agreement.referralFeePercent}% referral fee</span>
                            </div>
                            {agreement.buyerPhone && (
                              <div className="flex gap-2 mt-3">
                                <a
                                  href={`sms:${agreement.buyerPhone}&body=${encodeURIComponent("Hi, I see you're interested in owner finance properties through OwnerFi, how is everything going so far?")}`}
                                  className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 px-3 rounded-lg text-sm font-medium transition-colors text-center"
                                >
                                  Text
                                </a>
                                <a
                                  href={`mailto:${agreement.buyerEmail}`}
                                  className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 px-3 rounded-lg text-sm font-medium transition-colors text-center"
                                >
                                  Email
                                </a>
                              </div>
                            )}
                            {/* Refer button - only show if not already a re-referral */}
                            {!agreement.isReReferral && agreement.canBeReReferred !== false && (
                              <button
                                onClick={() => openReferralModal(agreement)}
                                className={`w-full mt-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                                  agreement.hasActiveInvite
                                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                                    : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400'
                                }`}
                              >
                                {agreement.hasActiveInvite
                                  ? `View Invite Link (${agreement.referralInviteFeePercent}% fee)`
                                  : 'Refer to Another Agent'}
                              </button>
                            )}
                            {agreement.isReReferral && (
                              <div className="mt-2 text-xs text-slate-500 text-center">
                                This is a referred lead (cannot be re-referred)
                              </div>
                            )}
                            {!agreement.isReReferral && agreement.canBeReReferred === false && (
                              <div className="mt-2 text-xs text-emerald-500 text-center">
                                Already referred to another agent
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Owned Buyers (Legacy) */}
          {activeTab === 'owned' && (
            <div>
              {dashboardData.ownedBuyers.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">👥</div>
                  <h3 className="text-xl font-bold text-white mb-2">No leads yet</h3>
                  <p className="text-slate-400">Leads you accept will appear here for ongoing communication.</p>
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
                            href={`sms:${buyer.phone}&body=${encodeURIComponent("Hi, I see you're interested in owner finance properties through OwnerFi, how is everything going so far?")}`}
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
                  <p className="text-slate-400">Transaction history will appear as you accept leads.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboardData.transactions.map((transaction) => (
                    <div key={transaction.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            transaction.type === 'agreement_signed' ? 'bg-emerald-500/20 text-emerald-400' :
                            transaction.type === 'lead_purchase' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {transaction.type === 'agreement_signed' ? '✓' :
                             transaction.type === 'lead_purchase' ? '📞' : '•'}
                          </div>
                          <div>
                            <div className="text-white font-medium">{transaction.description}</div>
                            <div className="text-slate-400 text-sm">
                              {new Date(transaction.createdAt).toLocaleDateString()}
                            </div>
                          </div>
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

      {/* Agreement Modal */}
      {agreementModal.isOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">

            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h3 className="text-xl font-bold text-white">Referral Agreement</h3>
                {agreementModal.agreementNumber && (
                  <p className="text-slate-400 text-sm">#{agreementModal.agreementNumber}</p>
                )}
              </div>
              <button
                onClick={closeAgreementModal}
                className="text-slate-400 hover:text-white text-2xl leading-none"
              >
                x
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* Loading State */}
              {agreementModal.step === 'loading' && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-400">Generating agreement...</p>
                </div>
              )}

              {/* Error State */}
              {agreementModal.error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
                  <p className="text-red-400">{agreementModal.error}</p>
                </div>
              )}

              {/* Review State */}
              {agreementModal.step === 'review' && !agreementModal.error && (
                <div>
                  {/* Agreement Preview */}
                  {agreementModal.agreementHTML && (
                    <div className="bg-white rounded-lg p-4 mb-6 max-h-96 overflow-y-auto">
                      <div
                        dangerouslySetInnerHTML={{ __html: agreementModal.agreementHTML }}
                        className="text-sm"
                      />
                    </div>
                  )}

                  {/* Terms Summary */}
                  {agreementModal.terms && (
                    <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
                      <h4 className="text-white font-semibold mb-2">Key Terms</h4>
                      <ul className="text-slate-300 text-sm space-y-1">
                        <li>Referral Fee: <span className="text-emerald-400 font-medium">{agreementModal.terms.referralFeePercent}%</span> of your commission</li>
                        <li>Agreement Valid For: <span className="text-white font-medium">{agreementModal.terms.agreementTermDays} days</span></li>
                        <li>Expires: <span className="text-white font-medium">{new Date(agreementModal.terms.expirationDate).toLocaleDateString()}</span></li>
                      </ul>
                    </div>
                  )}

                  {/* Signature Section */}
                  <div className="border-t border-slate-700 pt-6">
                    <h4 className="text-white font-semibold mb-4">Sign Agreement</h4>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">
                          Type your full legal name to sign
                        </label>
                        <input
                          type="text"
                          value={agreementModal.typedName}
                          onChange={(e) => setAgreementModal(prev => ({ ...prev, typedName: e.target.value }))}
                          placeholder="Your Full Legal Name"
                          className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agreementModal.agreeToTerms}
                          onChange={(e) => setAgreementModal(prev => ({ ...prev, agreeToTerms: e.target.checked }))}
                          className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-slate-300 text-sm">
                          I have read and agree to the terms of this Referral Agreement. I understand that by typing my name above and checking this box, I am electronically signing this agreement.
                        </span>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agreementModal.agreeTCPA}
                          onChange={(e) => setAgreementModal(prev => ({ ...prev, agreeTCPA: e.target.checked }))}
                          className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-slate-300 text-sm">
                          I acknowledge and agree to OwnerFi&apos;s <a href="/tcpa-compliance" target="_blank" className="text-emerald-400 hover:underline">TCPA Compliance Agreement</a>. I will comply with all telemarketing laws and honor opt-out requests within 24 hours.
                        </span>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agreementModal.agreeCreativeFinance}
                          onChange={(e) => setAgreementModal(prev => ({ ...prev, agreeCreativeFinance: e.target.checked }))}
                          className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-slate-300 text-sm">
                          I acknowledge OwnerFi&apos;s <a href="/creative-finance-disclaimer" target="_blank" className="text-emerald-400 hover:underline">Creative Finance Disclaimer</a>. I understand referred buyers may seek owner-financed properties and will direct them to verify all data with licensed professionals.
                        </span>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agreementModal.agreeDataAsIs}
                          onChange={(e) => setAgreementModal(prev => ({ ...prev, agreeDataAsIs: e.target.checked }))}
                          className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-slate-300 text-sm">
                          I accept that lead contact information is provided &quot;as-is&quot; without verification by OwnerFi. I will independently confirm all lead details before proceeding.
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Signing State */}
              {agreementModal.step === 'signing' && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-400">Processing signature...</p>
                </div>
              )}

              {/* Success State */}
              {agreementModal.step === 'success' && agreementModal.buyerDetails && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl text-emerald-400">✓</span>
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">Agreement Signed!</h4>
                  <p className="text-slate-400 mb-6">Here is your lead&apos;s contact information:</p>

                  <div className="bg-slate-700/50 rounded-lg p-6 text-left max-w-md mx-auto">
                    <div className="space-y-3">
                      <div>
                        <span className="text-slate-400 text-sm">Name</span>
                        <p className="text-white font-medium">
                          {agreementModal.buyerDetails.firstName} {agreementModal.buyerDetails.lastName}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-sm">Phone</span>
                        <p className="text-emerald-400 font-medium">{agreementModal.buyerDetails.phone}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-sm">Email</span>
                        <p className="text-emerald-400 font-medium">{agreementModal.buyerDetails.email}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-sm">Location</span>
                        <p className="text-white">
                          {agreementModal.buyerDetails.city}, {agreementModal.buyerDetails.state}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                      <a
                        href={`sms:${agreementModal.buyerDetails.phone}&body=${encodeURIComponent("Hi, I see you're interested in owner finance properties through OwnerFi. I'd love to help you find your perfect home!")}`}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors text-center"
                      >
                        Text Now
                      </a>
                      <a
                        href={`tel:${agreementModal.buyerDetails.phone}`}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors text-center"
                      >
                        Call Now
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {agreementModal.step === 'review' && !agreementModal.error && (
              <div className="p-4 border-t border-slate-700 flex gap-3">
                <button
                  onClick={closeAgreementModal}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={signAgreement}
                  disabled={!agreementModal.typedName || !agreementModal.agreeToTerms || !agreementModal.agreeTCPA || !agreementModal.agreeCreativeFinance || !agreementModal.agreeDataAsIs}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sign & Accept Lead
                </button>
              </div>
            )}

            {agreementModal.step === 'success' && (
              <div className="p-4 border-t border-slate-700">
                <button
                  onClick={closeAgreementModal}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            )}

            {agreementModal.error && (
              <div className="p-4 border-t border-slate-700">
                <button
                  onClick={closeAgreementModal}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
                x
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

      {/* Referral Modal - for re-referring leads to other agents */}
      {referralModal.isOpen && referralModal.agreement && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Refer Lead to Another Agent</h3>
              <button
                onClick={closeReferralModal}
                className="text-slate-400 hover:text-white text-xl"
              >
                x
              </button>
            </div>

            {referralModal.loading ? (
              /* Loading State */
              <div className="text-center py-8">
                <div className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400">Loading invite...</p>
              </div>
            ) : !referralModal.success ? (
              <>
                {/* Lead Info */}
                <div className="mb-6 p-4 bg-slate-700/50 rounded-lg">
                  <div className="text-white font-medium mb-1">
                    {referralModal.agreement.buyerFirstName} {referralModal.agreement.buyerLastName}
                  </div>
                  <div className="text-slate-400 text-sm">
                    {referralModal.agreement.buyerCity}, {referralModal.agreement.buyerState}
                  </div>
                </div>

                {/* Error */}
                {referralModal.error && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {referralModal.error}
                  </div>
                )}

                {/* Fee Input */}
                <div className="mb-6">
                  <label className="block text-white text-sm font-medium mb-2">
                    Referral Fee Percentage
                  </label>
                  <p className="text-slate-400 text-xs mb-3">
                    This is the percentage of the receiving agent&apos;s commission you&apos;ll receive at closing.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={referralModal.feePercent}
                      onChange={(e) => setReferralModal(prev => ({
                        ...prev,
                        feePercent: Math.max(1, Math.min(50, parseInt(e.target.value) || 25))
                      }))}
                      className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white text-center text-xl font-bold"
                    />
                    <span className="text-white text-xl font-bold">%</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Common rates: 25% (standard), 30% (premium), 35% (high-value)
                  </div>
                </div>

                {/* Fee Breakdown */}
                <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <h4 className="text-purple-400 font-medium mb-2">Fee Breakdown</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">You receive:</span>
                      <span className="text-white font-medium">{(referralModal.feePercent * 0.7).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">OwnerFi fee (30%):</span>
                      <span className="text-white font-medium">{(referralModal.feePercent * 0.3).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-600 pt-1 mt-1">
                      <span className="text-slate-400">Agent B pays:</span>
                      <span className="text-purple-400 font-medium">{referralModal.feePercent}%</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={closeReferralModal}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createReferralInvite}
                    disabled={referralModal.loading}
                    className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {referralModal.loading ? 'Creating...' : 'Create Invite Link'}
                  </button>
                </div>
              </>
            ) : (
              /* Success State - Share Drawer */
              <div>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl text-purple-400">&#10003;</span>
                  </div>
                  <h4 className="text-lg font-bold text-white">Share Referral Link</h4>
                  <p className="text-slate-400 text-sm">
                    How would you like to share this with the other agent?
                  </p>
                </div>

                {/* Share Method Selection */}
                {referralModal.shareMethod === 'select' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setReferralModal(prev => ({ ...prev, shareMethod: 'email' }))}
                      className="w-full flex items-center gap-4 p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl transition-colors"
                    >
                      <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <span className="text-xl">&#9993;</span>
                      </div>
                      <div className="text-left">
                        <div className="text-white font-medium">Send via Email</div>
                        <div className="text-slate-400 text-sm">Enter their email address</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setReferralModal(prev => ({ ...prev, shareMethod: 'text' }))}
                      className="w-full flex items-center gap-4 p-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl transition-colors"
                    >
                      <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                        <span className="text-xl">&#128172;</span>
                      </div>
                      <div className="text-left">
                        <div className="text-white font-medium">Send via Text</div>
                        <div className="text-slate-400 text-sm">Enter their phone number</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setReferralModal(prev => ({ ...prev, shareMethod: 'copy' }))}
                      className="w-full flex items-center gap-4 p-4 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-xl transition-colors"
                    >
                      <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center">
                        <span className="text-xl">&#128279;</span>
                      </div>
                      <div className="text-left">
                        <div className="text-white font-medium">Copy Link</div>
                        <div className="text-slate-400 text-sm">Share it yourself</div>
                      </div>
                    </button>
                  </div>
                )}

                {/* Email Input */}
                {referralModal.shareMethod === 'email' && (
                  <div className="space-y-4">
                    <button
                      onClick={() => setReferralModal(prev => ({ ...prev, shareMethod: 'select' }))}
                      className="text-slate-400 hover:text-white text-sm flex items-center gap-1"
                    >
                      &#8592; Back
                    </button>
                    <div>
                      <label className="block text-white text-sm font-medium mb-2">
                        Agent&apos;s Email Address
                      </label>
                      <input
                        type="email"
                        value={referralModal.shareEmail}
                        onChange={(e) => setReferralModal(prev => ({ ...prev, shareEmail: e.target.value }))}
                        placeholder="agent@example.com"
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={sendShareEmail}
                      disabled={!referralModal.shareEmail || !referralModal.shareEmail.includes('@')}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Open Email App
                    </button>
                  </div>
                )}

                {/* Phone Input */}
                {referralModal.shareMethod === 'text' && (
                  <div className="space-y-4">
                    <button
                      onClick={() => setReferralModal(prev => ({ ...prev, shareMethod: 'select' }))}
                      className="text-slate-400 hover:text-white text-sm flex items-center gap-1"
                    >
                      &#8592; Back
                    </button>
                    <div>
                      <label className="block text-white text-sm font-medium mb-2">
                        Agent&apos;s Phone Number
                      </label>
                      <input
                        type="tel"
                        value={referralModal.sharePhone}
                        onChange={(e) => setReferralModal(prev => ({ ...prev, sharePhone: e.target.value }))}
                        placeholder="(555) 123-4567"
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={sendShareText}
                      disabled={!referralModal.sharePhone || referralModal.sharePhone.length < 10}
                      className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Open Messages App
                    </button>
                  </div>
                )}

                {/* Copy Link */}
                {referralModal.shareMethod === 'copy' && (
                  <div className="space-y-4">
                    <button
                      onClick={() => setReferralModal(prev => ({ ...prev, shareMethod: 'select' }))}
                      className="text-slate-400 hover:text-white text-sm flex items-center gap-1"
                    >
                      &#8592; Back
                    </button>
                    <div>
                      <label className="block text-white text-sm font-medium mb-2">
                        Referral Link
                      </label>
                      <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 break-all text-sm text-emerald-400 font-mono">
                        {referralModal.inviteUrl}
                      </div>
                    </div>
                    <button
                      onClick={copyInviteLink}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                        referralModal.copied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      }`}
                    >
                      {referralModal.copied ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                  </div>
                )}

                {/* Done Button */}
                <button
                  onClick={closeReferralModal}
                  className="w-full mt-6 bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
