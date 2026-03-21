'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export interface AdminProperty {
  id: string;
  address: string;
  fullAddress?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  listPrice?: number;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFoot?: number;
  squareFeet?: number;
  lotSquareFoot?: number;
  homeType?: string;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  monthlyPayment?: number;
  interestRate?: number;
  termYears?: number;
  balloonYears?: number;
  imageUrl?: string;
  imageUrls?: string[];
  firstPropertyImage?: string;
  propertyImages?: string[];
  status?: string | null;
  ownerFinanceVerified?: boolean;
  estimatedValue?: number;
  description?: string;
  sentToGHL?: string;
  source?: string;
  agentConfirmedOwnerfinance?: boolean;
  agentName?: string | null;
  agentPhone?: string | null;
  agentEmail?: string | null;
  latitude?: number;
  longitude?: number;
  yearBuilt?: number;
}

interface Filters {
  state: string;
  dealType: string;
  minPrice: string;
  maxPrice: string;
  minBeds: string;
}

interface Facets {
  [key: string]: Array<{ value: string; count: number }>;
}

const ITEMS_PER_PAGE = 50;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformToAdminProperty(doc: any): AdminProperty {
  return {
    id: doc.id,
    address: doc.address || '',
    fullAddress: [doc.address, doc.city, doc.state, doc.zipCode].filter(Boolean).join(', '),
    city: doc.city,
    state: doc.state,
    zipCode: doc.zipCode,
    listPrice: doc.listPrice,
    bedrooms: doc.bedrooms,
    bathrooms: doc.bathrooms,
    squareFeet: doc.squareFeet,
    homeType: doc.propertyType || doc.homeType,
    imageUrl: doc.primaryImage,
    imageUrls: doc.galleryImages || [],
    description: doc.description,
    agentName: doc.agentName,
    agentPhone: doc.agentPhone,
    agentEmail: doc.agentEmail,
    estimatedValue: doc.zestimate,
    ownerFinanceVerified: doc.ownerFinanceVerified,
    source: doc.sourceType,
    agentConfirmedOwnerfinance: doc.manuallyVerified,
    monthlyPayment: doc.monthlyPayment,
    downPaymentAmount: doc.downPaymentAmount,
    downPaymentPercent: doc.downPaymentPercent,
    interestRate: doc.interestRate,
    termYears: doc.termYears,
    balloonYears: doc.balloonYears,
    yearBuilt: doc.yearBuilt,
    latitude: Array.isArray(doc.location) ? doc.location[0] : undefined,
    longitude: Array.isArray(doc.location) ? doc.location[1] : undefined,
  };
}

const emptyFilters: Filters = {
  state: '',
  dealType: '',
  minPrice: '',
  maxPrice: '',
  minBeds: '',
};

export function usePropertySearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Core state
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [sort, setSort] = useState(searchParams.get('sort') || 'createdAt:desc');
  const [filters, setFilters] = useState<Filters>({
    state: searchParams.get('state') || '',
    dealType: searchParams.get('dealType') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    minBeds: searchParams.get('minBeds') || '',
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Results state
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [facets, setFacets] = useState<Facets>({});
  const [loading, setLoading] = useState(false);
  const [searchTime, setSearchTime] = useState(0);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Debounce query
  const timerRef = useRef<NodeJS.Timeout>(null);
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  // Build URL params and fetch
  const fetchResults = useCallback(async (
    q: string,
    pg: number,
    srt: string,
    flt: Filters,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      params.set('page', String(pg));
      params.set('limit', String(ITEMS_PER_PAGE));
      params.set('sort', srt);
      if (flt.state) params.set('state', flt.state);
      if (flt.dealType) params.set('dealType', flt.dealType);
      if (flt.minPrice) params.set('minPrice', flt.minPrice);
      if (flt.maxPrice) params.set('maxPrice', flt.maxPrice);
      if (flt.minBeds) params.set('minBeds', flt.minBeds);

      const res = await fetch(`/api/search/properties?${params.toString()}`);
      const data = await res.json();

      setProperties((data.properties || []).map(transformToAdminProperty));
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
      setFacets(data.facets || {});
      setSearchTime(data.searchTime || 0);
    } catch (error) {
      console.error('Property search failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when search params change
  useEffect(() => {
    fetchResults(debouncedQuery, page, sort, filters);
  }, [debouncedQuery, page, sort, filters, fetchResults]);

  // Sync URL (non-default values only)
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (page > 1) params.set('page', String(page));
    if (sort !== 'createdAt:desc') params.set('sort', sort);
    if (filters.state) params.set('state', filters.state);
    if (filters.dealType) params.set('dealType', filters.dealType);
    if (filters.minPrice) params.set('minPrice', filters.minPrice);
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
    if (filters.minBeds) params.set('minBeds', filters.minBeds);

    const qs = params.toString();
    const target = qs ? `${pathname}?${qs}` : pathname;
    router.replace(target, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, page, sort, filters]);

  // Actions
  const updateFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(emptyFilters);
    setPage(1);
  }, []);

  const clearAll = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setFilters(emptyFilters);
    setSort('createdAt:desc');
    setPage(1);
  }, []);

  const refetch = useCallback(() => {
    fetchResults(debouncedQuery, page, sort, filters);
  }, [fetchResults, debouncedQuery, page, sort, filters]);

  const hasActiveFilters = filters.state || filters.dealType || filters.minPrice || filters.maxPrice || filters.minBeds;

  return {
    // Search
    query,
    setQuery,
    loading,

    // Results
    properties,
    total,
    totalPages,
    facets,
    searchTime,

    // Pagination
    page,
    setPage,
    itemsPerPage: ITEMS_PER_PAGE,

    // Sorting
    sort,
    setSort,

    // Filters
    filters,
    filtersOpen,
    setFiltersOpen,
    updateFilter,
    clearFilters,
    clearAll,
    hasActiveFilters,

    // Selection
    selectedIds,
    setSelectedIds,

    // Actions
    refetch,
  };
}
