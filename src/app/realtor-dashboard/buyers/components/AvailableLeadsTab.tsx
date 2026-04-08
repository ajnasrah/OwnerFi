'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { DashboardData, Agreement } from '../types';
import { LeadCard } from './LeadCard';
import { LeadCardSkeletonGrid } from './LeadCardSkeleton';

const PAGE_SIZE = 20;
const FREE_LIMIT = 3;

interface AvailableLeadsTabProps {
  dashboardData: DashboardData;
  pendingAgreements: Agreement[];
  signedAgreements: Agreement[];
  isFetching: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  cityFilter: string;
  setCityFilter: (c: string) => void;
  onAcceptLead: (leadId: string, buyerName: string) => void;
  onViewAgreements: () => void;
}

export function AvailableLeadsTab({
  dashboardData,
  pendingAgreements,
  signedAgreements,
  isFetching,
  searchQuery,
  setSearchQuery,
  cityFilter,
  setCityFilter,
  onAcceptLead,
  onViewAgreements,
}: AvailableLeadsTabProps) {
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Reset pagination when search/filter results change (not on background refetch)
  const prevLeadCountRef = useRef(dashboardData.availableLeads.length);
  const prevFirstLeadRef = useRef(dashboardData.availableLeads[0]?.id);
  useEffect(() => {
    const newCount = dashboardData.availableLeads.length;
    const newFirst = dashboardData.availableLeads[0]?.id;
    if (newCount !== prevLeadCountRef.current || newFirst !== prevFirstLeadRef.current) {
      setDisplayCount(PAGE_SIZE);
      prevLeadCountRef.current = newCount;
      prevFirstLeadRef.current = newFirst;
    }
  }, [dashboardData.availableLeads.length, dashboardData.availableLeads[0]?.id]);

  const pendingCount = pendingAgreements.length;
  const hasCredits = (dashboardData.realtorData.credits || 0) > 0;
  const atLimit = pendingCount >= FREE_LIMIT && !hasCredits;

  const visibleLeads = useMemo(
    () => dashboardData.availableLeads.slice(0, displayCount),
    [dashboardData.availableLeads, displayCount]
  );

  const hasMore = displayCount < dashboardData.availableLeads.length;

  return (
    <div>
      {/* Search + Filter — single row on mobile */}
      <div className="mb-2 md:mb-4 flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-400 focus:border-[#00BC7D] focus:outline-none"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">&#128269;</span>
        </div>
        <div className="w-32 md:w-48 relative">
          <input
            type="text"
            placeholder="City..."
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-400 focus:border-[#00BC7D] focus:outline-none"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">&#128205;</span>
        </div>
        {(searchQuery || cityFilter) && (
          <button
            onClick={() => { setSearchQuery(''); setCityFilter(''); }}
            className="px-2 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-xs"
          >
            Clear
          </button>
        )}
      </div>

      {/* Pending status — compact inline on mobile, full on desktop */}
      <div className={`mb-2 md:mb-4 px-3 py-2 md:p-4 rounded-lg border flex items-center justify-between ${
        atLimit ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-slate-700/30 border-slate-600/30'
      }`}>
        <div className="flex items-center gap-2 text-sm">
          <span className={`font-bold ${atLimit ? 'text-yellow-400' : 'text-[#00BC7D]'}`}>
            {pendingCount}/{FREE_LIMIT}
          </span>
          <span className="text-slate-400 hidden md:inline">pending leads</span>
          {hasCredits && (
            <span className="text-blue-400 text-xs">+{dashboardData.realtorData.credits} credits</span>
          )}
        </div>
        {atLimit && (
          <Link href="/buy-credits" className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded-lg font-medium text-xs transition-colors">
            Buy More
          </Link>
        )}
      </div>

      {/* Content */}
      {isFetching && dashboardData.availableLeads.length === 0 ? (
        <LeadCardSkeletonGrid count={6} />
      ) : dashboardData.availableLeads.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">&#128235;</div>
          <h3 className="text-xl font-bold text-white mb-2">No leads available</h3>
          <p className="text-slate-400">New buyer leads will appear here when they register in your area.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {visibleLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                pendingAgreements={pendingAgreements}
                signedAgreements={signedAgreements}
                hasCredits={hasCredits}
                pendingCount={pendingCount}
                onAcceptLead={onAcceptLead}
                onViewAgreements={onViewAgreements}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setDisplayCount(prev => prev + PAGE_SIZE)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Load More ({dashboardData.availableLeads.length - displayCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
