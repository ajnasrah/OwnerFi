'use client';

import Image from 'next/image';
import { Dispatch, SetStateAction, useState } from 'react';
import { usePropertySearch, AdminProperty } from '../hooks/usePropertySearch';
import { convertToDirectImageUrl } from '../lib/image-utils';

interface PropertySearchTabProps {
  setEditingProperty: Dispatch<SetStateAction<AdminProperty | null>>;
  setEditForm: (form: Partial<AdminProperty>) => void;
}

// Smart pagination: 1 ... 4 5 [6] 7 8 ... 13
function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [];
  pages.push(1);
  if (current > 3) pages.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest' },
  { value: 'createdAt:asc', label: 'Oldest' },
  { value: 'listPrice:asc', label: 'Price: Low-High' },
  { value: 'listPrice:desc', label: 'Price: High-Low' },
];

export default function PropertySearchTab({ setEditingProperty, setEditForm }: PropertySearchTabProps) {
  const {
    query, setQuery, loading,
    properties, total, totalPages, facets, searchTime,
    page, setPage, itemsPerPage,
    sort, setSort,
    filters, filtersOpen, setFiltersOpen, updateFilter, clearFilters, hasActiveFilters,
    selectedIds, setSelectedIds,
    refetch,
  } = usePropertySearch();

  const [sendingToGHL, setSendingToGHL] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Bulk actions
  const handleSendToGHL = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Send ${selectedIds.length} properties to GHL?`)) return;
    setSendingToGHL(true);
    try {
      const res = await fetch('/api/admin/properties/send-to-ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyIds: selectedIds }),
      });
      const result = await res.json();
      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        let msg = `Sent ${result.sent} properties to GHL`;
        if (result.skipped > 0) msg += ` (${result.skipped} skipped)`;
        if (result.failed > 0) msg += ` (${result.failed} failed)`;
        alert(msg);
        setSelectedIds([]);
        refetch();
      }
    } catch {
      alert('Failed to send to GHL');
    } finally {
      setSendingToGHL(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} properties? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const res = await fetch('/api/admin/properties/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const result = await res.json();
      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        alert(`Deleted ${result.deleted} properties`);
        setSelectedIds([]);
        refetch();
      }
    } catch {
      alert('Failed to delete properties');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/admin/properties/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `properties_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert('Failed to export properties');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this property?')) return;
    await fetch(`/api/admin/properties/${id}`, { method: 'DELETE' });
    refetch();
  };

  const handleEdit = (property: AdminProperty) => {
    setEditingProperty(property);
    setEditForm({
      address: property.address,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      squareFeet: property.squareFeet,
      listPrice: property.listPrice,
      imageUrl: property.imageUrl || property.imageUrls?.[0] || '',
      imageUrls: property.imageUrls || (property.imageUrl ? [property.imageUrl] : []),
    });
  };

  // Selection helpers
  const allOnPageSelected = properties.length > 0 && properties.every(p => selectedIds.includes(p.id));
  const togglePageSelection = () => {
    const pageIds = properties.map(p => p.id);
    if (allOnPageSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    }
  };
  const toggleOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Facet-derived state lists
  const stateOptions = (facets.state || []).sort((a, b) => a.value.localeCompare(b.value));
  const dealTypeOptions = facets.dealType || [];

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Search Bar + Filters Toggle */}
      <div className="px-4 py-4 sm:px-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by address, city, state, zip..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
              hasActiveFilters
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="ml-0.5 inline-flex items-center justify-center w-2 h-2 rounded-full bg-indigo-500" />
            )}
            <svg className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Collapsible Filters Panel */}
        {filtersOpen && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[120px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
                <select
                  value={filters.state}
                  onChange={(e) => updateFilter('state', e.target.value)}
                  className="block w-full px-2 py-1.5 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">All States</option>
                  {stateOptions.map(s => (
                    <option key={s.value} value={s.value}>{s.value} ({s.count})</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[140px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Deal Type</label>
                <select
                  value={filters.dealType}
                  onChange={(e) => updateFilter('dealType', e.target.value)}
                  className="block w-full px-2 py-1.5 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">All Types</option>
                  {dealTypeOptions.map(d => (
                    <option key={d.value} value={d.value}>{d.value.replace(/_/g, ' ')} ({d.count})</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[100px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Min Price</label>
                <input
                  type="number"
                  placeholder="$0"
                  value={filters.minPrice}
                  onChange={(e) => updateFilter('minPrice', e.target.value)}
                  className="block w-full px-2 py-1.5 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="min-w-[100px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Max Price</label>
                <input
                  type="number"
                  placeholder="Any"
                  value={filters.maxPrice}
                  onChange={(e) => updateFilter('maxPrice', e.target.value)}
                  className="block w-full px-2 py-1.5 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="min-w-[80px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Min Beds</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Any"
                  value={filters.minBeds}
                  onChange={(e) => updateFilter('minBeds', e.target.value)}
                  className="block w-full px-2 py-1.5 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results Bar */}
      <div className="px-4 py-2.5 sm:px-6 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {loading ? (
              'Searching...'
            ) : (
              <><span className="font-medium">{total.toLocaleString()}</span> properties{searchTime > 0 && <span className="text-gray-400 ml-1">({searchTime}ms)</span>}</>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1 px-2.5 py-1 border border-gray-300 text-sm rounded-md text-gray-600 bg-white hover:bg-gray-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="px-4 py-2 sm:px-6 border-b border-indigo-100 bg-indigo-50 flex items-center gap-3">
          <span className="text-sm font-medium text-indigo-700">{selectedIds.length} selected</span>
          <button
            onClick={handleSendToGHL}
            disabled={sendingToGHL}
            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {sendingToGHL ? 'Sending...' : 'Send to GHL'}
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {bulkDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="text-xs text-indigo-500 hover:text-indigo-700"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={togglePageSelection}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Property
              </th>
              <th scope="col" className="hidden md:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th scope="col" className="hidden lg:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {properties.map((property) => (
              <tr key={property.id} className="hover:bg-gray-50">
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(property.id)}
                    onChange={() => toggleOne(property.id)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-12 w-16 md:h-14 md:w-20">
                      <Image
                        src={convertToDirectImageUrl(property.imageUrl || property.imageUrls?.[0]) || '/placeholder-house.svg'}
                        alt={property.address}
                        width={80}
                        height={56}
                        className="h-12 w-16 md:h-14 md:w-20 rounded-md object-cover"
                        loading="lazy"
                        quality={40}
                        sizes="(max-width: 768px) 64px, 80px"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[250px]">{property.address}</span>
                        <button
                          onClick={() => {
                            const full = property.fullAddress || `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;
                            navigator.clipboard.writeText(full);
                          }}
                          className="text-gray-300 hover:text-gray-500 flex-shrink-0"
                          title="Copy address"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                      <div className="text-xs text-gray-500">{property.city}, {property.state} {property.zipCode}</div>
                      {/* Mobile-only price + details */}
                      <div className="md:hidden mt-1 flex items-center gap-2 text-xs">
                        <span className="font-medium text-gray-900">${property.listPrice?.toLocaleString()}</span>
                        <span className="text-gray-400">{property.bedrooms}bd/{property.bathrooms}ba</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden md:table-cell px-3 py-3">
                  <div className="text-sm font-medium text-gray-900">${property.listPrice?.toLocaleString()}</div>
                  {property.estimatedValue && property.estimatedValue > 0 && property.listPrice && (
                    <div className="text-xs mt-0.5" style={{
                      color: (property.listPrice / property.estimatedValue) <= 0.8 ? '#10b981'
                        : (property.listPrice / property.estimatedValue) >= 1.0 ? '#ef4444'
                        : '#6b7280'
                    }}>
                      {((property.listPrice / property.estimatedValue) * 100).toFixed(0)}% of ${(property.estimatedValue / 1000).toFixed(0)}K est
                    </div>
                  )}
                </td>
                <td className="hidden lg:table-cell px-3 py-3">
                  <div className="text-sm text-gray-900">{property.bedrooms} bd / {property.bathrooms} ba</div>
                  <div className="text-xs text-gray-500">
                    {property.squareFeet?.toLocaleString() || '—'} sqft
                    {property.yearBuilt ? ` / ${property.yearBuilt}` : ''}
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {property.agentPhone && (
                      <a
                        href={`sms:${property.agentPhone}?body=${encodeURIComponent(`Hi, I'm interested in the property at ${property.address}, ${property.city}, ${property.state} ${property.zipCode} listed at $${property.listPrice?.toLocaleString()}. Is it still available?`)}`}
                        className="text-xs text-green-600 hover:text-green-800"
                        title={`Text ${property.agentName || 'agent'}`}
                      >
                        Text
                      </a>
                    )}
                    <button
                      onClick={() => handleEdit(property)}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(property.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Del
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && properties.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">
                  {query || hasActiveFilters ? 'No properties match your search.' : 'No properties found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 sm:px-6 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {((page - 1) * itemsPerPage) + 1}–{Math.min(page * itemsPerPage, total)} of {total.toLocaleString()}
          </div>
          <nav className="inline-flex items-center gap-1">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-2 py-1 rounded text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            {getPageNumbers(page, totalPages).map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`e${i}`} className="px-1 text-gray-400 text-sm">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-2.5 py-1 rounded text-sm font-medium ${
                    page === p
                      ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-2 py-1 rounded text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
