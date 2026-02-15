'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { InvestorPropertyCard } from '@/components/dashboard/InvestorPropertyCard';
import { InvestorFilterBar, getFilterParams } from '@/components/dashboard/InvestorFilterBar';
import { trackEvent } from '@/components/analytics/AnalyticsProvider';
import type { InvestorDeal } from '@/app/api/buyer/investor-deals/route';
import { ExtendedSession } from '@/types/session';

type QuickFilter = 'all' | 'owner_finance' | 'cash_deal' | 'under80' | 'under100k' | '100k-200k' | '200k-300k';
type SortField = 'price' | 'percentOfArv' | 'discount' | 'monthlyPayment';

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  isInvestor: boolean;
  dealTypePreference?: 'all' | 'owner_finance' | 'cash_deal';
  likedPropertyIds?: string[];
  dealAlertStatus?: 'active' | 'canceled' | 'payment_failed';
  arvThreshold?: number;
  dealAlertSubscribedAt?: string;
  dealAlertCurrentPeriodEnd?: string;
}

export default function InvestorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Profile
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // Deals
  const [deals, setDeals] = useState<InvestorDeal[]>([]);
  const dealsRef = useRef<InvestorDeal[]>([]); // Ref to avoid stale closure in toggleLike
  dealsRef.current = deals;
  const [totalDeals, setTotalDeals] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [breakdown, setBreakdown] = useState<{ ownerFinance: number; cashDeal: number; total: number }>({ ownerFinance: 0, cashDeal: 0, total: 0 });
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealsError, setDealsError] = useState(false);
  const [fetchKey, setFetchKey] = useState(0); // Increment to force re-fetch
  const [likedProperties, setLikedProperties] = useState<string[]>([]);

  // Subscription
  const [subscribing, setSubscribing] = useState(false);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);
  const [canceling, setCanceling] = useState(false);

  // Filters
  const [activeFilter, setActiveFilter] = useState<QuickFilter>('all');
  const [sortBy, setSortBy] = useState<SortField>('price');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [excludeLand, setExcludeLand] = useState(true); // Default: hide land properties
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth');
    }
  }, [status, router]);

  // Handle subscription success from Stripe redirect
  useEffect(() => {
    const subParam = searchParams.get('subscription');
    if (subParam === 'success') {
      setSubscriptionSuccess(true);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('subscription');
      window.history.replaceState({}, '', url.toString());
      // Poll profile until webhook processes (up to 10 seconds)
      let attempts = 0;
      const maxAttempts = 5;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch('/api/buyer/profile');
          const data = await res.json();
          if (data.profile?.dealAlertSubscription?.status === 'active' || attempts >= maxAttempts) {
            clearInterval(pollInterval);
            loadProfile();
          }
        } catch {
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            loadProfile();
          }
        }
      }, 2000);
    }
    if (subParam === 'cancelled') {
      const url = new URL(window.location.href);
      url.searchParams.delete('subscription');
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Subscription handlers
  const handleSubscribe = async () => {
    setSubscribing(true);
    setError(null);
    try {
      const res = await fetch('/api/buyer/deal-alert-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (res.status === 409) {
        // Already subscribed — reload to show current state
        loadProfile();
      } else {
        setError(data.error || 'Failed to start checkout');
      }
    } catch {
      setError('Failed to start checkout. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const res = await fetch('/api/buyer/deal-alert-portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Failed to open billing portal. Please try again.');
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Cancel your Deal Alert SMS subscription? You\'ll stop receiving alerts immediately.')) return;
    setCanceling(true);
    setError(null);
    try {
      const res = await fetch('/api/buyer/deal-alert-cancel', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        loadProfile();
      } else {
        setError(data.error || 'Failed to cancel subscription');
      }
    } catch {
      setError('Failed to cancel subscription');
    } finally {
      setCanceling(false);
    }
  };

  // Load profile
  useEffect(() => {
    if (status === 'authenticated') {
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/buyer/profile');
      if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
      const data = await res.json();

      const isAdmin = (session as unknown as ExtendedSession)?.user?.role === 'admin';

      if (!data.profile) {
        if (isAdmin) {
          // Admin has no buyer profile - show empty state with defaults
          setProfile({
            id: '',
            firstName: 'Admin',
            lastName: '',
            city: 'Memphis',
            state: 'TN',
            isInvestor: true,
            dealTypePreference: 'all',
            likedPropertyIds: [],
          });
          setLikedProperties([]);
          setLoading(false);
          setFetchKey(prev => prev + 1);
          return;
        }
        router.replace('/auth/setup');
        return;
      }

      // If not an investor, redirect to regular dashboard (skip for admins)
      if (!data.profile.isInvestor && !isAdmin) {
        router.replace('/dashboard');
        return;
      }

      const profileData: ProfileData = {
        id: data.profile.id,
        firstName: data.profile.firstName,
        lastName: data.profile.lastName,
        city: data.profile.preferredCity || data.profile.city || '',
        state: data.profile.preferredState || data.profile.state || '',
        isInvestor: data.profile.isInvestor,
        dealTypePreference: data.profile.dealTypePreference || 'all',
        likedPropertyIds: data.profile.likedPropertyIds || [],
        dealAlertStatus: data.profile.dealAlertSubscription?.status,
        dealAlertSubscribedAt: data.profile.dealAlertSubscription?.subscribedAt?._seconds
          ? new Date(data.profile.dealAlertSubscription.subscribedAt._seconds * 1000).toLocaleDateString()
          : data.profile.dealAlertSubscription?.subscribedAt
            ? new Date(data.profile.dealAlertSubscription.subscribedAt).toLocaleDateString()
            : undefined,
        dealAlertCurrentPeriodEnd: data.profile.dealAlertSubscription?.currentPeriodEnd?._seconds
          ? new Date(data.profile.dealAlertSubscription.currentPeriodEnd._seconds * 1000).toLocaleDateString()
          : data.profile.dealAlertSubscription?.currentPeriodEnd
            ? new Date(data.profile.dealAlertSubscription.currentPeriodEnd).toLocaleDateString()
            : undefined,
        arvThreshold: data.profile.arvThreshold,
      };

      setProfile(profileData);
      setLikedProperties(profileData.likedPropertyIds || []);

      // Set initial filter from preference
      if (profileData.dealTypePreference && profileData.dealTypePreference !== 'all') {
        setActiveFilter(profileData.dealTypePreference);
      }
    } catch {
      setError('Failed to load your profile. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch deals when filters change (with AbortController to prevent stale responses)
  useEffect(() => {
    if (!profile) return undefined;

    const abortController = new AbortController();
    const fetchDeals = async () => {
      setDealsLoading(true);
      setDealsError(false);
      try {
        const filterParams = getFilterParams(activeFilter, excludeLand);
        const params = new URLSearchParams({
          dealType: filterParams.dealType,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
        });
        if (filterParams.minPrice) params.set('minPrice', String(filterParams.minPrice));
        if (filterParams.maxPrice) params.set('maxPrice', String(filterParams.maxPrice));
        if (filterParams.maxArvPercent) params.set('maxArvPercent', String(filterParams.maxArvPercent));
        if (filterParams.excludeLand) params.set('excludeLand', 'true');

        const res = await fetch(`/api/buyer/investor-deals?${params}`, {
          signal: abortController.signal,
        });
        if (!res.ok) throw new Error(`Deals fetch failed: ${res.status}`);
        const data = await res.json();

        if (!abortController.signal.aborted) {
          setDeals(data.deals || []);
          setTotalDeals(data.total || 0);
          setTotalPages(data.totalPages || 0);
          if (data.breakdown) setBreakdown(data.breakdown);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!abortController.signal.aborted) {
          setDeals([]);
          setTotalDeals(0);
          setTotalPages(0);
          setBreakdown({ ownerFinance: 0, cashDeal: 0, total: 0 });
          setDealsError(true);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setDealsLoading(false);
        }
      }
    };

    fetchDeals();
    return () => abortController.abort();
  }, [profile, activeFilter, sortBy, sortOrder, excludeLand, currentPage, fetchKey]);

  // Reset page when filters change (handled via wrapper functions below)

  // Hide property (pass)
  const hideProperty = useCallback(async (dealId: string) => {
    // Snapshot current state for revert
    const snapshot = dealsRef.current;

    // Optimistic: remove from UI immediately
    setDeals(prev => prev.filter(d => d.id !== dealId));
    setTotalDeals(prev => prev - 1);

    try {
      const res = await fetch('/api/buyer/pass-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: dealId, action: 'pass' }),
      });
      if (!res.ok) {
        console.error('[hideProperty] API returned', res.status);
        // Revert — put the deals back as they were
        setDeals(snapshot);
        setTotalDeals(snapshot.length);
      }
    } catch (err) {
      console.error('[hideProperty] Network error:', err);
      // Revert — put the deals back as they were
      setDeals(snapshot);
      setTotalDeals(snapshot.length);
    }
  }, []);

  // Like toggle (with guard against rapid clicks)
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const toggleLike = useCallback(async (dealId: string) => {
    if (likingIds.has(dealId)) return; // Prevent rapid double-clicks
    setLikingIds(prev => new Set(prev).add(dealId));

    const isLiked = likedProperties.includes(dealId);
    const action = isLiked ? 'unlike' : 'like';
    const deal = dealsRef.current.find(d => d.id === dealId);

    // Optimistic update (only likedProperties — deals[].isLiked is not read by render)
    setLikedProperties(prev =>
      isLiked ? prev.filter(id => id !== dealId) : [...prev, dealId]
    );

    try {
      const propertyContext = deal ? {
        monthlyPayment: deal.monthlyPayment || 0,
        downPayment: deal.downPaymentAmount || 0,
        bedrooms: deal.beds,
        bathrooms: deal.baths,
        squareFeet: deal.sqft,
        city: deal.city,
      } : undefined;

      const response = await fetch('/api/buyer/like-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: dealId, action, propertyContext }),
      });

      if (response.ok) {
        trackEvent(isLiked ? 'property_unlike' : 'property_like', {
          property_id: dealId,
          city: deal?.city || '',
          price: deal?.price || 0,
          deal_type: deal?.dealType || '',
          source: 'investor_dashboard',
        });
      } else {
        // Revert on failure
        setLikedProperties(prev =>
          isLiked ? [...prev, dealId] : prev.filter(id => id !== dealId)
        );
      }
    } catch {
      // Revert on error
      setLikedProperties(prev =>
        isLiked ? [...prev, dealId] : prev.filter(id => id !== dealId)
      );
    } finally {
      setLikingIds(prev => { const next = new Set(prev); next.delete(dealId); return next; });
    }
  }, [likedProperties, likingIds]);

  // Stats for filter bar (use API breakdown for accurate total counts, page avg for display)
  const stats = useMemo(() => {
    return {
      total: breakdown.total,
      avgPrice: deals.length > 0 ? deals.reduce((sum, d) => sum + d.price, 0) / deals.length : 0,
      ownerFinance: breakdown.ownerFinance,
      cashDeal: breakdown.cashDeal,
    };
  }, [deals, breakdown]);

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); loadProfile(); }}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-3xl animate-pulse" />
            <div className="absolute inset-2 bg-slate-900 rounded-2xl flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
          <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-1">Loading Investor Dashboard</h1>
          <p className="text-slate-400 text-sm">Finding deals in {profile?.city || 'your area'}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            {/* Left: Location */}
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2 bg-white/5 backdrop-blur-xl rounded-full px-3 py-1.5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <span className="text-sm">📍</span>
              <span className="text-white font-bold text-xs">{profile?.city}, {profile?.state}</span>
            </Link>

            {/* Center: Branding */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-emerald-400 font-black text-sm">INVESTOR</span>
              <span className="text-slate-500 text-xs">Dashboard</span>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5">
              {(session as unknown as ExtendedSession)?.user?.role === 'admin' && (
                <Link
                  href="/admin"
                  className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg flex items-center gap-1 transition-all"
                  title="Back to Admin"
                >
                  <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-purple-400 text-[10px] font-bold">ADMIN</span>
                </Link>
              )}
              <Link
                href="/dashboard/liked"
                className="hidden md:flex relative w-8 h-8 bg-white/5 hover:bg-white/10 rounded-full items-center justify-center transition-all border border-white/10"
              >
                <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                {likedProperties.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold border border-slate-900">
                    {likedProperties.length}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/settings"
                className="hidden md:flex w-8 h-8 bg-white/5 hover:bg-white/10 rounded-full items-center justify-center transition-all border border-white/10"
              >
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
              <button
                onClick={() => {
                  trackEvent('auth_logout', { method: 'investor_dashboard' });
                  signOut({ callbackUrl: '/auth/signout' });
                }}
                className="hidden md:flex w-8 h-8 bg-red-500/10 hover:bg-red-500/20 rounded-full items-center justify-center transition-all border border-red-500/30"
                title="Sign Out"
              >
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4 pb-20 md:pb-4">
        {/* Deal Alert Subscription Card */}
        {profile?.dealAlertStatus === 'active' ? (
          /* ── Active subscription ── */
          <div className="mb-4 bg-gradient-to-r from-emerald-900/30 to-slate-800/50 border border-emerald-500/30 rounded-xl p-4">
            {subscriptionSuccess && (
              <div className="mb-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5 flex items-center justify-between">
                <span className="text-emerald-400 text-xs font-semibold">Deal Alert SMS activated! You&apos;ll receive texts when new deals appear.</span>
                <button onClick={() => setSubscriptionSuccess(false)} className="text-emerald-400/60 hover:text-emerald-400 text-xs ml-2">✕</button>
              </div>
            )}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  Deal Alert SMS
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-semibold">ACTIVE</span>
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  You&apos;ll get an SMS when deals under <span className="text-white font-medium">{profile?.arvThreshold || 85}% of ARV</span> appear in <span className="text-white font-medium">{profile?.city}</span>.
                </p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
                  <span>$5/month</span>
                  {profile?.dealAlertSubscribedAt && (
                    <>
                      <span>·</span>
                      <span>Since {profile.dealAlertSubscribedAt}</span>
                    </>
                  )}
                  {profile?.dealAlertCurrentPeriodEnd && (
                    <>
                      <span>·</span>
                      <span>Next billing: {profile.dealAlertCurrentPeriodEnd}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 ml-3">
                <button
                  onClick={handleManageSubscription}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-all"
                >
                  Manage Billing
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                  className="text-red-400/70 hover:text-red-400 text-[11px] transition-colors disabled:opacity-50"
                >
                  {canceling ? 'Canceling...' : 'Cancel Subscription'}
                </button>
              </div>
            </div>
          </div>
        ) : profile?.dealAlertStatus === 'payment_failed' ? (
          /* ── Payment failed ── */
          <div className="mb-4 bg-gradient-to-r from-red-900/30 to-slate-800/50 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  Deal Alert SMS
                  <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-semibold">PAYMENT FAILED</span>
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">Your payment failed. Update your payment method to continue receiving alerts.</p>
              </div>
              <button
                onClick={handleManageSubscription}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-all"
              >
                Fix Payment
              </button>
            </div>
          </div>
        ) : profile?.dealAlertStatus === 'canceled' ? (
          /* ── Canceled subscription ── */
          <div className="mb-4 bg-gradient-to-r from-amber-900/20 to-slate-800/50 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  Deal Alert SMS
                  <span className="bg-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-semibold">CANCELED</span>
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Your subscription has been canceled. You won&apos;t be charged again.
                </p>
                {profile?.dealAlertCurrentPeriodEnd && (
                  <p className="text-slate-500 text-[11px] mt-1">
                    Alerts were active until {profile.dealAlertCurrentPeriodEnd}
                  </p>
                )}
              </div>
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                {subscribing ? 'Loading...' : 'Resubscribe'}
              </button>
            </div>
          </div>
        ) : (
          /* ── Not subscribed ── */
          <div className="mb-4 bg-gradient-to-r from-emerald-900/30 to-slate-800/50 border border-emerald-500/30 rounded-xl p-4">
            {subscriptionSuccess && (
              <div className="mb-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">
                <span className="text-emerald-400 text-xs font-semibold animate-pulse">Activating your subscription...</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-sm">Deal Alert SMS</h3>
                <p className="text-slate-400 text-xs mt-0.5">Get instant SMS alerts when investment deals below your ARV threshold appear</p>
              </div>
              {subscriptionSuccess ? (
                <span className="px-3 py-1.5 text-emerald-400 text-xs font-semibold animate-pulse">
                  Activating...
                </span>
              ) : (
                <button
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                >
                  {subscribing ? 'Loading...' : '$5/mo'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <InvestorFilterBar
          activeFilter={activeFilter}
          onFilterChange={(filter) => { setActiveFilter(filter); setCurrentPage(1); }}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(newSortBy, newSortOrder) => {
            setSortBy(newSortBy);
            setSortOrder(newSortOrder);
            setCurrentPage(1);
          }}
          excludeLand={excludeLand}
          onExcludeLandChange={(exclude) => { setExcludeLand(exclude); setCurrentPage(1); }}
          stats={stats}
        />

        {/* Deals Grid */}
        {dealsLoading ? (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-slate-700" />
                <div className="p-3.5 space-y-2.5">
                  <div className="h-4 bg-slate-700 rounded w-3/4" />
                  <div className="h-3 bg-slate-700 rounded w-1/2" />
                  <div className="h-3 bg-slate-700 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="mt-16 text-center">
            {dealsError ? (
              <>
                <div className="text-5xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-white mb-2">Failed to Load Deals</h2>
                <p className="text-slate-400 mb-4">
                  Something went wrong loading properties. Please try again.
                </p>
                <button
                  onClick={() => { setDealsError(false); setCurrentPage(1); setFetchKey(k => k + 1); }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-all"
                >
                  Retry
                </button>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4">🏠</div>
                <h2 className="text-xl font-bold text-white mb-2">No Deals Found</h2>
                <p className="text-slate-400 mb-4">
                  No properties match your current filters in <span className="text-emerald-400">{profile?.city}</span>.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => { setActiveFilter('all'); setCurrentPage(1); }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-all"
                  >
                    Show All Deals
                  </button>
                  <Link
                    href="/dashboard/settings"
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg transition-all"
                  >
                    Change Location
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {deals.map((deal, index) => (
                <InvestorPropertyCard
                  key={deal.id}
                  deal={deal}
                  isLiked={likedProperties.includes(deal.id)}
                  onToggleLike={() => toggleLike(deal.id)}
                  onHide={() => hideProperty(deal.id)}
                  isPriority={index < 6}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between px-2">
                <div className="text-sm text-slate-400">
                  Showing {Math.min(((currentPage - 1) * PAGE_SIZE) + 1, totalDeals)}-{Math.min(currentPage * PAGE_SIZE, totalDeals)} of {totalDeals}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 text-xs bg-slate-700/60 hover:bg-slate-600/60 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed border border-slate-600/50"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-xs bg-slate-700/60 hover:bg-slate-600/60 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed border border-slate-600/50"
                  >
                    Prev
                  </button>
                  <span className="px-3 py-1.5 text-xs text-white bg-emerald-600 rounded-lg font-semibold">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-xs bg-slate-700/60 hover:bg-slate-600/60 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed border border-slate-600/50"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 text-xs bg-slate-700/60 hover:bg-slate-600/60 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed border border-slate-600/50"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
