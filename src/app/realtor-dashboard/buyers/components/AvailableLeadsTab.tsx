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
      {/* Search and Filter Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:border-[#00BC7D] focus:outline-none"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">&#128269;</span>
        </div>
        <div className="sm:w-48 relative">
          <input
            type="text"
            placeholder="Filter by city..."
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:border-[#00BC7D] focus:outline-none"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">&#128205;</span>
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
      <div className={`mb-6 p-4 rounded-lg border ${
        atLimit
          ? 'bg-yellow-500/10 border-yellow-500/30'
          : 'bg-slate-700/30 border-slate-600/30'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-medium">Free Leads:</span>
              <span className={`font-bold ${atLimit ? 'text-yellow-400' : 'text-[#00BC7D]'}`}>
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
