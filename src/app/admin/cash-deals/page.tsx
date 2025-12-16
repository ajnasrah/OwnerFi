'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';


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
  ownerFinanceVerified?: boolean;
  monthlyPayment?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  interestRate?: number;
  termYears?: number;
  balloonYears?: number;
  sentToGHL?: string;
}

type SortField = 'percentOfArv' | 'price' | 'arv' | 'discount' | 'rentEstimate';

// Global max price cap - applies to ALL tabs
const GLOBAL_MAX_PRICE = 300000;

// Quick filter presets for investors (all within $300K cap)
const QUICK_FILTERS = {
  ownerFinance: { label: 'Owner Finance', icon: '🏠', sortBy: 'percentOfArv' as SortField, sortOrder: 'asc' as const, ownerFinanceOnly: true },
  discountDeals: { label: 'Under 80% ARV', icon: '!', sortBy: 'percentOfArv' as SortField, sortOrder: 'asc' as const, maxArv: 80 },
  under100k: { label: 'Under $100K', icon: '<', sortBy: 'price' as SortField, sortOrder: 'asc' as const, maxPrice: 100000 },
  midRange: { label: '$100K-$200K', icon: '~', sortBy: 'price' as SortField, sortOrder: 'asc' as const, minPrice: 100000, maxPrice: 200000 },
  highEnd: { label: '$200K-$300K', icon: '+', sortBy: 'price' as SortField, sortOrder: 'asc' as const, minPrice: 200000, maxPrice: 300000 },
  allDeals: { label: 'All Deals', icon: '*', sortBy: 'price' as SortField, sortOrder: 'asc' as const },
};

type QuickFilterKey = keyof typeof QUICK_FILTERS;

