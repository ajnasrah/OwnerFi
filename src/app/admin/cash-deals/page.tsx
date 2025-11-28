'use client';

import { useState, useEffect, useMemo } from 'react';

interface CashFlowData {
  downPayment: number;
  monthlyMortgage: number;
  monthlyInsurance: number;
  monthlyTax: number;
  monthlyHoa: number;
  monthlyMgmt: number;
  monthlyExpenses: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  cocReturn: number;
}

interface CashDeal {
  id: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  price: number;
  arv: number;
  percentOfArv: number;
  discount: number;
  beds: number;
  baths: number;
  sqft: number;
  url: string;
  imgSrc: string;
  status: string;
  rentEstimate: number;
  annualTax: number;
  monthlyHoa: number;
  missingFields: string[];
  cashFlow: CashFlowData | null;
  ownerFinanceVerified?: boolean;
  monthlyPayment?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  interestRate?: number;
  termYears?: number;
  balloonYears?: number;
}

type SortField = 'percentOfArv' | 'price' | 'arv' | 'discount' | 'monthlyCashFlow' | 'cocReturn' | 'rentEstimate';

// Quick filter presets for investors
const QUICK_FILTERS = {
  bestCoc: { label: 'Best CoC %', icon: '%', sortBy: 'cocReturn' as SortField, sortOrder: 'desc' as const, minCoc: 15 },
  highCashFlow: { label: 'High Cash Flow', icon: '$', sortBy: 'monthlyCashFlow' as SortField, sortOrder: 'desc' as const, minCashFlow: 300 },
  bigDiscounts: { label: 'Big Discounts', icon: '!', sortBy: 'percentOfArv' as SortField, sortOrder: 'asc' as const, maxArv: 55 },
  under100k: { label: 'Under $100K', icon: '<', sortBy: 'cocReturn' as SortField, sortOrder: 'desc' as const, maxPrice: 100000 },
  midRange: { label: '$100K-$200K', icon: '~', sortBy: 'cocReturn' as SortField, sortOrder: 'desc' as const, minPrice: 100000, maxPrice: 200000 },
  allDeals: { label: 'All Deals', icon: '*', sortBy: 'cocReturn' as SortField, sortOrder: 'desc' as const },
};

type QuickFilterKey = keyof typeof QUICK_FILTERS;

