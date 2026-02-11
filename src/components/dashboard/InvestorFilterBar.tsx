'use client';

type DealTypeFilter = 'all' | 'owner_finance' | 'cash_deal';
type QuickFilter = 'all' | 'owner_finance' | 'cash_deal' | 'under80' | 'under100k' | '100k-200k' | '200k-300k';
type SortField = 'price' | 'percentOfArv' | 'discount' | 'monthlyPayment';

interface InvestorFilterBarProps {
  activeFilter: QuickFilter;
  onFilterChange: (filter: QuickFilter) => void;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: SortField, sortOrder: 'asc' | 'desc') => void;
  excludeLand: boolean;
  onExcludeLandChange: (exclude: boolean) => void;
  stats: {
    total: number;
    avgPrice: number;
    ownerFinance: number;
    cashDeal: number;
  };
}

const FILTER_OPTIONS: { key: QuickFilter; label: string }[] = [
  { key: 'all', label: 'All Deals' },
  { key: 'owner_finance', label: 'Owner Finance' },
  { key: 'cash_deal', label: 'Cash Deals' },
  { key: 'under80', label: 'Under 80% Zest' },
  { key: 'under100k', label: 'Under $100K' },
  { key: '100k-200k', label: '$100K-$200K' },
  { key: '200k-300k', label: '$200K-$300K' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'price', label: 'Price' },
  { value: 'percentOfArv', label: '% of Zestimate' },
  { value: 'discount', label: 'Discount' },
  { value: 'monthlyPayment', label: 'Monthly Payment' },
];

export function InvestorFilterBar({
  activeFilter,
  onFilterChange,
  sortBy,
  sortOrder,
  onSortChange,
  excludeLand,
  onExcludeLandChange,
  stats,
}: InvestorFilterBarProps) {
  return (
    <div className="space-y-3">
      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="text-emerald-400 font-bold text-sm">{stats.total} deals</span>
        {stats.total > 0 && (
          <>
            <span>Avg ${Math.round(stats.avgPrice / 1000)}K</span>
            <span className="hidden sm:inline">{stats.ownerFinance} Owner Finance</span>
            <span className="hidden sm:inline">{stats.cashDeal} Cash</span>
          </>
        )}
      </div>

      {/* Filter chips + sort */}
      <div className="flex items-center gap-2">
        {/* Scrollable filter chips */}
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide" role="toolbar" aria-label="Deal filters">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => onFilterChange(option.key)}
              aria-pressed={activeFilter === option.key}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeFilter === option.key
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                  : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60 border border-slate-600/50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Hide Land toggle */}
        <button
          onClick={() => onExcludeLandChange(!excludeLand)}
          aria-pressed={excludeLand}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            excludeLand
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
              : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60 border border-slate-600/50'
          }`}
        >
          {excludeLand ? 'Land Hidden' : 'Hide Land'}
        </button>

        {/* Sort dropdown */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortField, sortOrder)}
            aria-label="Sort by"
            className="bg-slate-700/60 border border-slate-600/50 rounded-lg px-2 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            onClick={() => onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
            className="w-8 h-8 flex items-center justify-center bg-slate-700/60 border border-slate-600/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-600/60 transition-all"
            aria-label={sortOrder === 'asc' ? 'Switch to descending' : 'Switch to ascending'}
          >
            {sortOrder === 'asc' ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper to convert quick filter to API params
export function getFilterParams(filter: QuickFilter, excludeLand?: boolean): {
  dealType: DealTypeFilter;
  minPrice?: number;
  maxPrice?: number;
  maxArvPercent?: number;
  excludeLand?: boolean;
} {
  const base = { excludeLand: excludeLand || undefined };
  switch (filter) {
    case 'owner_finance':
      return { ...base, dealType: 'owner_finance' };
    case 'cash_deal':
      return { ...base, dealType: 'cash_deal' };
    case 'under80':
      return { ...base, dealType: 'cash_deal', maxArvPercent: 80 };
    case 'under100k':
      return { ...base, dealType: 'all', maxPrice: 100000 };
    case '100k-200k':
      return { ...base, dealType: 'all', minPrice: 100000, maxPrice: 200000 };
    case '200k-300k':
      return { ...base, dealType: 'all', minPrice: 200000, maxPrice: 300000 };
    default:
      return { ...base, dealType: 'all' };
  }
}
