'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { InvestorPropertyCard } from '@/components/dashboard/InvestorPropertyCard';
import { InvestorFilterBar, getFilterParams, type DealTypeFilter, type PriceFilter } from '@/components/dashboard/InvestorFilterBar';
import type { InvestorDeal } from '@/app/api/buyer/investor-deals/route';

type SortField = 'price' | 'percentOfArv' | 'discount' | 'monthlyPayment';

interface BuyerProfile {
  id: string;
  firstName: string;
  lastName: string;
  preferredCity?: string;
  city?: string;
  preferredState?: string;
  state?: string;
  isInvestor?: boolean;
  dealTypePreference?: 'all' | 'owner_finance' | 'cash_deal';
  likedPropertyIds?: string[];
}

export default function InvestorPreview() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const buyerId = params.buyerId as string;

  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Deals
  const [deals, setDeals] = useState<InvestorDeal[]>([]);
  const [totalDeals, setTotalDeals] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [breakdown, setBreakdown] = useState<{ ownerFinance: number; cashDeal: number; total: number }>({ ownerFinance: 0, cashDeal: 0, total: 0 });
  const [dealsLoading, setDealsLoading] = useState(false);
  const [likedProperties, setLikedProperties] = useState<string[]>([]);

  // Filters
  const [dealType, setDealType] = useState<DealTypeFilter>('all');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('none');
  const [sortBy, setSortBy] = useState<SortField>('price');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [excludeLand, setExcludeLand] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Auth check - admin only
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/');
    } else if (status === 'authenticated' && (session?.user as { role?: string })?.role !== 'admin') {
      router.replace('/');
    }
  }, [status, session, router]);

  // Load buyer data
  useEffect(() => {
    if (status === 'authenticated' && (session?.user as { role?: string })?.role === 'admin') {
      loadBuyerProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, buyerId]);

  const loadBuyerProfile = async () => {
    try {
      setLoading(true);
      const profileRes = await fetch(`/api/admin/buyers/profile/${buyerId}`);
      if (!profileRes.ok) {
        router.replace('/admin/buyers');
        return;
      }
      const profileData = await profileRes.json();

      if (!profileData.profile) {
        router.replace('/admin/buyers');
        return;
      }

      setProfile(profileData.profile);
      setLikedProperties(profileData.profile.likedPropertyIds || []);

      // Set initial filter from buyer's deal type preference
      if (profileData.profile.dealTypePreference && profileData.profile.dealTypePreference !== 'all') {
        setDealType(profileData.profile.dealTypePreference);
      }
    } catch {
      router.replace('/admin/buyers');
    } finally {
      setLoading(false);
    }
  };

  // Fetch deals when filters change
  useEffect(() => {
    if (!profile) return undefined;

    const abortController = new AbortController();
    const fetchDeals = async () => {
      setDealsLoading(true);
      try {
        const filterParams = getFilterParams(dealType, priceFilter, excludeLand);
        const searchParams = new URLSearchParams({
          dealType: filterParams.dealType,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
          previewBuyerId: buyerId, // Admin preview: load this buyer's profile on the server
        });
        if (filterParams.minPrice) searchParams.set('minPrice', String(filterParams.minPrice));
        if (filterParams.maxPrice) searchParams.set('maxPrice', String(filterParams.maxPrice));
        if (filterParams.maxArvPercent) searchParams.set('maxArvPercent', String(filterParams.maxArvPercent));
        if (filterParams.excludeLand) searchParams.set('excludeLand', 'true');

        const res = await fetch(`/api/buyer/investor-deals?${searchParams}`, {
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
        }
      } finally {
        if (!abortController.signal.aborted) {
          setDealsLoading(false);
        }
      }
    };

    fetchDeals();
    return () => abortController.abort();
  }, [profile, dealType, priceFilter, sortBy, sortOrder, excludeLand, currentPage]);

  // Like toggle - UI only, no server calls (admin preview)
  const toggleLike = useCallback((dealId: string) => {
    setLikedProperties(prev =>
      prev.includes(dealId) ? prev.filter(id => id !== dealId) : [...prev, dealId]
    );
  }, []);

  // Stats for filter bar
  const stats = useMemo(() => ({
    total: breakdown.total,
    ownerFinance: breakdown.ownerFinance,
    cashDeal: breakdown.cashDeal,
  }), [breakdown]);

  const city = profile?.preferredCity || profile?.city || '';
  const state = profile?.preferredState || profile?.state || '';

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-3xl animate-pulse" />
            <div className="absolute inset-2 bg-slate-900 rounded-2xl flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
          <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-1">Loading Investor Preview</h1>
          <p className="text-slate-400 text-sm">Loading investor experience for {city || 'preview'}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Admin Preview Banner */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-yellow-500 text-black px-4 py-2 text-center font-bold text-sm">
        📊 ADMIN INVESTOR PREVIEW — Viewing as: {profile?.firstName} {profile?.lastName} ({city}, {state})
        <Link href="/admin/buyers" className="ml-4 underline">Back to Admin</Link>
      </div>

      {/* Header (offset for admin banner) */}
      <header className="sticky top-10 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            {/* Left: Location (disabled in preview) */}
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xl rounded-full px-3 py-1.5 border border-white/10 opacity-90 cursor-not-allowed">
              <span className="text-sm">📍</span>
              <span className="text-white font-bold text-xs">{city}, {state}</span>
            </div>

            {/* Center: Branding */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-emerald-400 font-black text-sm">INVESTOR</span>
              <span className="text-slate-500 text-xs">Preview</span>
            </div>

            {/* Right: Liked count (display only) */}
            <div className="flex items-center gap-1.5">
              <div className="relative w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                {likedProperties.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold border border-slate-900">
                    {likedProperties.length}
                  </span>
                )}
              </div>
              <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/10 opacity-50 cursor-not-allowed">
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/10 opacity-50 cursor-not-allowed">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* Filter Bar */}
        <InvestorFilterBar
          dealType={dealType}
          onDealTypeChange={(dt) => { setDealType(dt); setCurrentPage(1); }}
          priceFilter={priceFilter}
          onPriceFilterChange={(pf) => { setPriceFilter(pf); setCurrentPage(1); }}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(newSortBy, newSortOrder) => {
            setSortBy(newSortBy);
            setSortOrder(newSortOrder);
            setCurrentPage(1);
          }}
          excludeLand={excludeLand}
          onExcludeLandChange={(exclude) => { setExcludeLand(exclude); setCurrentPage(1); }}
          showHidden={showHidden}
          onShowHiddenChange={(show) => { setShowHidden(show); setCurrentPage(1); }}
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
            <div className="text-5xl mb-4">🏠</div>
            <h2 className="text-xl font-bold text-white mb-2">No Deals Found</h2>
            <p className="text-slate-400 mb-4">
              No properties match the current filters in <span className="text-emerald-400">{city}</span>.
            </p>
            <button
              onClick={() => { setDealType('all'); setPriceFilter('none'); setCurrentPage(1); }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-all"
            >
              Show All Deals
            </button>
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