export default function CashDealsPage() {
  const [allDeals, setAllDeals] = useState<CashDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Location filters (server-side)
  const [citySearch, setCitySearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [radius, setRadius] = useState(0);

  // Sort controls
  const [sortBy, setSortBy] = useState<SortField>('cocReturn');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Advanced filters (client-side for instant filtering)
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [minCoc, setMinCoc] = useState<number | ''>('');
  const [minCashFlow, setMinCashFlow] = useState<number | ''>('');
  const [maxArv, setMaxArv] = useState<number | ''>('');
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilterKey>('allDeals');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchDeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (citySearch) params.set('city', citySearch);
      if (stateFilter) params.set('state', stateFilter);
      if (radius > 0) params.set('radius', String(radius));
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      params.set('limit', '500'); // Fetch more for client-side filtering

      const res = await fetch(`/api/admin/cash-deals?${params}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setAllDeals([]);
      } else {
        setAllDeals(data.deals || []);
        if (data.states) setStates(data.states);
      }
    } catch (err: any) {
      console.error('Error fetching deals:', err);
      setError(err.message || 'Failed to fetch deals');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDeals();
  }, [stateFilter, citySearch, radius]);

  // Apply quick filter preset
  const applyQuickFilter = (key: QuickFilterKey) => {
    const filter = QUICK_FILTERS[key];
    setActiveQuickFilter(key);
    setSortBy(filter.sortBy);
    setSortOrder(filter.sortOrder);

    // Clear all advanced filters first
    setMinPrice('');
    setMaxPrice('');
    setMinCoc('');
    setMinCashFlow('');
    setMaxArv('');

    // Apply preset filters
    if ('minCoc' in filter) setMinCoc(filter.minCoc!);
    if ('minCashFlow' in filter) setMinCashFlow(filter.minCashFlow!);
    if ('maxArv' in filter) setMaxArv(filter.maxArv!);
    if ('minPrice' in filter) setMinPrice(filter.minPrice!);
    if ('maxPrice' in filter) setMaxPrice(filter.maxPrice!);
  };

  // Client-side filtered and sorted deals
  const filteredDeals = useMemo(() => {
    let result = [...allDeals];

    // Apply client-side filters
    if (minPrice !== '') result = result.filter(d => d.price >= minPrice);
    if (maxPrice !== '') result = result.filter(d => d.price <= maxPrice);
    if (minCoc !== '') result = result.filter(d => (d.cashFlow?.cocReturn || 0) >= minCoc);
    if (minCashFlow !== '') result = result.filter(d => (d.cashFlow?.monthlyCashFlow || 0) >= minCashFlow);
    if (maxArv !== '') result = result.filter(d => d.percentOfArv <= maxArv);

    // Sort
    result.sort((a, b) => {
      let aVal: number, bVal: number;

      if (sortBy === 'monthlyCashFlow' || sortBy === 'cocReturn') {
        aVal = a.cashFlow?.[sortBy] ?? (sortOrder === 'asc' ? Infinity : -Infinity);
        bVal = b.cashFlow?.[sortBy] ?? (sortOrder === 'asc' ? Infinity : -Infinity);
      } else {
        aVal = (a as any)[sortBy] ?? (sortOrder === 'asc' ? Infinity : -Infinity);
        bVal = (b as any)[sortBy] ?? (sortOrder === 'asc' ? Infinity : -Infinity);
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [allDeals, minPrice, maxPrice, minCoc, minCashFlow, maxArv, sortBy, sortOrder]);

  // Stats for filtered deals
  const stats = useMemo(() => {
    const withCashFlow = filteredDeals.filter(d => d.cashFlow);
    const avgCoc = withCashFlow.length > 0
      ? withCashFlow.reduce((sum, d) => sum + (d.cashFlow?.cocReturn || 0), 0) / withCashFlow.length
      : 0;
    const avgCashFlow = withCashFlow.length > 0
      ? withCashFlow.reduce((sum, d) => sum + (d.cashFlow?.monthlyCashFlow || 0), 0) / withCashFlow.length
      : 0;
    const positiveCashFlow = withCashFlow.filter(d => (d.cashFlow?.monthlyCashFlow || 0) > 0).length;

    return { total: filteredDeals.length, avgCoc, avgCashFlow, positiveCashFlow };
  }, [filteredDeals]);

  const handleSort = (field: SortField) => {
    setActiveQuickFilter('allDeals'); // Clear quick filter when manually sorting
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      const descFields = ['discount', 'monthlyCashFlow', 'cocReturn', 'rentEstimate'];
      setSortOrder(descFields.includes(field) ? 'desc' : 'asc');
    }
  };

  const clearAllFilters = () => {
    setCitySearch('');
    setStateFilter('');
    setRadius(0);
    setMinPrice('');
    setMaxPrice('');
    setMinCoc('');
    setMinCashFlow('');
    setMaxArv('');
    setActiveQuickFilter('allDeals');
    setSortBy('cocReturn');
    setSortOrder('desc');
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-3 py-3 text-left cursor-pointer hover:bg-slate-600 select-none text-slate-300 text-xs font-semibold"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === field && (
          <span className="text-emerald-400 text-sm">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div className="h-screen overflow-hidden bg-slate-900 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-[1600px] mx-auto">
          {/* Header with Stats */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <a href="/admin" className="text-emerald-400 hover:text-emerald-300 text-sm mb-1 inline-block">← Back</a>
              <h1 className="text-2xl font-bold text-white">Cash Deals Finder</h1>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <div className="text-2xl font-bold text-emerald-400">{stats.total}</div>
                <div className="text-xs text-slate-400">Matches</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">{stats.avgCoc.toFixed(1)}%</div>
                <div className="text-xs text-slate-400">Avg CoC</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">${Math.round(stats.avgCashFlow)}</div>
                <div className="text-xs text-slate-400">Avg Cash Flow</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">{stats.positiveCashFlow}</div>
                <div className="text-xs text-slate-400">Positive CF</div>
              </div>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(QUICK_FILTERS).map(([key, filter]) => (
              <button
                key={key}
                onClick={() => applyQuickFilter(key as QuickFilterKey)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeQuickFilter === key
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                showAdvanced ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {showAdvanced ? 'Hide Filters' : 'More Filters'}
            </button>
          </div>

          {/* Advanced Filters Panel */}
          {showAdvanced && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {/* Location */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">City</label>
                  <input
                    type="text"
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    placeholder="Any city"
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 w-full text-sm text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">State</label>
                  <select
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 w-full text-sm text-white"
                  >
                    <option value="">All</option>
                    {states.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Min Price</label>
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => { setMinPrice(e.target.value ? parseInt(e.target.value) : ''); setActiveQuickFilter('allDeals'); }}
                    placeholder="$0"
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 w-full text-sm text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Max Price</label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => { setMaxPrice(e.target.value ? parseInt(e.target.value) : ''); setActiveQuickFilter('allDeals'); }}
                    placeholder="Any"
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 w-full text-sm text-white placeholder-slate-500"
                  />
                </div>

                {/* Returns */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Min CoC %</label>
                  <input
                    type="number"
                    value={minCoc}
                    onChange={(e) => { setMinCoc(e.target.value ? parseFloat(e.target.value) : ''); setActiveQuickFilter('allDeals'); }}
                    placeholder="0%"
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 w-full text-sm text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Min Cash Flow</label>
                  <input
                    type="number"
                    value={minCashFlow}
                    onChange={(e) => { setMinCashFlow(e.target.value ? parseInt(e.target.value) : ''); setActiveQuickFilter('allDeals'); }}
                    placeholder="$0/mo"
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 w-full text-sm text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Max % ARV</label>
                  <input
                    type="number"
                    value={maxArv}
                    onChange={(e) => { setMaxArv(e.target.value ? parseFloat(e.target.value) : ''); setActiveQuickFilter('allDeals'); }}
                    placeholder="70%"
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 w-full text-sm text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearAllFilters}
                  className="text-slate-400 hover:text-white text-sm px-3 py-1"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}

          {/* Results Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto"></div>
              <p className="mt-4 text-slate-400">Loading deals...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-red-900/30 rounded-lg border border-red-700">
              <p className="text-red-400 font-medium">Error loading deals</p>
              <p className="text-red-300 text-sm mt-2">{error}</p>
              <button onClick={fetchDeals} className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                Retry
              </button>
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="text-center py-12 bg-slate-800 rounded-lg border border-slate-700">
              <p className="text-slate-400">No deals match your filters</p>
              <button onClick={clearAllFilters} className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700 border-b border-slate-600">
                    <tr>
                      <th className="px-3 py-3 text-left text-slate-300 text-xs font-semibold">Property</th>
                      <th className="px-3 py-3 text-left text-slate-300 text-xs font-semibold">Location</th>
                      <SortHeader field="price" label="Price" />
                      <SortHeader field="percentOfArv" label="% ARV" />
                      <SortHeader field="cocReturn" label="CoC %" />
                      <SortHeader field="monthlyCashFlow" label="Cash Flow" />
                      <SortHeader field="rentEstimate" label="Rent" />
                      <th className="px-3 py-3 text-left text-slate-300 text-xs font-semibold">Specs</th>
                      <th className="px-3 py-3 text-left text-slate-300 text-xs font-semibold w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {filteredDeals.map((deal, idx) => {
                      const isTopDeal = (deal.cashFlow?.cocReturn || 0) >= 20 || (deal.cashFlow?.monthlyCashFlow || 0) >= 500;
                      return (
                        <tr
                          key={deal.id}
                          className={`hover:bg-slate-700/50 ${isTopDeal ? 'bg-emerald-900/20' : ''}`}
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {deal.imgSrc && (
                                <img src={deal.imgSrc} alt="" className="w-12 h-9 object-cover rounded" />
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate max-w-[180px] text-white">
                                  {deal.address}
                                </div>
                                <div className="flex gap-1 mt-0.5">
                                  {isTopDeal && (
                                    <span className="inline-block px-1 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded">
                                      TOP DEAL
                                    </span>
                                  )}
                                  {deal.ownerFinanceVerified && (
                                    <span className="inline-block px-1 py-0.5 text-[10px] font-semibold bg-blue-600 text-white rounded">
                                      OF
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-sm text-white">{deal.city}</div>
                            <div className="text-xs text-slate-400">{deal.state}</div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-white">${deal.price?.toLocaleString()}</div>
                            <div className="text-xs text-slate-400">
                              ${((deal.cashFlow?.downPayment || deal.price * 0.1) / 1000).toFixed(0)}K down
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`font-bold text-lg ${
                              deal.percentOfArv < 50 ? 'text-green-400' :
                              deal.percentOfArv < 60 ? 'text-yellow-400' :
                              'text-orange-400'
                            }`}>
                              {deal.percentOfArv}%
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {deal.cashFlow ? (
                              <span className={`font-bold text-lg ${
                                deal.cashFlow.cocReturn >= 20 ? 'text-green-400' :
                                deal.cashFlow.cocReturn >= 10 ? 'text-emerald-400' :
                                deal.cashFlow.cocReturn > 0 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                                {deal.cashFlow.cocReturn}%
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {deal.cashFlow ? (
                              <div>
                                <span className={`font-bold ${
                                  deal.cashFlow.monthlyCashFlow >= 300 ? 'text-green-400' :
                                  deal.cashFlow.monthlyCashFlow > 0 ? 'text-emerald-400' :
                                  'text-red-400'
                                }`}>
                                  ${deal.cashFlow.monthlyCashFlow?.toLocaleString()}
                                </span>
                                <span className="text-slate-400 text-xs">/mo</span>
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {deal.rentEstimate > 0 ? (
                              <div className="text-sm text-white">${deal.rentEstimate?.toLocaleString()}</div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-300">
                            {deal.beds}bd/{deal.baths}ba
                            {deal.sqft > 0 && <div className="text-slate-400">{deal.sqft.toLocaleString()}sf</div>}
                          </td>
                          <td className="px-3 py-2">
                            <a
                              href={deal.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                            >
                              View
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
