'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BuyerAdminView } from '@/lib/view-models';
import { CityRadiusSearch } from '@/components/admin/CityRadiusSearch';

interface CityCoordinates {
  lat: number;
  lng: number;
  city: string;
  state: string;
  formattedAddress: string;
}

export default function AdminBuyers() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [buyers, setBuyers] = useState<BuyerAdminView[]>([]);
  const [selectedBuyers, setSelectedBuyers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBuyers, setTotalBuyers] = useState(0);

  // Search state
  const [searchCity, setSearchCity] = useState<CityCoordinates | null>(null);
  const [searchRadius, setSearchRadius] = useState(30);
  const [searchState, setSearchState] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || (session?.user as any)?.role !== 'admin') {
      router.push('/');
    } else {
      loadBuyers();
    }
  }, [status, session, router]);

  const loadBuyers = async (page = 1) => {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams({
        page: page.toString(),
      });

      // Add location filter if searching by city
      if (searchCity) {
        params.append('lat', searchCity.lat.toString());
        params.append('lng', searchCity.lng.toString());
        params.append('radius', searchRadius.toString());
      }

      // Add state filter if searching by state
      if (searchState) {
        params.append('state', searchState);
      }

      const response = await fetch(`/api/admin/buyers?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setBuyers(data.buyers || []);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(data.currentPage || 1);
        setTotalBuyers(data.total || 0);
      }
    } catch (error) {
      console.error('Error loading buyers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reload buyers when search filters or page changes
  useEffect(() => {
    if (status === 'authenticated') {
      loadBuyers(currentPage);
    }
  }, [searchCity, searchRadius, searchState, currentPage]);

  // Reset to page 1 when search filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedBuyers(new Set());
    setSelectAll(false);
  }, [searchCity, searchRadius, searchState]);

  const toggleSelectBuyer = (buyerId: string) => {
    const newSelected = new Set(selectedBuyers);
    if (newSelected.has(buyerId)) {
      newSelected.delete(buyerId);
    } else {
      newSelected.add(buyerId);
    }
    setSelectedBuyers(newSelected);
    setSelectAll(newSelected.size === buyers.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedBuyers(new Set());
      setSelectAll(false);
    } else {
      // Select only buyers on current page
      const allBuyerIds = new Set(buyers.map(b => b.id));
      setSelectedBuyers(allBuyerIds);
      setSelectAll(true);
    }
  };

  const handleSearch = (
    cityData: CityCoordinates | null,
    radius: number,
    state: string | null
  ) => {
    setSearchCity(cityData);
    setSearchRadius(radius);
    setSearchState(state);
    setCurrentPage(1); // Reset to first page
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    setSelectedBuyers(new Set());
    setSelectAll(false);
  };

  const deleteBuyers = async () => {
    if (selectedBuyers.size === 0) return;

    const confirmMsg = `Are you sure you want to delete ${selectedBuyers.size} buyer(s)? This action cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    setDeleting(true);
    try {
      const response = await fetch('/api/admin/buyers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerIds: Array.from(selectedBuyers) })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully deleted ${result.deletedCount} buyer(s)`);
        setSelectedBuyers(new Set());
        setSelectAll(false);
        loadBuyers(currentPage);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting buyers:', error);
      alert('Failed to delete buyers');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="text-center text-white">Loading buyers...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8 relative isolate">
      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="text-emerald-400 hover:text-emerald-300 mb-4 inline-block">
            ← Back to Admin Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Manage Buyers</h1>
          <p className="text-slate-400">
            Total: {totalBuyers} buyer{totalBuyers !== 1 ? 's' : ''} | Page {currentPage} of {totalPages}
          </p>
        </div>

        {/* Search Component */}
        <CityRadiusSearch onSearch={handleSearch} className="mb-6" />

        {/* Actions Bar */}
        <div className="bg-slate-800 rounded-lg p-5 mb-6 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-3 text-white cursor-pointer hover:text-emerald-400 transition-colors">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="font-medium">Select All ({buyers.length})</span>
            </label>
            {selectedBuyers.size > 0 && (
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-semibold text-sm">
                {selectedBuyers.size} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadBuyers(currentPage)}
              className="px-4 py-2 rounded-lg font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-all hover:scale-105 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={deleteBuyers}
              disabled={selectedBuyers.size === 0 || deleting}
              className={`px-5 py-2 rounded-lg font-semibold transition-all ${
                selectedBuyers.size > 0
                  ? 'bg-red-600 hover:bg-red-700 text-white hover:scale-105 shadow-lg'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              {deleting ? 'Deleting...' : `Delete Selected (${selectedBuyers.size})`}
            </button>
          </div>
        </div>

        {/* Buyers Table */}
        <div className="bg-slate-800 rounded-lg overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-700 to-slate-600 text-white">
                <tr>
                  <th className="p-4 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="w-5 h-5 rounded border-slate-500 bg-slate-600 text-emerald-500 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-4 text-left font-semibold uppercase text-xs tracking-wider">Name</th>
                  <th className="p-4 text-left font-semibold uppercase text-xs tracking-wider">Email</th>
                  <th className="p-4 text-left font-semibold uppercase text-xs tracking-wider">Phone</th>
                  <th className="p-4 text-left font-semibold uppercase text-xs tracking-wider">Location</th>
                  <th className="p-4 text-left font-semibold uppercase text-xs tracking-wider">Monthly</th>
                  <th className="p-4 text-left font-semibold uppercase text-xs tracking-wider">Down Pay</th>
                  <th className="p-4 text-center font-semibold uppercase text-xs tracking-wider">Matched</th>
                  <th className="p-4 text-center font-semibold uppercase text-xs tracking-wider">Liked</th>
                  <th className="p-4 text-left font-semibold uppercase text-xs tracking-wider">Joined</th>
                  <th className="p-4 text-left font-semibold uppercase text-xs tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {buyers.map((buyer) => (
                  <tr key={buyer.id} className="hover:bg-slate-700/50 transition-all duration-150 hover:shadow-md">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedBuyers.has(buyer.id)}
                        onChange={() => toggleSelectBuyer(buyer.id)}
                        className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-4">
                      <div className="text-white font-medium">
                        {buyer.firstName || buyer.lastName
                          ? `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim()
                          : 'N/A'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-slate-300 text-sm">{buyer.email}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-slate-300 text-sm">{buyer.phone || 'N/A'}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-slate-300 text-sm">
                        {(buyer.preferredCity || buyer.city) && (buyer.preferredState || buyer.state)
                          ? `${buyer.preferredCity || buyer.city}, ${buyer.preferredState || buyer.state}`
                          : 'N/A'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-slate-300 text-sm font-medium">
                        {buyer.maxMonthlyPayment
                          ? `$${buyer.maxMonthlyPayment.toLocaleString()}/mo`
                          : 'N/A'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-emerald-400 font-semibold">
                        {buyer.maxDownPayment
                          ? `$${buyer.maxDownPayment.toLocaleString()}`
                          : '$0'}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-full font-semibold text-sm min-w-[3rem]">
                        {buyer.matchedPropertiesCount || 0}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center bg-pink-500/20 text-pink-400 px-3 py-1.5 rounded-full font-semibold text-sm min-w-[3rem]">
                        ❤️ {buyer.likedPropertiesCount || 0}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-slate-300 text-sm">
                        {buyer.createdAt && typeof buyer.createdAt === 'object' && 'toDate' in buyer.createdAt
                          ? new Date((buyer.createdAt as any).toDate()).toLocaleDateString()
                          : buyer.createdAt
                          ? new Date(buyer.createdAt as any).toLocaleDateString()
                          : 'N/A'}
                      </div>
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/admin/buyers/preview/${buyer.id}`}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold text-sm transition-colors hover:underline"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Preview
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {buyers.length === 0 && (
              <div className="p-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-16 h-16 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <div className="text-slate-400 text-lg font-medium">
                    {searchCity || searchState ? 'No buyers found matching your search criteria' : 'No buyers registered yet'}
                  </div>
                  <div className="text-slate-500 text-sm">
                    {searchCity || searchState ? 'Try adjusting your search filters' : 'Buyers will appear here once they register'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between bg-slate-800 rounded-lg p-5 shadow-lg">
            <div className="text-slate-300 font-medium">
              Showing <span className="text-emerald-400 font-semibold">{((currentPage - 1) * 50) + 1}</span> to <span className="text-emerald-400 font-semibold">{Math.min(currentPage * 50, totalBuyers)}</span> of <span className="text-emerald-400 font-semibold">{totalBuyers}</span> buyers
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-5 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  currentPage === 1
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-105 shadow-md'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <div className="flex gap-1.5">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all min-w-[2.5rem] ${
                        currentPage === pageNum
                          ? 'bg-emerald-500 text-white shadow-md scale-105'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:scale-105'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-5 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  currentPage === totalPages
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-105 shadow-md'
                }`}
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}