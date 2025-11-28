'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

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
}

export default function UserCashDealsPage() {
  const { status } = useSession();
  const [deals, setDeals] = useState<CashDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Location filters
  const [citySearch, setCitySearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [states, setStates] = useState<string[]>([]);

  // Sort
  const [sortBy] = useState<'percentOfArv' | 'price' | 'discount'>('percentOfArv');
  const [sortOrder] = useState<'asc' | 'desc'>('asc');

  // Price range filters
  const [priceRange, setPriceRange] = useState<'all' | 'under100' | '100to200' | '200to300'>('all');

  const fetchDeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (citySearch) params.set('city', citySearch);
      if (stateFilter) params.set('state', stateFilter);

      const res = await fetch(`/api/buyer/cash-deals?${params}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setDeals([]);
      } else {
        setDeals(data.deals || []);
        // Extract unique states
        const uniqueStates = [...new Set(data.deals?.map((d: CashDeal) => d.state) || [])].sort();
        setStates(uniqueStates as string[]);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDeals();
    }
  }, [status, citySearch, stateFilter]);

  // Client-side filtering and sorting
  const filteredDeals = useMemo(() => {
    let result = [...deals];

    // Price range filter
    if (priceRange === 'under100') {
      result = result.filter(d => d.price < 100000);
    } else if (priceRange === '100to200') {
      result = result.filter(d => d.price >= 100000 && d.price < 200000);
    } else if (priceRange === '200to300') {
      result = result.filter(d => d.price >= 200000 && d.price <= 300000);
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [deals, priceRange, sortBy, sortOrder]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Sign In Required</h1>
          <Link href="/auth" className="text-emerald-400 hover:text-emerald-300">
            Sign in to view cash deals
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-slate-400 hover:text-white">
              ← Back
            </Link>
            <h1 className="text-lg font-bold text-white">Cash Deals</h1>
            <span className="text-xs bg-emerald-600/20 text-emerald-400 px-2 py-1 rounded-full border border-emerald-600/30">
              Under $300K • Under 80% ARV
            </span>
          </div>
          <div className="text-emerald-400 font-bold">
            {filteredDeals.length} deals
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Disclaimer */}
        <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3 mb-6">
          <p className="text-yellow-200/80 text-xs leading-relaxed">
            <span className="font-semibold">Disclaimer:</span> All ARV and property values shown are third-party estimates. We are not appraisers and do not know the actual value of these properties. Always conduct your own due diligence.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            {/* City Search */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-slate-400 mb-1">City</label>
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Enter city..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
              />
            </div>

            {/* State Filter */}
            <div className="w-24">
              <label className="block text-xs text-slate-400 mb-1">State</label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-sm text-white"
              >
                <option value="">All</option>
                {states.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            {/* Clear */}
            {(citySearch || stateFilter) && (
              <button
                onClick={() => { setCitySearch(''); setStateFilter(''); }}
                className="text-slate-400 hover:text-white text-sm"
              >
                Clear
              </button>
            )}
          </div>

          {/* Price Range Tabs */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { key: 'all', label: 'All Prices' },
              { key: 'under100', label: 'Under $100K' },
              { key: '100to200', label: '$100K-$200K' },
              { key: '200to300', label: '$200K-$300K' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPriceRange(key as any)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  priceRange === key
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto"></div>
            <p className="mt-4 text-slate-400">Loading deals...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-red-900/20 rounded-lg border border-red-700">
            <p className="text-red-400">{error}</p>
            <button onClick={fetchDeals} className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg">
              Retry
            </button>
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="text-center py-12 bg-slate-800 rounded-lg border border-slate-700">
            <div className="text-4xl mb-4">🏠</div>
            <p className="text-slate-400">No deals found matching your criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDeals.map((deal) => (
              <a
                key={deal.id}
                href={deal.url || `https://www.zillow.com/homes/${deal.address.replace(/\s+/g, '-')}_rb/`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-emerald-500/50 transition-all hover:shadow-xl hover:shadow-emerald-500/10"
              >
                {/* Image */}
                <div className="relative h-40">
                  {deal.imgSrc ? (
                    <img
                      src={deal.imgSrc}
                      alt={deal.address}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                      <span className="text-4xl">🏠</span>
                    </div>
                  )}
                  {/* Discount Badge */}
                  <div className="absolute top-2 left-2 bg-emerald-600 text-white px-2 py-1 rounded-lg text-sm font-bold">
                    {deal.percentOfArv}% of ARV
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  {/* Price Row */}
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-2xl font-bold text-white">
                      ${deal.price.toLocaleString()}
                    </div>
                    <div className="text-emerald-400 font-semibold text-sm">
                      ${deal.discount.toLocaleString()} below ARV
                    </div>
                  </div>

                  {/* Address */}
                  <div className="text-white font-medium mb-1 truncate">
                    {deal.address}
                  </div>
                  <div className="text-slate-400 text-sm mb-3">
                    {deal.city}, {deal.state} {deal.zipcode}
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">🛏️</span>
                      <span className="text-white font-medium">{deal.beds}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">🛁</span>
                      <span className="text-white font-medium">{deal.baths}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">📐</span>
                      <span className="text-white font-medium">{deal.sqft?.toLocaleString() || '—'} sqft</span>
                    </div>
                  </div>

                  {/* ARV Info */}
                  <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between text-sm">
                    <div>
                      <span className="text-slate-400">ARV: </span>
                      <span className="text-white font-medium">${deal.arv.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Equity: </span>
                      <span className="text-emerald-400 font-bold">{100 - deal.percentOfArv}%</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
