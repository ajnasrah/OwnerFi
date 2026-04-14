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
  const [excludeAuctions, setExcludeAuctions] = useState(false);
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
        const filterParams = getFilterParams(dealType, priceFilter, excludeLand, excludeAuctions);
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
        if (filterParams.excludeAuctions) searchParams.set('excludeAuctions', 'true');

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
  }, [profile, dealType, priceFilter, sortBy, sortOrder, excludeLand, excludeAuctions, currentPage]);

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
      <div className="h-screen bg-[#111625] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00BC7D] to-[#3B82F6] rounded-3xl animate-pulse" />
            <div className="absolute inset-2 bg-[#111625] rounded-2xl flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
          <div className="w-12 h-12 border-4 border-slate-700 border-t-[#00BC7D] rounded-full animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-1">Loading Investor Preview</h1>
          <p className="text-slate-400 text-sm">Loading investor experience for {city || 'preview'}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111625]">
      {/* Admin Preview Banner */}
      <div className="bg-yellow-500 text-black px-4 py-2 text-center font-bold text-sm">
        📊 ADMIN INVESTOR PREVIEW — Viewing as: {profile?.firstName} {profile?.lastName} ({city}, {state})
        <Link href="/admin/buyers" className="ml-4 underline">Back to Admin</Link>
      </div>

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
          excludeAuctions={excludeAuctions}
          onExcludeAuctionsChange={(exclude) => { setExcludeAuctions(exclude); setCurrentPage(1); }}
          showHidden={showHidden}
          onShowHiddenChange={(show) => { setShowHidden(show); setCurrentPage(1); }}
          stats={stats}
          previewMode
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
              No properties match the current filters in <span className="text-[#00BC7D]">{city}</span>.
            </p>
            <button
              onClick={() => { setDealType('all'); setPriceFilter('none'); setCurrentPage(1); }}
              className="px-4 py-2 bg-[#00BC7D] hover:bg-[#00BC7D]/50 text-white text-sm font-semibold rounded-lg transition-all"
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
                  <span className="px-3 py-1.5 text-xs text-white bg-[#00BC7D] rounded-lg font-semibold">
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
