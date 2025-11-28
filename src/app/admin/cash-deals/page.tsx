'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  // Owner finance terms (from seller)
  ownerFinanceVerified?: boolean;
  monthlyPayment?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  interestRate?: number;
  termYears?: number;
  balloonYears?: number;
}

type SortField = 'percentOfArv' | 'price' | 'arv' | 'discount' | 'monthlyCashFlow' | 'cocReturn';

export default function CashDealsPage() {
  const [deals, setDeals] = useState<CashDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [citySearch, setCitySearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [radius, setRadius] = useState(0); // 0 = no radius, otherwise miles
  const [sortBy, setSortBy] = useState<SortField>('percentOfArv');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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
      params.set('limit', '200');

      console.log('Fetching cash deals...');
      const res = await fetch(`/api/admin/cash-deals?${params}`);
      const data = await res.json();
      console.log('Cash deals response:', data);

      if (data.error) {
        setError(data.error);
        setDeals([]);
      } else {
        setDeals(data.deals || []);
        setTotal(data.total || 0);
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
  }, [stateFilter, sortBy, sortOrder]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDeals();
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      // Default sort order based on field
      const descFields = ['discount', 'monthlyCashFlow', 'cocReturn'];
      setSortOrder(descFields.includes(field) ? 'desc' : 'asc');
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-4 py-3 text-left cursor-pointer hover:bg-slate-600 select-none text-slate-300"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === field && (
          <span className="text-emerald-400">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div className="h-screen overflow-hidden bg-slate-900 flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <a href="/admin" className="text-emerald-400 hover:text-emerald-300 text-sm mb-2 inline-block">← Back to Admin</a>
          <h1 className="text-3xl font-bold text-white">Cash Deals</h1>
          <p className="text-slate-400">Properties under 70% of Zestimate (ARV)</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-400">{total}</div>
          <div className="text-sm text-slate-400">Total Deals</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Search City
            </label>
            <input
              type="text"
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              placeholder="e.g. Austin"
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 w-48 text-white placeholder-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              State
            </label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 w-32 text-white"
            >
              <option value="">All States</option>
              {states.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Radius
            </label>
            <select
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 w-32 text-white"
            >
              <option value="0">Exact City</option>
              <option value="15">15 miles</option>
              <option value="30">30 miles</option>
              <option value="50">50 miles</option>
              <option value="75">75 miles</option>
            </select>
          </div>

          <button
            type="submit"
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
          >
            Search
          </button>

          {(citySearch || stateFilter || radius > 0) && (
            <button
              type="button"
              onClick={() => {
                setCitySearch('');
                setStateFilter('');
                setRadius(0);
              }}
              className="text-slate-400 px-4 py-2 hover:text-white"
            >
              Clear Filters
            </button>
          )}
        </form>
      </div>

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
          <button
            onClick={fetchDeals}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : deals.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 rounded-lg border border-slate-700">
          <p className="text-slate-400">No cash deals found</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700 border-b border-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left text-slate-300">Property</th>
                  <th className="px-4 py-3 text-left text-slate-300">Location</th>
                  <SortHeader field="price" label="Price" />
                  <SortHeader field="percentOfArv" label="% ARV" />
                  <SortHeader field="monthlyCashFlow" label="Cash Flow" />
                  <SortHeader field="cocReturn" label="CoC %" />
                  <th className="px-4 py-3 text-left text-slate-300">Rent Est.</th>
                  <th className="px-4 py-3 text-left text-slate-300">Details</th>
                  <th className="px-4 py-3 text-left text-slate-300">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {deals.map((deal) => (
                  <tr key={deal.id} className={`hover:bg-slate-700/50 ${deal.missingFields?.length > 0 ? 'bg-yellow-900/20' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {deal.imgSrc && (
                          <img
                            src={deal.imgSrc}
                            alt=""
                            className="w-16 h-12 object-cover rounded"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium truncate max-w-[200px] text-white">
                            {deal.address}
                          </div>
                          {deal.ownerFinanceVerified && (
                            <span className="inline-block px-1.5 py-0.5 text-xs font-semibold bg-blue-900/50 text-blue-300 rounded">
                              Owner Finance
                            </span>
                          )}
                          {deal.missingFields?.length > 0 && (
                            <div className="text-xs text-yellow-400 flex items-center gap-1">
                              <span>Missing: {deal.missingFields.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">{deal.city}</div>
                      <div className="text-xs text-slate-400">{deal.state} {deal.zipcode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">${deal.price?.toLocaleString()}</div>
                      {deal.ownerFinanceVerified && deal.downPaymentAmount ? (
                        <div className="text-xs text-blue-400 font-medium">
                          OF: ${deal.downPaymentAmount?.toLocaleString()} down
                          {deal.monthlyPayment && ` / $${deal.monthlyPayment?.toLocaleString()}/mo`}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">
                          Down: ${deal.cashFlow?.downPayment?.toLocaleString() || '-'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${
                        deal.percentOfArv < 50 ? 'text-green-600' :
                        deal.percentOfArv < 60 ? 'text-yellow-600' :
                        'text-orange-600'
                      }`}>
                        {deal.percentOfArv}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {deal.cashFlow ? (
                        <div>
                          <span className={`font-bold ${
                            deal.cashFlow.monthlyCashFlow > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ${deal.cashFlow.monthlyCashFlow?.toLocaleString()}/mo
                          </span>
                          <div className="text-xs text-gray-500">
                            ${deal.cashFlow.annualCashFlow?.toLocaleString()}/yr
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {deal.cashFlow ? (
                        <span className={`font-bold ${
                          deal.cashFlow.cocReturn > 10 ? 'text-green-600' :
                          deal.cashFlow.cocReturn > 0 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {deal.cashFlow.cocReturn}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {deal.rentEstimate > 0 ? (
                        <div>
                          <div className="font-medium text-white">${deal.rentEstimate?.toLocaleString()}/mo</div>
                          {deal.monthlyHoa > 0 && (
                            <div className="text-xs text-slate-400">HOA: ${deal.monthlyHoa}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {deal.beds}bd / {deal.baths}ba
                      {deal.sqft > 0 && <div className="text-xs text-slate-400">{deal.sqft.toLocaleString()} sqft</div>}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={deal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 text-sm"
                      >
                        Zillow →
                      </a>
                    </td>
                  </tr>
                ))}
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
