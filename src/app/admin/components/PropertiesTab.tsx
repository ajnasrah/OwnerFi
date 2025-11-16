'use client';

import Image from 'next/image';
import { useProperties, AdminProperty } from '../hooks/useProperties';
import { convertToDirectImageUrl } from '../lib/image-utils';

interface PropertiesTabProps {
  setEditingProperty: (property: AdminProperty | null) => void;
  setEditForm: (form: Partial<AdminProperty>) => void;
}

export default function PropertiesTab({ setEditingProperty, setEditForm }: PropertiesTabProps) {
  const {
    loading,
    filteredProperties,
    paginatedProperties,
    totalPages,
    currentPage,
    itemsPerPage,
    addressSearch,
    selectedProperties,
    sortField,
    sortDirection,
    setAddressSearch,
    setCurrentPage,
    setSelectedProperties,
    handleSort,
    fetchProperties,
  } = useProperties();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading properties...</div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Search and Filter */}
      <div className="px-4 py-5 sm:p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by address or city..."
                value={addressSearch}
                onChange={(e) => setAddressSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-700">
              {filteredProperties.length} properties
            </span>
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/admin/properties/export');
                  if (!response.ok) {
                    throw new Error('Export failed');
                  }
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `properties_export_${new Date().toISOString().split('T')[0]}.xlsx`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } catch (error) {
                  alert('Failed to export properties');
                  console.error('Export error:', error);
                }
              }}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to Excel
            </button>
            {selectedProperties.length > 0 && (
              <button
                onClick={async () => {
                  if (confirm(`Delete ${selectedProperties.length} selected properties?`)) {
                    try {
                      // Delete each selected property
                      for (const propertyId of selectedProperties) {
                        await fetch(`/api/admin/properties/${propertyId}`, { method: 'DELETE' });
                      }
                      setSelectedProperties([]);
                      fetchProperties(undefined, false);
                      alert(`Successfully deleted ${selectedProperties.length} properties`);
                    } catch (error) {
                      alert('Failed to delete some properties');
                      console.error('Delete error:', error);
                    }
                  }
                }}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete {selectedProperties.length} Selected
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Properties Table */}
      <div className="overflow-x-auto w-full">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="relative px-3 py-3">
                <input
                  type="checkbox"
                  checked={paginatedProperties.length > 0 && paginatedProperties.every(p => selectedProperties.includes(p.id))}
                  onChange={() => {
                    const pageIds = paginatedProperties.map(p => p.id);
                    if (paginatedProperties.every(p => selectedProperties.includes(p.id))) {
                      setSelectedProperties(prev => prev.filter(id => !pageIds.includes(id)));
                    } else {
                      setSelectedProperties(prev => [...new Set([...prev, ...pageIds])]);
                    }
                  }}
                  className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Property
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('city')}>
                Location {sortField === 'city' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('listPrice')}>
                Price {sortField === 'listPrice' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('downPaymentAmount')}>
                Down Payment {sortField === 'downPaymentAmount' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('monthlyPayment')}>
                Monthly Payment {sortField === 'monthlyPayment' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedProperties.map((property) => (
              <tr key={property.id} className="hover:bg-gray-50">
                <td className="relative px-3 py-4">
                  <input
                    type="checkbox"
                    checked={selectedProperties.includes(property.id)}
                    onChange={() => {
                      if (selectedProperties.includes(property.id)) {
                        setSelectedProperties(prev => prev.filter(id => id !== property.id));
                      } else {
                        setSelectedProperties(prev => [...prev, property.id]);
                      }
                    }}
                    className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
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
                          monthlyPayment: property.monthlyPayment,
                          downPaymentAmount: property.downPaymentAmount,
                          interestRate: property.interestRate,
                          downPaymentPercent: property.downPaymentPercent,
                          termYears: (property as any).termYears,
                          balloonYears: (property as any).balloonYears,
                          imageUrl: property.imageUrl || (property as any).imageUrls?.[0] || '',
                          imageUrls: (property as any).imageUrls || (property.imageUrl ? [property.imageUrl] : [])
                        });
                      }}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('Delete this property?')) {
                          await fetch(`/api/admin/properties/${property.id}`, { method: 'DELETE' });
                          fetchProperties(undefined, false);
                        }
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-20 w-28">
                      <Image
                        src={convertToDirectImageUrl(property.imageUrl || (property as any).imageUrls?.[0]) || '/placeholder-house.svg'}
                        alt={property.address}
                        width={112}
                        height={80}
                        className="h-20 w-28 rounded-lg object-cover"
                        loading="lazy"
                        quality={40}
                        sizes="112px"
                        priority={false}
                      />
                    </div>
                    <div className="ml-2">
                      <div className="flex items-center gap-1">
                        <div className="text-sm font-medium text-gray-900">{property.address}</div>
                        <button
                          onClick={() => {
                            const fullAddress = `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;
                            navigator.clipboard.writeText(fullAddress);
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy full address"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                      <div className="text-xs text-gray-500">{property.bedrooms} bed • {property.bathrooms} bath • {property.squareFeet?.toLocaleString()} sqft</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{property.city}, {property.state}</div>
                  <div className="text-sm text-gray-500">{property.zipCode}</div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">${property.listPrice?.toLocaleString()}</div>
                  {(property as any).estimatedValue && (property as any).estimatedValue > 0 && (
                    <>
                      <div className="text-xs text-gray-500 mt-1">Estimate: ${((property as any).estimatedValue)?.toLocaleString()}</div>
                      <div className="text-xs font-medium mt-0.5" style={{
                        color: property.listPrice && (property as any).estimatedValue
                          ? (property.listPrice / (property as any).estimatedValue) <= 0.95
                            ? '#10b981' // green if price is 95% or less of estimate
                            : (property.listPrice / (property as any).estimatedValue) >= 1.05
                            ? '#ef4444' // red if price is 105% or more of estimate
                            : '#6b7280' // gray if within 5%
                          : '#6b7280'
                      }}>
                        {property.listPrice && (property as any).estimatedValue
                          ? `${((property.listPrice / (property as any).estimatedValue) * 100).toFixed(1)}% of estimate`
                          : ''}
                      </div>
                    </>
                  )}
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">${property.downPaymentAmount?.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">{property.downPaymentPercent ? `${Math.round(property.downPaymentPercent)}%` : ''}</div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">${property.monthlyPayment?.toLocaleString()}/mo</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredProperties.length)}</span> of{' '}
                <span className="font-medium">{filteredProperties.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>

                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === page
                          ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
