'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

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
}

export function useProperties() {
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(75);
  const [addressSearch, setAddressSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [sortField, setSortField] = useState<'address' | 'city' | 'state' | 'listPrice' | 'bedrooms' | 'downPaymentAmount' | 'monthlyPayment' | null>('address');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Fetch properties from API
  const fetchProperties = useCallback(async (limit?: number, resetPage: boolean = true) => {
    setLoading(true);
    try {
      const url = limit ? `/api/admin/properties?limit=${limit}` : '/api/admin/properties';
      const response = await fetch(url);
      const data = await response.json();

      if (data.properties) {
        setProperties(data.properties);
        if (resetPage) {
          setCurrentPage(1);
        }
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load properties on mount
  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // Sort handler
  const handleSort = useCallback((field: 'address' | 'city' | 'state' | 'listPrice' | 'bedrooms' | 'downPaymentAmount' | 'monthlyPayment') => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
  }, [sortField, sortDirection]);

  // Memoized filtered properties
  const filteredProperties = useMemo(() => {
    let filteredProps = properties;

    // Apply address search filter
    if (addressSearch.trim()) {
      const searchTerm = addressSearch.toLowerCase();
      filteredProps = filteredProps.filter(property =>
        property.address?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply city filter
    if (cityFilter.trim()) {
      const cityTerm = cityFilter.toLowerCase();
      filteredProps = filteredProps.filter(property =>
        property.city?.toLowerCase().includes(cityTerm)
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
  }, [properties, addressSearch, cityFilter, sortField, sortDirection]);

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

  return {
    // State
    properties,
    loading,
    selectedProperties,
    currentPage,
    itemsPerPage,
    addressSearch,
    cityFilter,
    sortField,
    sortDirection,

    // Computed
    filteredProperties,
    paginatedProperties,
    totalPages,

    // Actions
    fetchProperties,
    setAddressSearch,
    setCityFilter,
    setCurrentPage,
    handleSort,
    togglePropertySelection,
    selectAll,
    deselectAll,
    setSelectedProperties,
  };
}
