'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  agentConfirmedOwnerFinance?: boolean;
  // Agent contact info
  agentName?: string | null;
  agentPhone?: string | null;
  agentEmail?: string | null;
  // Coordinates for radius search
  latitude?: number;
  longitude?: number;
}

type SortField = 'address' | 'city' | 'state' | 'listPrice' | 'bedrooms' | 'downPaymentAmount' | 'monthlyPayment';

// US States list
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export function useProperties() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from URL params
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [allStates, setAllStates] = useState<string[]>(US_STATES);
  const [loading, setLoading] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(75);

  // Search/filter state - initialized from URL
  const [addressSearch, setAddressSearch] = useState(searchParams.get('address') || '');
  const [cityFilter, setCityFilter] = useState(searchParams.get('city') || '');
  const [stateFilter, setStateFilter] = useState(searchParams.get('state') || '');
  const [radius, setRadius] = useState(parseInt(searchParams.get('radius') || '0'));

  // Sort state
  const [sortField, setSortField] = useState<SortField>((searchParams.get('sortBy') as SortField) || 'address');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc');

  // Update URL when filters change
  const updateURL = useCallback((updates: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== '' && value !== 0) {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    });

    // Use replace to avoid adding to history for every keystroke
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, pathname, router]);

  // Fetch properties from API with server-side filtering
  const fetchProperties = useCallback(async (options?: {
    city?: string;
    state?: string;
    radius?: number;
    resetPage?: boolean;
  }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      // Use passed options or current state
      const city = options?.city ?? cityFilter;
      const state = options?.state ?? stateFilter;
      const rad = options?.radius ?? radius;

      if (city) params.set('city', city);
      if (state) params.set('state', state);
      if (rad > 0) params.set('radius', String(rad));

      const url = `/api/admin/properties?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.properties) {
        setProperties(data.properties);
        if (data.states) {
          setAllStates(data.states);
        }
        if (options?.resetPage !== false) {
          setCurrentPage(1);
        }
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error);
    } finally {
      setLoading(false);
    }
  }, [cityFilter, stateFilter, radius]);

  // Load properties on mount
  useEffect(() => {
    fetchProperties({ resetPage: true });
  }, []);

  // Refetch when server-side filters change
  useEffect(() => {
    // Debounce city search
    const timer = setTimeout(() => {
      fetchProperties({ city: cityFilter, state: stateFilter, radius, resetPage: true });
      updateURL({ city: cityFilter, state: stateFilter, radius });
    }, 300);

    return () => clearTimeout(timer);
  }, [cityFilter, stateFilter, radius]);

  // Sort handler
  const handleSort = useCallback((field: SortField) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
    updateURL({ sortBy: field, sortOrder: newDirection });
  }, [sortField, sortDirection, updateURL]);

  // Memoized filtered properties (client-side address filtering)
  const filteredProperties = useMemo(() => {
    let filteredProps = properties;

    // Apply address search filter (client-side for instant feedback)
    if (addressSearch.trim()) {
      const searchTerm = addressSearch.toLowerCase();
      filteredProps = filteredProps.filter(property =>
        property.address?.toLowerCase().includes(searchTerm) ||
        property.fullAddress?.toLowerCase().includes(searchTerm) ||
        property.streetAddress?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply sorting
    if (sortField) {
      filteredProps = [...filteredProps].sort((a, b) => {
        let aValue: string | number = '';
        let bValue: string | number = '';

        switch (sortField) {
          case 'address':
            aValue = a.address?.toLowerCase() || '';
            bValue = b.address?.toLowerCase() || '';
            break;
          case 'city':
            aValue = a.city?.toLowerCase() || '';
            bValue = b.city?.toLowerCase() || '';
            break;
          case 'state':
            aValue = a.state?.toLowerCase() || '';
            bValue = b.state?.toLowerCase() || '';
            break;
          case 'listPrice':
            aValue = a.listPrice || 0;
            bValue = b.listPrice || 0;
            break;
          case 'bedrooms':
            aValue = a.bedrooms || 0;
            bValue = b.bedrooms || 0;
            break;
          case 'downPaymentAmount':
            aValue = a.downPaymentAmount ?? 0;
            bValue = b.downPaymentAmount ?? 0;
            break;
          case 'monthlyPayment':
            aValue = a.monthlyPayment ?? 0;
            bValue = b.monthlyPayment ?? 0;
            break;
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          return sortDirection === 'asc'
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number);
        }
      });
    }

    return filteredProps;
  }, [properties, addressSearch, sortField, sortDirection]);

  // Memoized paginated properties
  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProperties.slice(start, start + itemsPerPage);
  }, [filteredProperties, currentPage, itemsPerPage]);

  // Memoized total pages
  const totalPages = useMemo(() =>
    Math.ceil(filteredProperties.length / itemsPerPage),
    [filteredProperties.length, itemsPerPage]
  );

  // Selection handlers
  const togglePropertySelection = useCallback((propertyId: string) => {
    setSelectedProperties(prev =>
      prev.includes(propertyId)
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  }, []);

  const selectAll = useCallback(() => {
    const pageIds = paginatedProperties.map(p => p.id);
    setSelectedProperties(prev => [...new Set([...prev, ...pageIds])]);
  }, [paginatedProperties]);

  const deselectAll = useCallback(() => {
    const pageIds = paginatedProperties.map(p => p.id);
    setSelectedProperties(prev => prev.filter(id => !pageIds.includes(id)));
  }, [paginatedProperties]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setAddressSearch('');
    setCityFilter('');
    setStateFilter('');
    setRadius(0);
    setSortField('address');
    setSortDirection('asc');
    setCurrentPage(1);
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  // Setters that update URL
  const setAddressSearchWithURL = useCallback((value: string) => {
    setAddressSearch(value);
    updateURL({ address: value });
  }, [updateURL]);

  return {
    // State
    properties,
    allStates,
    loading,
    selectedProperties,
    currentPage,
    itemsPerPage,
    addressSearch,
    cityFilter,
    stateFilter,
    radius,
    sortField,
    sortDirection,

    // Computed
    filteredProperties,
    paginatedProperties,
    totalPages,

    // Actions
    fetchProperties,
    setAddressSearch: setAddressSearchWithURL,
    setCityFilter,
    setStateFilter,
    setRadius,
    setCurrentPage,
    handleSort,
    togglePropertySelection,
    selectAll,
    deselectAll,
    setSelectedProperties,
    clearAllFilters,
  };
}