export default function CashDealsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [allDeals, setAllDeals] = useState<CashDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Location filters (server-side) - initialize from URL
  const [addressSearch, setAddressSearch] = useState(searchParams.get('address') || '');
  const [citySearch, setCitySearch] = useState(searchParams.get('city') || '');
  const [stateFilter, setStateFilter] = useState(searchParams.get('state') || '');
  const [radius, setRadius] = useState(parseInt(searchParams.get('radius') || '0'));

  // Sort controls
  const [sortBy, setSortBy] = useState<SortField>((searchParams.get('sortBy') as SortField) || 'price');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc');

  // Advanced filters (client-side for instant filtering)
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [maxArv, setMaxArv] = useState<number | ''>('');
  const [ownerFinanceOnly, setOwnerFinanceOnly] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilterKey>('ownerFinance');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Bulk selection for delete
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [sendingToGHL, setSendingToGHL] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Update URL when filters change
  const updateURL = (updates: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== '' && value !== 0) {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Export filtered deals to CSV
  const exportFilteredDeals = () => {
    if (filteredDeals.length === 0) {
      alert('No deals to export');
      return;
    }

    setExporting(true);
    try {
      // CSV headers
      const headers = [
        'Address',
        'City',
        'State',
        'Zip',
        'Price',
        'ARV (Zestimate)',
        '% ARV',
        'Discount %',
        'Beds',
        'Baths',
        'SqFt',
        'Rent Estimate',
        'Down Payment',
        'Monthly Expenses',
        'Owner Finance',
        'Sent to GHL',
        'Zillow URL'
      ];

      // CSV rows
      const rows = filteredDeals.map(deal => [
        deal.address,
        deal.city,
        deal.state,
        deal.zipcode,
        deal.price,
        deal.arv,
        deal.percentOfArv,
        deal.discount,
        deal.beds,
        deal.baths,
        deal.sqft,
        deal.rentEstimate || '',
        deal.downPaymentAmount || '',
        '',
        deal.ownerFinanceVerified ? 'Yes' : 'No',
        deal.sentToGHL ? new Date(deal.sentToGHL).toLocaleDateString() : '',
        deal.url
      ]);

      // Build CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          // Escape commas and quotes in cell values
          const cellStr = String(cell ?? '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename with current filter info
      const filterInfo = activeQuickFilter !== 'allDeals' ? `-${activeQuickFilter}` : '';
      const locationInfo = citySearch ? `-${citySearch.replace(/\s+/g, '_')}` : '';
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `cash-deals${filterInfo}${locationInfo}-${dateStr}.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export deals');
    } finally {
      setExporting(false);
    }
  };

  // Send selected deals to GHL
  const handleSendToGHL = async () => {
    if (selectedDeals.size === 0) return;

    // Check how many selected deals are already sent to GHL
    const alreadySentCount = filteredDeals.filter(
      d => selectedDeals.has(d.id) && d.sentToGHL
    ).length;

    let confirmMessage = `Send ${selectedDeals.size} deals to GHL?`;
    if (alreadySentCount > 0) {
      confirmMessage += `\n\n⚠️ ${alreadySentCount} of these have already been sent and will be skipped.`;
    }

    if (!confirm(confirmMessage)) return;

    setSendingToGHL(true);
    try {
      const response = await fetch('/api/admin/cash-deals/send-to-ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealIds: Array.from(selectedDeals) }),
      });

      const result = await response.json();

      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        let message = `Successfully sent ${result.sent} deals to GHL`;
        if (result.skipped > 0) {
          message += `\n${result.skipped} skipped (already sent)`;
        }
        if (result.failed > 0) {
          message += `\n${result.failed} failed`;
        }
        alert(message);
        setSelectedDeals(new Set());
        fetchDeals(); // Refresh to show GHL status
      }
    } catch (error) {
      alert('Failed to send deals to GHL');
      console.error('Send to GHL error:', error);
    } finally {
      setSendingToGHL(false);
    }
  };

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
      params.set('limit', '2000'); // Fetch all for client-side filtering

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
    // Update URL when server-side filters change
    updateURL({ city: citySearch, state: stateFilter, radius });
  }, [stateFilter, citySearch, radius]);

  // Apply default Owner Finance filter on mount
  useEffect(() => {
    applyQuickFilter('ownerFinance');
  }, []);

  // Apply quick filter preset
  const applyQuickFilter = (key: QuickFilterKey) => {
    const filter = QUICK_FILTERS[key];
    setActiveQuickFilter(key);
    setSortBy(filter.sortBy);
    setSortOrder(filter.sortOrder);

    // Clear all advanced filters first
    setMinPrice('');
    setMaxPrice('');
    setMaxArv('');
    setOwnerFinanceOnly(false);

    // Apply preset filters
    if ('maxArv' in filter) setMaxArv(filter.maxArv!);
    if ('minPrice' in filter) setMinPrice(filter.minPrice!);
    if ('maxPrice' in filter) setMaxPrice(filter.maxPrice!);
    if ('ownerFinanceOnly' in filter) setOwnerFinanceOnly(filter.ownerFinanceOnly!);
  };

  // Client-side filtered and sorted deals
  const filteredDeals = useMemo(() => {
    let result = [...allDeals];

    // GLOBAL: Always filter out properties over $300K
    result = result.filter(d => d.price <= GLOBAL_MAX_PRICE);

    // Address search filter (client-side for instant feedback)
    if (addressSearch.trim()) {
      const searchTerm = addressSearch.toLowerCase();
      result = result.filter(d =>
        d.address?.toLowerCase().includes(searchTerm)
      );
    }

    // Owner Finance filter
    if (ownerFinanceOnly) result = result.filter(d => d.ownerFinanceVerified === true);

    // Apply client-side filters
    if (minPrice !== '') result = result.filter(d => d.price >= minPrice);
    if (maxPrice !== '') result = result.filter(d => d.price <= maxPrice);
    if (maxArv !== '') result = result.filter(d => d.percentOfArv <= maxArv);

    // Sort
    result.sort((a, b) => {
      const aVal = (a as any)[sortBy] ?? (sortOrder === 'asc' ? Infinity : -Infinity);
      const bVal = (b as any)[sortBy] ?? (sortOrder === 'asc' ? Infinity : -Infinity);
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [allDeals, addressSearch, minPrice, maxPrice, maxArv, ownerFinanceOnly, sortBy, sortOrder]);

  // Stats for filtered deals
  const stats = useMemo(() => {
    const avgDiscount = filteredDeals.length > 0
      ? filteredDeals.reduce((sum, d) => sum + (d.discount || 0), 0) / filteredDeals.length
      : 0;
    const avgPrice = filteredDeals.length > 0
      ? filteredDeals.reduce((sum, d) => sum + (d.price || 0), 0) / filteredDeals.length
      : 0;

    return { total: filteredDeals.length, avgDiscount, avgPrice };
  }, [filteredDeals]);

  const handleSort = (field: SortField) => {
    setActiveQuickFilter('allDeals'); // Clear quick filter when manually sorting
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      const descFields = ['discount', 'rentEstimate'];
      setSortOrder(descFields.includes(field) ? 'desc' : 'asc');
    }
  };

  const clearAllFilters = () => {
    setAddressSearch('');
    setCitySearch('');
    setStateFilter('');
    setRadius(0);
    setMinPrice('');
    setMaxPrice('');
    setMaxArv('');
    setOwnerFinanceOnly(false);
    setActiveQuickFilter('allDeals');
    setSortBy('price');
    setSortOrder('asc');
    router.replace(pathname, { scroll: false });
  };

  // Bulk delete selected deals
  const deleteSelectedDeals = async () => {
    if (selectedDeals.size === 0) return;
    if (!confirm(`Delete ${selectedDeals.size} propert${selectedDeals.size === 1 ? 'y' : 'ies'}? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/admin/cash-deals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedDeals) }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        // Remove deleted deals from local state
        setAllDeals(prev => prev.filter(d => !selectedDeals.has(d.id)));
        setSelectedDeals(new Set());
        alert(`Deleted ${data.deleted} propert${data.deleted === 1 ? 'y' : 'ies'} successfully!`);
      }
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
    setDeleting(false);
  };

  // Toggle selection for a deal
  const toggleSelection = (id: string) => {
    setSelectedDeals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Select/deselect all visible deals
  const toggleSelectAll = () => {
    if (selectedDeals.size === filteredDeals.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(filteredDeals.map(d => d.id)));
    }
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
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">Cash Deals Finder</h1>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-600/30">
                  Under $300K
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <button
                onClick={exportFilteredDeals}
                disabled={exporting || filteredDeals.length === 0}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title={`Export ${stats.total} deals to CSV`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
              <div className="flex gap-6 text-right">
                <div>
                  <div className="text-2xl font-bold text-emerald-400">{stats.total}</div>
                  <div className="text-xs text-slate-400">Matches</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">${Math.round(stats.avgDiscount / 1000)}K</div>
                  <div className="text-xs text-slate-400">Avg Discount</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">${Math.round(stats.avgPrice / 1000)}K</div>
                  <div className="text-xs text-slate-400">Avg Price</div>
                </div>
              </div>
            </div>
          </div>

          {/* Location Search Bar */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 mb-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-slate-400 mb-1">Address</label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={addressSearch}
                    onChange={(e) => {
                      setAddressSearch(e.target.value);
                      updateURL({ address: e.target.value });
                    }}
                    placeholder="Search by address..."
                    className="bg-slate-700 border border-slate-600 rounded pl-9 pr-3 py-2 w-full text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="min-w-[130px]">
                <label className="block text-xs font-medium text-slate-400 mb-1">City</label>
                <input
                  type="text"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder="City name..."
                  className="bg-slate-700 border border-slate-600 rounded px-3 py-2 w-full text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="w-[100px]">
                <label className="block text-xs font-medium text-slate-400 mb-1">State</label>
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-2 w-full text-sm text-white focus:border-emerald-500"
                >
                  <option value="">All</option>
                  {states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div className="w-[120px]">
                <label className="block text-xs font-medium text-slate-400 mb-1">Radius (miles)</label>
                <select
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-2 w-full text-sm text-white focus:border-emerald-500"
                >
                  <option value="0">Exact city</option>
                  <option value="10">10 miles</option>
                  <option value="25">25 miles</option>
                  <option value="50">50 miles</option>
                  <option value="100">100 miles</option>
                </select>
              </div>
              {(addressSearch || citySearch || stateFilter || radius > 0) && (
                <button
                  onClick={() => {
                    setAddressSearch('');
                    setCitySearch('');
                    setStateFilter('');
                    setRadius(0);
                    router.replace(pathname, { scroll: false });
                  }}
                  className="px-3 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
            {citySearch && radius > 0 && (
              <p className="text-xs text-slate-400 mt-2">
                Searching within {radius} miles of "{citySearch}"
              </p>
            )}
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

          {/* Bulk Delete Bar */}
          {selectedDeals.size > 0 && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4 flex items-center justify-between">
              <span className="text-red-300 font-medium">
                {selectedDeals.size} propert{selectedDeals.size === 1 ? 'y' : 'ies'} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedDeals(new Set())}
                  className="px-3 py-1.5 text-sm text-slate-300 hover:text-white"
                >
                  Clear
                </button>
                <button
                  onClick={handleSendToGHL}
                  disabled={sendingToGHL}
                  className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-slate-600"
                >
                  {sendingToGHL ? 'Sending...' : `Send ${selectedDeals.size} to GHL`}
                </button>
                <button
                  onClick={deleteSelectedDeals}
                  disabled={deleting}
                  className="px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:bg-slate-600"
                >
                  {deleting ? 'Deleting...' : `Delete ${selectedDeals.size}`}
                </button>
              </div>
            </div>
          )}

          {/* Advanced Filters Panel */}
          {showAdvanced && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                      <th className="px-3 py-3 text-left text-slate-300 text-xs font-semibold w-10">
                        <input
                          type="checkbox"
                          checked={selectedDeals.size === filteredDeals.length && filteredDeals.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-slate-500 bg-slate-600 text-emerald-500 focus:ring-emerald-500"
                        />
                      </th>
                      <th className="px-3 py-3 text-left text-slate-300 text-xs font-semibold">Property</th>
                      <th className="px-3 py-3 text-left text-slate-300 text-xs font-semibold">Location</th>
                      <SortHeader field="price" label="Price" />
                      <SortHeader field="percentOfArv" label="% ARV" />
                      <SortHeader field="discount" label="Discount" />
                      <SortHeader field="rentEstimate" label="Rent" />
                      <th className="px-3 py-3 text-left text-slate-300 text-xs font-semibold">Specs</th>
                      <th className="px-3 py-3 text-left text-slate-300 text-xs font-semibold w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {filteredDeals.map((deal, idx) => {
                      const isTopDeal = deal.percentOfArv <= 70; // Great deal = 70% or less of ARV
                      const isSelected = selectedDeals.has(deal.id);
                      return (
                        <tr
                          key={deal.id}
                          className={`hover:bg-slate-700/50 ${isTopDeal ? 'bg-emerald-900/20' : ''} ${isSelected ? 'bg-red-900/20' : ''}`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection(deal.id)}
                              className="w-4 h-4 rounded border-slate-500 bg-slate-600 text-emerald-500 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-9 flex-shrink-0 rounded overflow-hidden bg-slate-700">
                                {deal.imgSrc ? (
                                  <img
                                    src={deal.imgSrc}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="flex items-center justify-center w-full h-full text-slate-500 text-xs">🏠</span>';
                                    }}
                                  />
                                ) : (
                                  <span className="flex items-center justify-center w-full h-full text-slate-500 text-xs">🏠</span>
                                )}
                              </div>
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
                                  {deal.sentToGHL && (
                                    <span
                                      className="inline-block px-1 py-0.5 text-[10px] font-semibold bg-green-600 text-white rounded"
                                      title={`Sent to GHL: ${new Date(deal.sentToGHL).toLocaleString()}`}
                                    >
                                      GHL
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
                              ARV: ${deal.arv?.toLocaleString() || '-'}
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
                            <span className={`font-bold text-lg ${
                              deal.discount >= 100000 ? 'text-green-400' :
                              deal.discount >= 50000 ? 'text-emerald-400' :
                              'text-yellow-400'
                            }`}>
                              ${(deal.discount / 1000).toFixed(0)}K
                            </span>
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
