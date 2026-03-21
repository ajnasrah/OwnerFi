'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { ExtendedSession } from '@/types/session';
import Link from 'next/link';
import { trackEvent } from '@/components/analytics/AnalyticsProvider';

import { Agreement, OwnedBuyer, DisputeModalState, ReferralModalState } from './types';

import { useRealtorDashboard } from './hooks/useRealtorDashboard';
import { useRealtorAgreements } from './hooks/useRealtorAgreements';
import { useAgreementActions } from './hooks/useAgreementActions';

import { AvailableLeadsTab } from './components/AvailableLeadsTab';
import { AgreementsTab } from './components/AgreementsTab';
import { OwnedLeadsTab } from './components/OwnedLeadsTab';
import { TransactionsTab } from './components/TransactionsTab';
import { AgreementModal } from './components/AgreementModal';
import { DisputeModal } from './components/DisputeModal';
import { ReferralModal } from './components/ReferralModal';
import { LeadCardSkeletonGrid } from './components/LeadCardSkeleton';

type TabKey = 'available' | 'agreements' | 'owned' | 'transactions';

export default function RealtorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>('available');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [debouncedCity] = useDebounce(cityFilter, 300);

  const role = (session as unknown as ExtendedSession)?.user?.role;
  const isReady = status === 'authenticated' && (role === 'realtor' || role === 'admin');

  // Data hooks
  const dashboard = useRealtorDashboard(debouncedSearch, debouncedCity, isReady);
  const agreementsQuery = useRealtorAgreements(isReady);

  // Agreement modal hook
  const agreementActions = useAgreementActions();

  // Dispute modal state
  const [disputeModal, setDisputeModal] = useState<DisputeModalState>({
    buyer: null, reason: '', description: '', submitting: false, success: false,
  });

  // Referral modal state
  const [referralModal, setReferralModal] = useState<ReferralModalState>({
    isOpen: false, agreement: null, feePercent: 25, loading: false,
    success: false, inviteUrl: null, error: null, shareMethod: 'select',
    shareEmail: '', sharePhone: '', copied: false,
  });

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth');
    } else if (status === 'authenticated' && role !== 'realtor' && role !== 'admin') {
      router.replace('/');
    }
  }, [status, role, router]);

  // Derived data
  const agreements = agreementsQuery.data ?? [];
  const signedAgreements = useMemo(() => agreements.filter(a => a.status === 'signed'), [agreements]);
  const pendingAgreements = useMemo(() => agreements.filter(a => a.status === 'pending'), [agreements]);

  // Dispute handlers
  const openDisputeModal = useCallback((buyer: OwnedBuyer) => {
    setDisputeModal({ buyer, reason: '', description: '', submitting: false });
  }, []);

  const closeDisputeModal = useCallback(() => {
    setDisputeModal({ buyer: null, reason: '', description: '', submitting: false });
  }, []);

  const disputeRef = useRef(disputeModal);
  disputeRef.current = disputeModal;

  const submitDispute = useCallback(async () => {
    const current = disputeRef.current;
    if (!current.buyer || !current.reason || !current.description) return;

    setDisputeModal(prev => ({ ...prev, submitting: true }));

    try {
      const response = await fetch('/api/realtor/dispute-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: current.buyer.id,
          reason: current.reason,
          description: current.description,
        }),
      });
      const result = await response.json();

      if (result.success) {
        trackEvent('lead_dispute_submitted', { reason: current.reason });
        setDisputeModal(prev => ({ ...prev, submitting: false, success: true }));
        queryClient.invalidateQueries({ queryKey: ['realtor-dashboard'] });
      } else {
        alert(result.error || 'Failed to submit dispute');
        setDisputeModal(prev => ({ ...prev, submitting: false }));
      }
    } catch {
      alert('Failed to submit dispute');
      setDisputeModal(prev => ({ ...prev, submitting: false }));
    }
  }, [closeDisputeModal, queryClient]);

  // Referral handlers
  const openReferralModal = useCallback((agreement: Agreement) => {
    if (agreement.hasActiveInvite) {
      setReferralModal({
        isOpen: true, agreement, feePercent: agreement.referralInviteFeePercent || 25,
        loading: true, success: false, inviteUrl: null, error: null,
        shareMethod: 'select', shareEmail: '', sharePhone: '', copied: false,
      });
      fetch('/api/realtor/referral/create-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreementId: agreement.id,
          referralFeePercent: agreement.referralInviteFeePercent || 25,
        }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setReferralModal(prev => ({ ...prev, loading: false, success: true, inviteUrl: data.inviteUrl }));
          } else {
            setReferralModal(prev => ({ ...prev, loading: false, error: data.error }));
          }
        })
        .catch(() => {
          setReferralModal(prev => ({ ...prev, loading: false, error: 'Failed to load invite link' }));
        });
    } else {
      setReferralModal({
        isOpen: true, agreement, feePercent: 25, loading: false,
        success: false, inviteUrl: null, error: null, shareMethod: 'select',
        shareEmail: '', sharePhone: '', copied: false,
      });
    }
  }, []);

  const closeReferralModal = useCallback(() => {
    setReferralModal({
      isOpen: false, agreement: null, feePercent: 25, loading: false,
      success: false, inviteUrl: null, error: null, shareMethod: 'select',
      shareEmail: '', sharePhone: '', copied: false,
    });
  }, []);

  const createReferralInvite = useCallback(async () => {
    if (!referralModal.agreement) return;

    setReferralModal(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/realtor/referral/create-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreementId: referralModal.agreement.id,
          referralFeePercent: referralModal.feePercent,
        }),
      });
      const result = await response.json();

      if (result.success) {
        setReferralModal(prev => ({ ...prev, loading: false, success: true, inviteUrl: result.inviteUrl }));
        queryClient.invalidateQueries({ queryKey: ['realtor-agreements'] });
      } else {
        setReferralModal(prev => ({ ...prev, loading: false, error: result.error || 'Failed to create referral invite' }));
      }
    } catch {
      setReferralModal(prev => ({ ...prev, loading: false, error: 'Failed to create referral invite' }));
    }
  }, [referralModal.agreement, referralModal.feePercent, queryClient]);

  const copyInviteLink = useCallback(async () => {
    if (referralModal.inviteUrl) {
      try {
        await navigator.clipboard.writeText(referralModal.inviteUrl);
        setReferralModal(prev => ({ ...prev, copied: true }));
        setTimeout(() => {
          setReferralModal(prev => ({ ...prev, copied: false }));
        }, 2000);
      } catch {
        // Fallback: select text for manual copy
        alert('Could not copy automatically. Please copy the link manually.');
      }
    }
  }, [referralModal.inviteUrl]);

  const sendShareEmail = useCallback(() => {
    if (!referralModal.inviteUrl || !referralModal.shareEmail) return;
    const subject = encodeURIComponent('Lead Referral from Ownerfi');
    const body = encodeURIComponent(
      `I'm referring a buyer lead to you through Ownerfi.\n\nClick this link to view the lead details and accept the referral:\n${referralModal.inviteUrl}\n\nYou'll earn commission when you close this deal!`
    );
    window.location.href = `mailto:${referralModal.shareEmail}?subject=${subject}&body=${body}`;
  }, [referralModal.inviteUrl, referralModal.shareEmail]);

  const sendShareText = useCallback(() => {
    if (!referralModal.inviteUrl || !referralModal.sharePhone) return;
    const body = encodeURIComponent(
      `I'm referring a buyer lead to you through Ownerfi. Accept it here: ${referralModal.inviteUrl}`
    );
    window.location.href = `sms:${referralModal.sharePhone}?body=${body}`;
  }, [referralModal.inviteUrl, referralModal.sharePhone]);

  // Initial loading state
  if ((status === 'loading') || (isReady && dashboard.isLoading && !dashboard.data)) {
    return (
      <div className="min-h-screen bg-[#111625] overflow-y-auto pb-20">
        <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50">
          <div className="px-4 py-3">
            <div className="h-5 w-40 bg-slate-700 rounded animate-pulse" />
          </div>
          <div className="px-4 pb-3">
            <div className="h-4 w-56 bg-slate-700/60 rounded animate-pulse" />
          </div>
        </header>
        <main className="max-w-6xl mx-auto p-4">
          <div className="bg-slate-800/30 rounded-xl p-1 mb-6">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex-1 h-8 bg-slate-700/50 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
          <div className="bg-slate-800/30 rounded-xl p-6">
            <LeadCardSkeletonGrid count={6} />
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (dashboard.error && !dashboard.data) {
    return (
      <div className="min-h-screen bg-[#111625] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">!</div>
          <div className="text-white font-medium">
            {dashboard.error instanceof Error ? dashboard.error.message : 'Failed to load dashboard'}
          </div>
          <button
            onClick={() => dashboard.refetch()}
            className="mt-4 bg-[#00BC7D]/50 text-white px-4 py-2 rounded-lg hover:bg-[#00BC7D]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const dashboardData = dashboard.data;
  if (!dashboardData) return null;

  return (
    <div className="min-h-screen bg-[#111625] overflow-y-auto pb-20">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/realtor-dashboard" className="text-slate-400 hover:text-white transition-colors">
              Back to Hub
            </Link>
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/logo.jpg" alt="Ownerfi" width={32} height={32} className="rounded-lg" />
              <span className="text-lg font-bold text-white">Ownerfi</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {role === 'admin' && (
              <Link href="/admin" className="text-sm text-[#00BC7D] hover:text-[#00d68f] transition-colors">
                &larr; Admin
              </Link>
            )}
            <Link
              href="/realtor-dashboard/settings"
              className="text-slate-400 hover:text-white transition-colors p-1.5"
              title="Profile"
            >
              Profile
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
                  ? 'bg-[#00BC7D]/50 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Available ({dashboardData.availableLeads.length})
            </button>
            <button
              onClick={() => setActiveTab('agreements')}
              className={`flex-1 text-center py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'agreements'
                  ? 'bg-[#00BC7D]/50 text-white shadow-lg'
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
                  ? 'bg-[#00BC7D]/50 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              My Leads ({dashboardData.ownedBuyers.length})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex-1 text-center py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'transactions'
                  ? 'bg-[#00BC7D]/50 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              History
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-slate-800/30 rounded-xl p-6">
          {activeTab === 'available' && (
            <AvailableLeadsTab
              dashboardData={dashboardData}
              pendingAgreements={pendingAgreements}
              signedAgreements={signedAgreements}
              isFetching={dashboard.isFetching}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              cityFilter={cityFilter}
              setCityFilter={setCityFilter}
              onAcceptLead={agreementActions.acceptLead}
              onViewAgreements={() => setActiveTab('agreements')}
            />
          )}

          {activeTab === 'agreements' && (
            <AgreementsTab
              agreements={agreements}
              pendingAgreements={pendingAgreements}
              signedAgreements={signedAgreements}
              onCompletePendingSignature={agreementActions.openPendingAgreement}
              onOpenReferralModal={openReferralModal}
            />
          )}

          {activeTab === 'owned' && (
            <OwnedLeadsTab
              ownedBuyers={dashboardData.ownedBuyers}
              agreements={signedAgreements}
              onOpenDispute={openDisputeModal}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsTab transactions={dashboardData.transactions} />
          )}
        </div>
      </main>

      {/* Modals */}
      <AgreementModal
        modal={agreementActions.modal}
        onUpdateField={agreementActions.updateField}
        onSign={agreementActions.signAgreement}
        onRetry={agreementActions.retry}
        onClose={agreementActions.close}
      />

      <DisputeModal
        modal={disputeModal}
        onUpdateField={(updates) => setDisputeModal(prev => ({ ...prev, ...updates }))}
        onSubmit={submitDispute}
        onClose={closeDisputeModal}
      />

      <ReferralModal
        modal={referralModal}
        onUpdateField={(updates) => setReferralModal(prev => ({ ...prev, ...updates }))}
        onCreateInvite={createReferralInvite}
        onCopyLink={copyInviteLink}
        onSendEmail={sendShareEmail}
        onSendText={sendShareText}
        onClose={closeReferralModal}
      />
    </div>
  );
}
