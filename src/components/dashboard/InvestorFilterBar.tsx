'use client';

import { useState, useEffect, useCallback } from 'react';
import { FilterEditor } from '@/components/filters/FilterEditor';
import { FilterConfig, EMPTY_FILTER } from '@/lib/filter-schema';

export type DealTypeFilter = 'all' | 'owner_finance' | 'cash_deal';
export type PriceFilter = 'none' | 'under80' | 'under100k' | '100k-200k' | '200k-300k';
type SortField = 'price' | 'percentOfArv' | 'discount' | 'monthlyPayment';

interface InvestorFilterBarProps {
  dealType: DealTypeFilter;
  onDealTypeChange: (filter: DealTypeFilter) => void;
  priceFilter: PriceFilter;
  onPriceFilterChange: (filter: PriceFilter) => void;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: SortField, sortOrder: 'asc' | 'desc') => void;
  excludeLand: boolean;
  onExcludeLandChange: (exclude: boolean) => void;
  excludeAuctions: boolean;
  onExcludeAuctionsChange: (exclude: boolean) => void;
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  stats: {
    total: number;
    ownerFinance: number;
    cashDeal: number;
  };
  /** Fires after the user saves their location/zip filter so the parent can refetch deals. */
  onLocationsChanged?: () => void;
  /** Hides the location/zip editor chip. Used by admin preview pages where
   *  edits would write under the admin's session, not the previewed buyer's. */
  previewMode?: boolean;
}

const DEAL_TYPE_FILTERS: { key: DealTypeFilter; label: string; shortLabel: string }[] = [
  { key: 'all', label: 'All Deals', shortLabel: 'All' },
  { key: 'owner_finance', label: 'Owner Finance', shortLabel: 'Owner Fin' },
  { key: 'cash_deal', label: 'Cash Deals', shortLabel: 'Cash' },
];

const PRICE_FILTERS: { key: PriceFilter; label: string }[] = [
  { key: 'under80', label: '<80% Zest' },
  { key: 'under100k', label: '<$100K' },
  { key: '100k-200k', label: '$100-200K' },
  { key: '200k-300k', label: '$200-300K' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'price', label: 'Price' },
  { value: 'percentOfArv', label: '% of Zestimate' },
  { value: 'discount', label: 'Discount' },
  { value: 'monthlyPayment', label: 'Monthly Payment' },
];

