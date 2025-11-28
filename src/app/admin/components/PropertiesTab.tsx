'use client';

import Image from 'next/image';
import { Dispatch, SetStateAction, useState } from 'react';
import { useProperties, AdminProperty } from '../hooks/useProperties';
import { convertToDirectImageUrl } from '../lib/image-utils';

interface PropertiesTabProps {
  setEditingProperty: Dispatch<SetStateAction<AdminProperty | null>>;
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
    cityFilter,
    setCityFilter,
  } = useProperties();

  const [sendingToGHL, setSendingToGHL] = useState(false);

  // Send selected properties to GHL
  const handleSendToGHL = async () => {
    if (selectedProperties.length === 0) return;

    // Check how many selected properties are already sent to GHL
    const alreadySentCount = filteredProperties.filter(
      p => selectedProperties.includes(p.id) && (p as any).sentToGHL
    ).length;

    let confirmMessage = `Send ${selectedProperties.length} properties to GHL?`;
    if (alreadySentCount > 0) {
      confirmMessage += `\n\n⚠️ ${alreadySentCount} of these have already been sent and will be skipped.`;
    }

    if (!confirm(confirmMessage)) return;

    setSendingToGHL(true);
    try {
      const response = await fetch('/api/admin/properties/send-to-ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyIds: selectedProperties }),
      });

      const result = await response.json();

      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        let message = `Successfully sent ${result.sent} properties to GHL`;
        if (result.skipped > 0) {
          message += `\n${result.skipped} skipped (already sent to GHL)`;
        }
        if (result.failed > 0) {
          message += `\n${result.failed} failed`;
        }
        alert(message);
        setSelectedProperties([]);
        fetchProperties(undefined, false); // Refresh to show updated GHL status
      }
    } catch (error) {
      alert('Failed to send properties to GHL');
      console.error('Send to GHL error:', error);
    } finally {
      setSendingToGHL(false);
    }
  };

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
          <div className="flex-1 flex items-center space-x-3">
            <div className="relative flex-1 max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search address..."
                value={addressSearch}
                onChange={(e) => setAddressSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="relative max-w-xs">
              <input
                type="text"
                placeholder="Filter by city..."
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
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
              <>
                <button
                  onClick={handleSendToGHL}
                  disabled={sendingToGHL}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {sendingToGHL ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>Send {selectedProperties.length} to GHL</>
                  )}
                </button>
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
                  Delete {selectedProperties.length}
                </button>
              </>
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
              <th scope="col" className="hidden md:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('city')}>
                Location {sortField === 'city' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th scope="col" className="hidden lg:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('listPrice')}>
                Price {sortField === 'listPrice' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th scope="col" className="hidden lg:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 bg-green-50" onClick={() => handleSort('monthlyCashFlow' as any)}>
                Cash Flow {sortField === 'monthlyCashFlow' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 bg-green-50" onClick={() => handleSort('cocReturn' as any)}>
                CoC % {sortField === 'cocReturn' && (sortDirection === 'asc' ? '↑' : '↓')}
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
                <td className="px-2 md:px-3 py-4 whitespace-nowrap text-xs md:text-sm font-medium">
                  <div className="flex flex-col md:flex-row items-start md:items-center space-y-1 md:space-y-0 md:space-x-2">
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
                          imageUrl: property.imageUrl || property.imageUrls?.[0] || '',
                          imageUrls: property.imageUrls || (property.imageUrl ? [property.imageUrl] : [])
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
                      Del
                    </button>
                  </div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-16 w-20 md:h-20 md:w-28">
                      <Image
                        src={convertToDirectImageUrl(property.imageUrl || (property as any).imageUrls?.[0]) || '/placeholder-house.svg'}
                        alt={property.address}
                        width={112}
                        height={80}
                        className="h-16 w-20 md:h-20 md:w-28 rounded-lg object-cover"
                        loading="lazy"
                        quality={40}
                        sizes="(max-width: 768px) 80px, 112px"
                        priority={false}
                      />
                    </div>
                    <div className="ml-2">
                      <div className="flex items-center gap-1">
                        <div className="text-xs md:text-sm font-medium text-gray-900 truncate max-w-[200px] md:max-w-none">{property.address}</div>
                        {(property as any).sentToGHL && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 flex-shrink-0"
                            title={`Sent to GHL: ${new Date((property as any).sentToGHL).toLocaleString()}`}
                          >
                            GHL
                          </span>
                        )}
                        <button
                          onClick={() => {
                            const fullAddress = property.fullAddress || `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;
                            navigator.clipboard.writeText(fullAddress);
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                          title="Copy full address"
                        >
                          <svg className="h-3 w-3 md:h-4 md:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                      <div className="text-xs text-gray-500">{property.bedrooms} bed • {property.bathrooms} bath</div>
                      <div className="md:hidden text-xs text-gray-600 mt-1">{property.city}, {property.state}</div>
                      <div className="md:hidden text-xs font-medium text-gray-900 mt-0.5">${property.listPrice?.toLocaleString()}</div>
                    </div>
                  </div>
                </td>
                <td className="hidden md:table-cell px-3 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{property.city}, {property.state}</div>
                  <div className="text-sm text-gray-500">{property.zipCode}</div>
                </td>
                <td className="hidden lg:table-cell px-3 py-4 whitespace-nowrap">
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
                <td className="hidden lg:table-cell px-3 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{property.bedrooms} bed • {property.bathrooms} bath</div>
                  <div className="text-xs text-gray-500">
                    {property.squareFeet?.toLocaleString() || 'N/A'} sqft
                    {(property as any).yearBuilt && ` • ${(property as any).yearBuilt}`}
                  </div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap bg-green-50">
                  {(property as any).cashFlow ? (
                    <div>
                      <div className={`text-sm font-medium ${(property as any).cashFlow.monthlyCashFlow > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${(property as any).cashFlow.monthlyCashFlow?.toLocaleString()}/mo
                      </div>
                      <div className="text-xs text-gray-500">
                        ${(property as any).cashFlow.annualCashFlow?.toLocaleString()}/yr
                      </div>
                      {(property as any).cashFlow.usedEstimatedTax && (
                        <div className="text-xs text-orange-500" title="Tax estimated at 1.2% of price">
                          ~tax est
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs text-yellow-600">
                        {(property as any).missingFields?.length > 0
                          ? `Missing: ${(property as any).missingFields.join(', ')}`
                          : 'No data'}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-4 whitespace-nowrap bg-green-50">
                  {(property as any).cashFlow ? (
                    <div>
                      <div className={`text-sm font-bold ${
                        (property as any).cashFlow.cocReturn > 10 ? 'text-green-600' :
                        (property as any).cashFlow.cocReturn > 0 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {(property as any).cashFlow.cocReturn}%
                      </div>
                      {(property as any).cashFlow.usedEstimatedTax && (
                        <div className="text-xs text-orange-500">~</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
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
