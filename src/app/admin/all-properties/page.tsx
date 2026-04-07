'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExtendedSession } from '@/types/session';
import Link from 'next/link';
import Image from 'next/image';

// ─── Types ───

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  listPrice: number;
  zestimate?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  homeType?: string;
  imgSrc?: string;
  galleryImages?: string[];
  zpid?: string;
  dealTypes?: string[];
  dealType?: string;
  isLand?: boolean;
  status?: string;
  daysOnMarket?: number;
  monthlyPayment?: number;
  percentOfArv?: number;
  description?: string;
  createdAt?: number;
}

interface SearchResult {
  properties: Property[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Component ───

export default function AllPropertiesPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState(''); // The query actually being searched
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('listPrice:asc');
  const [dealTypeFilter, setDealTypeFilter] = useState('');
  const PAGE_SIZE = 24;

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/auth');
    if (authStatus === 'authenticated' && (session as unknown as ExtendedSession)?.user?.role !== 'admin') router.replace('/');
  }, [authStatus, session, router]);

  const search = useCallback(async (searchQuery: string, searchPage: number, _sort: string, dealType?: string) => {
    setLoading(true);
    try {
      // Use /api/search/properties for full Typesense search with deal type filtering
      const params = new URLSearchParams({
        page: String(searchPage),
        limit: String(PAGE_SIZE),
        sort: _sort,
      });
      if (searchQuery) params.set('q', searchQuery);
      if (dealType) params.set('dealType', dealType);

      const res = await fetch(`/api/search/properties?${params}`);
      if (res.ok) {
        const data = await res.json();
        // Normalize field names from search API to our Property interface
        const normalized = (data.properties || []).map((p: any) => ({
          ...p,
          address: p.address || p.streetAddress || p.fullAddress || '',
          imgSrc: p.primaryImage || p.imageUrl || p.firstPropertyImage || p.zillowImageUrl || '',
          galleryImages: p.galleryImages || p.imageUrls || p.propertyImages || [],
          sqft: p.squareFeet || p.squareFoot || 0,
          beds: p.bedrooms || 0,
          baths: p.bathrooms || 0,
          listPrice: p.listPrice || p.price || 0,
          zestimate: p.zestimate || p.estimatedValue || 0,
          dealTypes: p.dealTypes || (p.dealType ? [p.dealType] : []),
          dealType: p.dealType || '',
          zpid: p.zpid || '',
          homeType: p.propertyType || p.homeType || '',
          monthlyPayment: p.monthlyPayment || 0,
          percentOfArv: p.percentOfArv || (p.listPrice && p.zestimate && p.zestimate > 0 ? Math.round((p.listPrice / p.zestimate) * 100) : null),
        }));
        setResults({
          properties: normalized,
          total: data.total || 0,
          page: data.page || searchPage,
          totalPages: Math.ceil((data.total || 0) / PAGE_SIZE),
        });
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load — show all properties
  useEffect(() => {
    if (authStatus === 'authenticated' && (session as unknown as ExtendedSession)?.user?.role === 'admin') {
      search('', 1, sortBy, dealTypeFilter);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, session]);

  // Submit search — only fires on Enter or button click
  const handleSearchSubmit = () => {
    setActiveQuery(query);
    setPage(1);
    search(query, 1, sortBy, dealTypeFilter);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    search(activeQuery, newPage, sortBy, dealTypeFilter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    setPage(1);
    search(activeQuery, 1, newSort, dealTypeFilter);
  };

  const handleDealTypeChange = (newType: string) => {
    setDealTypeFilter(newType);
    setPage(1);
    search(activeQuery, 1, sortBy, newType);
  };

  if (authStatus !== 'authenticated' || (session as unknown as ExtendedSession)?.user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#111625] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00BC7D]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111625]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <Link href="/admin" className="text-[#00BC7D] hover:text-[#00d68f] mb-4 inline-flex items-center gap-1 text-sm">
          ← Back to Admin Hub
        </Link>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">All Properties</h1>
            <p className="text-slate-400 text-sm mt-1">
              {results ? `${results.total.toLocaleString()} properties` : 'Loading...'}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchSubmit(); }}
                placeholder="Search by address, city, zip code, state... (press Enter)"
                className="w-full pl-12 pr-10 py-3.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#00BC7D] focus:ring-1 focus:ring-[#00BC7D] text-base"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); setActiveQuery(''); setPage(1); search('', 1, sortBy, dealTypeFilter); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={handleSearchSubmit}
              className="px-5 py-3.5 bg-[#00BC7D] hover:bg-[#00d68f] text-white font-medium rounded-xl transition-colors text-sm whitespace-nowrap"
            >
              Search
            </button>
          </div>
          {activeQuery && activeQuery !== query && (
            <p className="text-xs text-amber-400 mt-1.5">
              Showing results for &quot;{activeQuery}&quot; — press Enter or Search to update
            </p>
          )}

          {/* Deal Type Filter + Sort + Count */}
          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              {/* Deal Type Filter */}
              {[
                { value: '', label: 'All Types' },
                { value: 'owner_finance', label: 'Owner Finance' },
                { value: 'cash_deal', label: 'Cash Deals' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleDealTypeChange(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    dealTypeFilter === opt.value
                      ? opt.value === 'owner_finance'
                        ? 'bg-amber-500 text-white'
                        : opt.value === 'cash_deal'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-[#00BC7D] text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <div className="w-px bg-slate-700 mx-1" />
              {/* Sort Options */}
              {[
                { value: 'listPrice:asc', label: 'Price: Low' },
                { value: 'listPrice:desc', label: 'Price: High' },
                { value: 'createdAt:desc', label: 'Newest' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSortChange(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sortBy === opt.value
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {results && (
              <span className="text-xs text-slate-500">
                Page {results.page} of {results.totalPages}
              </span>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden animate-pulse">
                <div className="h-48 bg-slate-700" />
                <div className="p-4 space-y-2">
                  <div className="h-5 w-24 bg-slate-700 rounded" />
                  <div className="h-4 w-full bg-slate-700/50 rounded" />
                  <div className="h-4 w-2/3 bg-slate-700/50 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && results && (
          <>
            {results.properties.length === 0 ? (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-white font-medium">No properties found</p>
                <p className="text-slate-400 text-sm mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {results.properties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {results.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, results.totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (results.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= results.totalPages - 2) {
                    pageNum = results.totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium ${
                        pageNum === page
                          ? 'bg-[#00BC7D] text-white'
                          : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= results.totalPages}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Property Card ───

function PropertyCard({ property }: { property: Property }) {
  const [imgError, setImgError] = useState(false);
  const image = (!imgError && property.imgSrc) ? property.imgSrc : '/placeholder-house.jpg';
  const price = property.listPrice ? `$${property.listPrice.toLocaleString()}` : 'Price N/A';
  const zillowUrl = property.zpid ? `https://www.zillow.com/homedetails/${property.zpid}_zpid/` : null;
  const propertyUrl = `/property/${property.id}`;

  // Determine deal type from dealType string or dealTypes array
  const dt = property.dealType || '';
  const dts = property.dealTypes || [];
  const isOF = dt === 'owner_finance' || dt === 'both' || dts.includes('owner_finance');
  const isCash = dt === 'cash_deal' || dt === 'both' || dts.includes('cash_deal');

  // Card border color based on deal type
  const borderClass = isOF && isCash
    ? 'border-amber-500/50 hover:border-amber-400'
    : isOF
    ? 'border-amber-500/40 hover:border-amber-400'
    : isCash
    ? 'border-emerald-500/40 hover:border-emerald-400'
    : 'border-slate-700 hover:border-slate-600';

  const details = [
    property.beds ? `${property.beds} bd` : null,
    property.baths ? `${property.baths} ba` : null,
    property.sqft ? `${property.sqft.toLocaleString()} sqft` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={`bg-slate-800 rounded-xl border overflow-hidden transition-colors group ${borderClass}`}>
      {/* Image */}
      <div className="relative h-48 bg-slate-700">
        <Image
          src={image}
          alt={property.address || 'Property'}
          fill
          className="object-cover"
          onError={() => setImgError(true)}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        {/* Deal type badges - prominent */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {isOF && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white shadow-lg">
              Owner Finance
            </span>
          )}
          {isCash && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500 text-white shadow-lg">
              Cash Deal
            </span>
          )}
        </div>
        {/* ARV % */}
        {property.percentOfArv && (
          <div className="absolute top-2 right-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              property.percentOfArv <= 70 ? 'bg-green-600 text-white' :
              property.percentOfArv <= 85 ? 'bg-yellow-600 text-white' :
              'bg-slate-600 text-slate-200'
            }`}>
              {Math.round(property.percentOfArv)}% ARV
            </span>
          </div>
        )}
        {property.isLand && (
          <div className="absolute bottom-2 left-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-600 text-white">Land</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4">
        <div className="text-lg font-bold text-white mb-0.5">{price}</div>
        {property.zestimate && property.zestimate > 0 && (
          <div className="text-xs text-slate-500 mb-1">
            Zestimate: ${property.zestimate.toLocaleString()}
          </div>
        )}
        <p className="text-sm text-slate-300 truncate">{property.address}</p>
        <p className="text-xs text-slate-500">{property.city}, {property.state} {property.zipCode}</p>
        {details && (
          <p className="text-xs text-slate-400 mt-1">{details}</p>
        )}
        {property.homeType && (
          <p className="text-xs text-slate-500 mt-0.5 capitalize">{property.homeType.replace(/-/g, ' ')}</p>
        )}
        {property.monthlyPayment && property.monthlyPayment > 0 && (
          <p className="text-xs text-[#00BC7D] font-medium mt-1">
            ~${Math.round(property.monthlyPayment).toLocaleString()}/mo
          </p>
        )}

        {/* Links */}
        <div className="flex gap-2 mt-3">
          <Link
            href={propertyUrl}
            className={`flex-1 text-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isCash && !isOF
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-[#00BC7D]/10 border border-[#00BC7D]/30 text-[#00BC7D] hover:bg-[#00BC7D]/20'
            }`}
          >
            View Details
          </Link>
          {zillowUrl && (
            <a
              href={zillowUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-400 font-medium hover:bg-blue-500/20 transition-colors"
            >
              Zillow
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
