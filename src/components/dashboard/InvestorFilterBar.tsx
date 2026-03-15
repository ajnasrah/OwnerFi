'use client';

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
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  stats: {
    total: number;
    ownerFinance: number;
    cashDeal: number;
  };
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
  showHidden,
  onShowHiddenChange,
  stats,
}: InvestorFilterBarProps) {
  return (
    <div className="space-y-2">
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
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 border border-slate-700/50'
              }`}
            >
              <div className="text-sm font-bold leading-tight">
                <span className="sm:hidden">{option.shortLabel}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </div>
              <div className={`text-[11px] mt-0.5 ${isActive ? 'text-emerald-100' : 'text-slate-500'}`}>
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
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
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
          className="bg-slate-700/60 border border-slate-600/50 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
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
    </div>
  );
}

// Helper to convert filters to API params
export function getFilterParams(dealType: DealTypeFilter, priceFilter: PriceFilter, excludeLand: boolean): {
  dealType: DealTypeFilter;
  minPrice?: number;
  maxPrice?: number;
  maxArvPercent?: number;
  excludeLand?: boolean;
} {
  const base = {
    dealType,
    excludeLand: excludeLand || undefined,
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
