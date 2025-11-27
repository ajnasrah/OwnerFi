'use client';

import { useState, useEffect } from 'react';
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
  status: string;
}

type SortField = 'percentOfArv' | 'price' | 'arv' | 'discount';

export default function CashDealsPage() {
  const [deals, setDeals] = useState<CashDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [citySearch, setCitySearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('percentOfArv');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchDeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (citySearch) params.set('city', citySearch);
      if (stateFilter) params.set('state', stateFilter);
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
      setSortOrder(field === 'discount' ? 'desc' : 'asc');
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === field && (
          <span className="text-blue-600">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Cash Deals</h1>
          <p className="text-gray-600">Properties under 70% of Zestimate (ARV)</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-600">{total}</div>
          <div className="text-sm text-gray-500">Total Deals</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search City
            </label>
            <input
              type="text"
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              placeholder="e.g. Austin"
              className="border rounded-lg px-3 py-2 w-48"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State
            </label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 w-32"
            >
              <option value="">All States</option>
              {states.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Search
          </button>

          {(citySearch || stateFilter) && (
            <button
              type="button"
              onClick={() => {
                setCitySearch('');
                setStateFilter('');
              }}
              className="text-gray-600 px-4 py-2 hover:text-gray-800"
            >
              Clear Filters
            </button>
          )}
        </form>
      </div>

      {/* Results Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading deals...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-red-50 rounded-lg shadow border border-red-200">
          <p className="text-red-600 font-medium">Error loading deals</p>
          <p className="text-red-500 text-sm mt-2">{error}</p>
          <button
            onClick={fetchDeals}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : deals.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-600">No cash deals found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">Property</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <SortHeader field="price" label="Asking Price" />
                  <SortHeader field="arv" label="ARV (Zestimate)" />
                  <SortHeader field="percentOfArv" label="% of ARV" />
                  <SortHeader field="discount" label="Discount" />
                  <th className="px-4 py-3 text-left">Details</th>
                  <th className="px-4 py-3 text-left">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {deal.imgSrc && (
                          <img
                            src={deal.imgSrc}
                            alt=""
                            className="w-16 h-12 object-cover rounded"
                          />
                        )}
                        <div className="text-sm font-medium truncate max-w-[200px]">
                          {deal.address}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{deal.city}</div>
                      <div className="text-xs text-gray-500">{deal.state} {deal.zipcode}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      ${deal.price?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      ${deal.arv?.toLocaleString()}
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
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">
                        {deal.discount}% off
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {deal.beds}bd / {deal.baths}ba
                      {deal.sqft > 0 && <span> / {deal.sqft.toLocaleString()} sqft</span>}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={deal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
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
  );
}