export function InvestorFilterBar({
  dealType,
  onDealTypeChange,
  priceFilter,
  onPriceFilterChange,
  sortBy,
  sortOrder,
  onSortChange,
  excludeLand,
  onExcludeLandChange,
  excludeAuctions,
  onExcludeAuctionsChange,
  showHidden,
  onShowHiddenChange,
  stats,
  onLocationsChanged,
  previewMode = false,
}: InvestorFilterBarProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<FilterConfig | null>(null);
  const [summary, setSummary] = useState<FilterConfig>(EMPTY_FILTER);

  // Load summary once for the chip text; refresh when parent signals changes.
  // Skipped in previewMode — we'd be loading the admin's filter, not the
  // previewed buyer's.
  const loadSummary = useCallback(async () => {
    if (previewMode) return;
    try {
      const res = await fetch('/api/user/filters', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setSummary(data.filter || EMPTY_FILTER);
    } catch {
      // non-fatal — chip just shows "Locations" with no count
    }
  }, [previewMode]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const openEditor = async () => {
    setEditorOpen(true);
    setEditorLoading(true);
    try {
      const res = await fetch('/api/user/filters', { cache: 'no-store' });
      const data = res.ok ? await res.json() : {};
      setCurrentFilter(data.filter || EMPTY_FILTER);
    } catch {
      setCurrentFilter(EMPTY_FILTER);
    } finally {
      setEditorLoading(false);
    }
  };

  const saveEditor = async (next: FilterConfig) => {
    setEditorSaving(true);
    try {
      const res = await fetch('/api/user/filters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSummary(data.filter || next);
      setCurrentFilter(data.filter || next);
      setEditorOpen(false);
      onLocationsChanged?.();
    } finally {
      setEditorSaving(false);
    }
  };

  const locCount = summary.locations.length;
  const zipCount = summary.zips.codes.length;
  const zipLabel =
    summary.zips.mode === 'include'
      ? `${zipCount} zip${zipCount === 1 ? '' : 's'} included`
      : summary.zips.mode === 'exclude'
      ? `${zipCount} zip${zipCount === 1 ? '' : 's'} excluded`
      : null;

  return (
    <div className="space-y-2">
      {/* Row 0: Locations + zips chip — hidden in admin preview mode */}
      {!previewMode && (
        <button
          type="button"
          onClick={openEditor}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 transition-colors text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-4 h-4 text-[#00BC7D] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm text-white font-medium truncate">
              {locCount === 0 && !zipLabel && 'Set locations'}
              {locCount > 0 && `${locCount} ${locCount === 1 ? 'city' : 'cities'}`}
              {locCount > 0 && zipLabel && ' · '}
              {zipLabel}
            </span>
          </div>
          <span className="text-xs text-slate-400 flex-shrink-0">Edit →</span>
        </button>
      )}

      {/* Row 1: Deal type tabs with counts */}
      <div className="grid grid-cols-3 gap-1.5" role="toolbar" aria-label="Deal type filters">
        {DEAL_TYPE_FILTERS.map((option) => {
          const count = option.key === 'all' ? stats.total
            : option.key === 'owner_finance' ? stats.ownerFinance
            : stats.cashDeal;
          const isActive = dealType === option.key;
          return (
            <button
              key={option.key}
              onClick={() => onDealTypeChange(option.key)}
              aria-pressed={isActive}
              className={`px-2 py-2 rounded-xl text-center transition-all ${
                isActive
                  ? 'bg-[#00BC7D] text-white shadow-lg shadow-[#00BC7D]/25'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 border border-slate-700/50'
              }`}
            >
              <div className="text-sm font-bold leading-tight">
                <span className="sm:hidden">{option.shortLabel}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </div>
              <div className={`text-[11px] mt-0.5 ${isActive ? 'text-[#B3F0DB]' : 'text-slate-500'}`}>
                {count} deals
              </div>
            </button>
          );
        })}
      </div>

      {/* Row 2: Price filters + toggles — scrollable */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide" role="toolbar" aria-label="Price and toggle filters">
        {PRICE_FILTERS.map((option) => {
          const isActive = priceFilter === option.key;
          return (
            <button
              key={option.key}
              onClick={() => onPriceFilterChange(isActive ? 'none' : option.key)}
              aria-pressed={isActive}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#00BC7D] text-white shadow-lg shadow-[#00BC7D]/25'
                  : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60 border border-slate-600/50'
              }`}
            >
              {option.label}
            </button>
          );
        })}

        <div className="w-px h-6 bg-slate-700/50 flex-shrink-0 mx-0.5" />

        {/* Hide Land toggle */}
        <button
          type="button"
          onClick={() => onExcludeLandChange(!excludeLand)}
          aria-pressed={excludeLand}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            excludeLand
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
              : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60 border border-slate-600/50'
          }`}
        >
          {excludeLand ? 'Land Hidden' : 'Hide Land'}
        </button>

        {/* Hide Auctions toggle — also hides foreclosure / bank-owned */}
        <button
          type="button"
          onClick={() => onExcludeAuctionsChange(!excludeAuctions)}
          aria-pressed={excludeAuctions}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            excludeAuctions
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
              : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60 border border-slate-600/50'
          }`}
          title="Hides auctions, foreclosures, and bank-owned listings"
        >
          {excludeAuctions ? 'Auctions Hidden' : 'Hide Auctions'}
        </button>

        {/* Show Hidden toggle */}
        <button
          onClick={() => onShowHiddenChange(!showHidden)}
          aria-pressed={showHidden}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            showHidden
              ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
              : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60 border border-slate-600/50'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {showHidden ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            )}
          </svg>
          {showHidden ? 'Hidden' : 'Hidden'}
        </button>
      </div>

      {/* Row 3: Sort */}
      <div className="flex items-center gap-1.5">
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortField, sortOrder)}
          aria-label="Sort by"
          className="bg-slate-700/60 border border-slate-600/50 rounded-xl px-3 py-2 text-xs text-white focus:border-[#00BC7D] focus:outline-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>Sort: {option.label}</option>
          ))}
        </select>
        <button
          onClick={() => onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
          className="w-9 h-9 flex items-center justify-center bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-300 hover:text-white hover:bg-slate-600/60 transition-all"
          aria-label={sortOrder === 'asc' ? 'Switch to descending' : 'Switch to ascending'}
        >
          {sortOrder === 'asc' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
        {showHidden && (
          <span className="text-[11px] text-slate-500 ml-1">Viewing hidden deals - tap X to unhide</span>
        )}
      </div>

      {/* Locations & Zips editor modal */}
      {editorOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-modal flex items-start justify-center p-4 overflow-y-auto" onClick={() => setEditorOpen(false)}>
          <div
            className="bg-[#111625] border border-slate-700 rounded-2xl max-w-2xl w-full my-8 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Locations & Zip Codes</h2>
              <button
                onClick={() => setEditorOpen(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
            {editorLoading || !currentFilter ? (
              <div className="py-12 text-center text-slate-400 text-sm">Loading…</div>
            ) : (
              <FilterEditor
                initialFilter={currentFilter}
                onSave={saveEditor}
                saving={editorSaving}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to convert filters to API params
export function getFilterParams(
  dealType: DealTypeFilter,
  priceFilter: PriceFilter,
  excludeLand: boolean,
  excludeAuctions: boolean = false,
): {
  dealType: DealTypeFilter;
  minPrice?: number;
  maxPrice?: number;
  maxArvPercent?: number;
  excludeLand?: boolean;
  excludeAuctions?: boolean;
} {
  const base = {
    dealType,
    excludeLand: excludeLand || undefined,
    excludeAuctions: excludeAuctions || undefined,
  };

  switch (priceFilter) {
    case 'under80':
      return { ...base, maxArvPercent: 80 };
    case 'under100k':
      return { ...base, maxPrice: 100000 };
    case '100k-200k':
      return { ...base, minPrice: 100000, maxPrice: 200000 };
    case '200k-300k':
      return { ...base, minPrice: 200000, maxPrice: 300000 };
    default:
      return base;
  }
}
