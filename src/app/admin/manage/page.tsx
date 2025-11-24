'use client';

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LeadDispute } from '@/lib/firebase-models';
import { PropertyListing } from '@/lib/property-schema';
import Image from 'next/image';
import { calculatePropertyFinancials } from '@/lib/property-calculations';
import { useDropzone } from 'react-dropzone';
import { PropertySwiper2 } from '@/components/ui/PropertySwiper2';
import { convertToDirectImageUrl } from './lib/image-utils';

// Lazy load tab components
const PropertiesTab = lazy(() => import('./components/PropertiesTab'));

// Extended Property interface for admin with legacy imageUrl field
interface AdminProperty extends PropertyListing {
  imageUrl?: string; // Legacy field for backward compatibility
}

interface BuyerStats {
  id: string;
  userId: string;  // User ID for deletion (different from profile ID)
  name: string;
  email: string;
  phone?: string;
  primaryCity?: string;
  primaryState?: string;
  downPayment?: number;
  monthlyBudget?: number;
  matchedPropertiesCount: number;
  likedPropertiesCount: number;
  loginCount: number;
  lastSignIn?: string;
  createdAt?: string;
  isActive?: boolean;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  maxMonthlyPayment?: number;
  maxDownPayment?: number;
}

interface RealtorStats {
  id: string;
  name: string;
  email: string;
  phone?: string;
  licenseNumber?: string;
  brokerage?: string;
  city?: string;
  state?: string;
  credits: number;
  availableBuyersCount: number;
  totalLeadsPurchased: number;
  lastSignIn?: string;
  createdAt?: string;
  isActive?: boolean;
  subscriptionStatus?: string;
}

interface Stats {
  totalProperties: number;
  totalBuyers: number;
  totalRealtors: number;
  pendingDisputes: number;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'properties' | 'upload' | 'disputes' | 'contacts' | 'buyers' | 'realtors' | 'social' | 'buyer-preview' | 'cash-houses'>('overview');

  // Stats
  const [stats, setStats] = useState<Stats>({
    totalProperties: 0,
    totalBuyers: 0,
    totalRealtors: 0,
    pendingDisputes: 0
  });

  // Properties state
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(75);
  const [addressSearch, setAddressSearch] = useState('');
  const [sortField, setSortField] = useState<'address' | 'city' | 'state' | 'listPrice' | 'bedrooms' | 'downPaymentAmount' | 'monthlyPayment' | null>('address');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [editingProperty, setEditingProperty] = useState<AdminProperty | null>(null);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadMode, setUploadMode] = useState<'csv' | 'manual' | 'scraper' | 'new-properties'>('csv');
  const [manualPropertyData, setManualPropertyData] = useState<any>({
    propertyType: 'single-family',
    status: 'active',
    isActive: true,
    priority: 5
  });

  // Scraper state
  const [scraperProgress, setScraperProgress] = useState<{
    status: 'idle' | 'uploading' | 'scraping' | 'complete' | 'error';
    message: string;
    urlsFound?: number;
    propertiesScraped?: number;
    total?: number;
    duplicatesInFile?: number;
    alreadyInDatabase?: number;
    newProperties?: number;
  }>({
    status: 'idle',
    message: 'Upload an Excel or CSV file to begin',
  });

  // New Properties state (zillow_imports collection)
  const [newPropertiesData, setNewPropertiesData] = useState<any[]>([]);
  const [loadingNewProperties, setLoadingNewProperties] = useState(false);
  const [exportingGHL, setExportingGHL] = useState(false);
  const [sendingToGHL, setSendingToGHL] = useState(false);
  const [ghlSendResult, setGhlSendResult] = useState<any>(null);

  // Disputes state
  const [disputes, setDisputes] = useState<LeadDispute[]>([]);

  // Contacts state
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Buyers and Realtors state
  const [buyers, setBuyers] = useState<BuyerStats[]>([]);
  const [filteredBuyers, setFilteredBuyers] = useState<BuyerStats[]>([]);
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const [buyerSortField, setBuyerSortField] = useState<'name' | 'matched' | 'liked' | 'budget' | 'downpay'>('name');
  const [buyerSortDirection, setBuyerSortDirection] = useState<'asc' | 'desc'>('asc');
  const [cityFilter, setCityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [realtors, setRealtors] = useState<RealtorStats[]>([]);
  const [loadingRealtors, setLoadingRealtors] = useState(false);

  // Edit modal state
  const [editForm, setEditForm] = useState<Partial<AdminProperty>>({});

  // Buyer Preview state
  const [previewProperties, setPreviewProperties] = useState<AdminProperty[]>([]);
  const [previewCurrentIndex, setPreviewCurrentIndex] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');

  // Cash Houses state
  const [cashHouses, setCashHouses] = useState<any[]>([]);
  const [loadingCashHouses, setLoadingCashHouses] = useState(false);
  const [cashHousesFilter, setCashHousesFilter] = useState<'all' | 'discount' | 'needs_work' | 'owner_finance'>('all');
  const [selectedCashHouses, setSelectedCashHouses] = useState<Set<string>>(new Set());
  const [cashHousesSortBy, setCashHousesSortBy] = useState<'newest' | 'discount_asc' | 'discount_desc'>('newest');

  // Fetch cash houses when tab becomes active
  useEffect(() => {
    if (activeTab === 'cash-houses' && cashHouses.length === 0) {
      fetchCashHouses();
    }
  }, [activeTab]);

  const fetchCashHouses = async () => {
    setLoadingCashHouses(true);
    try {
      const { collection, getDocs, orderBy, query, limit } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      const cashHousesRef = collection(db, 'cash_houses');
      const q = query(cashHousesRef, orderBy('importedAt', 'desc'), limit(200));
      const snapshot = await getDocs(q);

      const houses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setCashHouses(houses);
    } catch (error) {
      console.error('Failed to fetch cash houses:', error);
    } finally {
      setLoadingCashHouses(false);
    }
  };

  const deleteCashHouses = async (ids: string[]) => {
    if (ids.length === 0) return;

    if (!confirm(`Delete ${ids.length} propert${ids.length === 1 ? 'y' : 'ies'}? This cannot be undone.`)) {
      return;
    }

    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      // Delete in batches
      for (const id of ids) {
        await deleteDoc(doc(db, 'cash_houses', id));
      }

      // Update UI
      setCashHouses(prev => prev.filter(h => !ids.includes(h.id)));
      setSelectedCashHouses(new Set());

      alert(`Deleted ${ids.length} propert${ids.length === 1 ? 'y' : 'ies'} successfully!`);
    } catch (error) {
      console.error('Failed to delete cash houses:', error);
      alert('Failed to delete properties');
    }
  };

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    }

    if (status === 'authenticated') {
      const userRole = (session?.user as { role?: string })?.role;
      if (userRole !== 'admin') {
        if (userRole === 'buyer') {
          router.push('/dashboard');
        } else if (userRole === 'realtor') {
          router.push('/realtor/dashboard');
        } else {
          router.push('/auth');
        }
      }
    }
  }, [status, session, router]);

  // Load initial stats
  useEffect(() => {
    if (status === 'authenticated' && (session?.user as { role?: string })?.role === 'admin') {
      loadStats();
    }
  }, [status, session]);

  const loadStats = async () => {
    try {
      // Load all stats in parallel for better performance
      const [propData, buyersData, realtorsData, disputesData] = await Promise.all([
        fetch('/api/admin/properties?limit=1').then(r => r.json()),
        fetch('/api/admin/buyers').then(r => r.json()),
        fetch('/api/admin/realtors').then(r => r.json()),
        fetch('/api/admin/disputes').then(r => r.json())
      ]);

      setStats({
        totalProperties: propData.total || 0,
        totalBuyers: buyersData.total || 0, // Use actual total count, not array length
        totalRealtors: realtorsData.realtors?.length || 0,
        pendingDisputes: disputesData.pendingDisputes?.length || 0
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  // Fetch functions (wrapped in useCallback for performance optimization)
  const fetchProperties = useCallback(async (limit?: number, resetPage: boolean = true) => {
    setLoadingProperties(true);
    try {
      const url = limit ? `/api/admin/properties?limit=${limit}` : '/api/admin/properties';
      const response = await fetch(url);
      const data = await response.json();
      if (data.properties) {
        setProperties(data.properties);
        setStats(prev => ({ ...prev, totalProperties: data.total || data.properties.length }));
        if (!limit && resetPage) {
          setCurrentPage(1);
        }
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error);
    } finally {
      setLoadingProperties(false);
    }
  }, []);


  const fetchNewProperties = useCallback(async () => {
    setLoadingNewProperties(true);
    try {
      const response = await fetch('/api/admin/zillow-imports');
      const data = await response.json();
      if (data.properties) {
        setNewPropertiesData(data.properties);
      }
    } catch (error) {
      console.error('Failed to fetch new properties:', error);
    } finally {
      setLoadingNewProperties(false);
    }
  }, []);

  const handleExportGHL = async () => {
    setExportingGHL(true);
    try {
      const response = await fetch('/api/admin/zillow-imports/export-ghl');
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zillow_imports_ghl_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export to GHL format:', error);
      alert('Failed to export properties');
    } finally {
      setExportingGHL(false);
    }
  };

  const handleSendToGHL = async () => {
    if (!confirm(`Send ${newPropertiesData.length} properties to GoHighLevel webhook?`)) {
      return;
    }

    setSendingToGHL(true);
    setGhlSendResult(null);

    try {
      const response = await fetch('/api/admin/zillow-imports/send-to-ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 }), // Send up to 100 properties
      });

      if (!response.ok) throw new Error('Failed to send to GHL');

      const data = await response.json();
      setGhlSendResult(data);
      alert(`✅ Success!\n\nSent: ${data.stats.success}\nErrors: ${data.stats.errors}`);
    } catch (error) {
      console.error('Failed to send to GHL:', error);
      alert('❌ Failed to send properties to GHL webhook');
    } finally {
      setSendingToGHL(false);
    }
  };

  const fetchDisputes = async () => {
    try {
      const response = await fetch('/api/admin/disputes');
      const data = await response.json();
      const allDisputes = [
        ...(data.pendingDisputes || []),
        ...(data.resolvedDisputes || [])
      ];
      setDisputes(allDisputes);
      setStats(prev => ({ ...prev, pendingDisputes: data.pendingDisputes?.length || 0 }));
    } catch (error) {
      console.error('Failed to fetch disputes:', error);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const response = await fetch('/api/admin/contacts');
      if (!response.ok) return;
      const data = await response.json();
      setContacts(data.contacts || []);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchBuyers = async () => {
    setLoadingBuyers(true);
    try {
      const response = await fetch('/api/admin/buyers');
      if (!response.ok) return;
      const data = await response.json();
      setBuyers(data.buyers || []);
      setFilteredBuyers(data.buyers || []);
      setStats(prev => ({ ...prev, totalBuyers: data.total || 0 })); // Use total count from API
    } catch (error) {
      console.error('Failed to fetch buyers:', error);
    } finally {
      setLoadingBuyers(false);
    }
  };

  const fetchRealtors = async () => {
    setLoadingRealtors(true);
    try {
      const response = await fetch('/api/admin/realtors');
      if (!response.ok) return;
      const data = await response.json();
      setRealtors(data.realtors || []);
      setStats(prev => ({ ...prev, totalRealtors: data.realtors?.length || 0 }));
    } catch (error) {
      console.error('Failed to fetch realtors:', error);
    } finally {
      setLoadingRealtors(false);
    }
  };

  // Filter buyers by city and state whenever filters change
  useEffect(() => {
    if (!cityFilter.trim() && !stateFilter.trim()) {
      setFilteredBuyers(buyers);
    } else {
      const filtered = buyers.filter(buyer => {
        const buyerCity = (buyer.primaryCity || buyer.city || '').toLowerCase();
        const buyerState = (buyer.primaryState || buyer.state || '').toUpperCase();

        const cityMatch = !cityFilter.trim() || buyerCity.includes(cityFilter.toLowerCase());
        const stateMatch = !stateFilter.trim() || buyerState === stateFilter.toUpperCase();

        return cityMatch && stateMatch;
      });
      setFilteredBuyers(filtered);
    }
    // Clear selection when filter changes
    setSelectedBuyers([]);
  }, [cityFilter, stateFilter, buyers]);

  const fetchPreviewProperties = async () => {
    setLoadingPreview(true);
    try {
      const response = await fetch('/api/admin/properties?limit=1000');
      const data = await response.json();
      if (data.properties) {
        setPreviewProperties(data.properties);
        setPreviewCurrentIndex(0);
      }
    } catch (error) {
      console.error('Failed to fetch preview properties:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'properties') {
      fetchProperties();
    } else if (activeTab === 'disputes') {
      fetchDisputes();
    } else if (activeTab === 'contacts') {
      fetchContacts();
    } else if (activeTab === 'buyers') {
      fetchBuyers();
    } else if (activeTab === 'realtors') {
      fetchRealtors();
    } else if (activeTab === 'buyer-preview') {
      fetchPreviewProperties();
    }
  }, [activeTab]);

  // Handle Escape key to exit buyer preview
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeTab === 'buyer-preview') {
        setActiveTab('overview');
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [activeTab]);

  // Ensure preview index stays within bounds
  useEffect(() => {
    if (previewProperties.length > 0 && previewCurrentIndex >= previewProperties.length) {
      setPreviewCurrentIndex(0);
    }
  }, [previewProperties, previewCurrentIndex]);

  // Handle arrow keys for navigation in buyer preview
  useEffect(() => {
    if (activeTab !== 'buyer-preview' || previewProperties.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPreviewCurrentIndex((prev) => (prev - 1 + previewProperties.length) % previewProperties.length);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPreviewCurrentIndex((prev) => (prev + 1) % previewProperties.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, previewProperties.length]);

  // Fetch new properties when switching to new-properties tab
  useEffect(() => {
    if (activeTab === 'upload' && uploadMode === 'new-properties') {
      fetchNewProperties();
    }
  }, [activeTab, uploadMode]);

  // Property management functions
  // ✅ PERFORMANCE FIX: Removed duplicate sorting logic - now handled by useMemo
  const handleSort = (field: 'address' | 'city' | 'state' | 'listPrice' | 'bedrooms' | 'downPaymentAmount' | 'monthlyPayment') => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
    // Sorting now handled automatically by filteredProperties useMemo
  };

  // ✅ PERFORMANCE FIX: Memoize filtering to prevent recalculation on every render
  const filteredProperties = useMemo(() => {
    let filteredProps = properties;

    // Apply search filter - search by address or city
    if (addressSearch.trim()) {
      const searchTerm = addressSearch.toLowerCase();
      filteredProps = filteredProps.filter(property =>
        property.address?.toLowerCase().includes(searchTerm) ||
        property.city?.toLowerCase().includes(searchTerm)
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

  // ✅ PERFORMANCE FIX: Memoize pagination to prevent recalculation on every render
  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProperties.slice(start, start + itemsPerPage);
  }, [filteredProperties, currentPage, itemsPerPage]);

  // ✅ PERFORMANCE FIX: Memoize total pages calculation
  const totalPages = useMemo(() =>
    Math.ceil(filteredProperties.length / itemsPerPage),
    [filteredProperties.length, itemsPerPage]
  );

  // Helper function to recalculate financials when price or related fields change
  const handlePriceChange = (newPrice: number) => {
    const updatedFinancials = calculatePropertyFinancials({
      listPrice: newPrice,
      downPaymentPercent: editForm.downPaymentPercent,
      downPaymentAmount: editForm.downPaymentAmount,
      monthlyPayment: editForm.monthlyPayment,
      interestRate: editForm.interestRate,
      termYears: editForm.termYears, // Let calculatePropertyFinancials use dynamic default
      balloonYears: editForm.balloonYears,
      balloonPayment: editForm.balloonPayment
    });

    setEditForm({
      ...editForm,
      listPrice: newPrice,
      downPaymentAmount: updatedFinancials.downPaymentAmount,
      downPaymentPercent: updatedFinancials.downPaymentPercent,
      monthlyPayment: updatedFinancials.monthlyPayment,
      loanAmount: updatedFinancials.loanAmount
    });
  };

  // Helper function to recalculate when down payment percent changes
  const handleDownPaymentPercentChange = (newPercent: number) => {
    const updatedFinancials = calculatePropertyFinancials({
      listPrice: editForm.listPrice,
      downPaymentPercent: newPercent,
      monthlyPayment: editForm.monthlyPayment,
      interestRate: editForm.interestRate,
      termYears: editForm.termYears, // Let calculatePropertyFinancials use dynamic default
      balloonYears: editForm.balloonYears,
      balloonPayment: editForm.balloonPayment
    });

    setEditForm({
      ...editForm,
      downPaymentPercent: newPercent,
      downPaymentAmount: updatedFinancials.downPaymentAmount,
      monthlyPayment: updatedFinancials.monthlyPayment,
      loanAmount: updatedFinancials.loanAmount
    });
  };

  // Helper function to recalculate when interest rate changes
  const handleInterestRateChange = (newRate: number) => {
    const updatedFinancials = calculatePropertyFinancials({
      listPrice: editForm.listPrice,
      downPaymentPercent: editForm.downPaymentPercent,
      downPaymentAmount: editForm.downPaymentAmount,
      interestRate: newRate,
      termYears: editForm.termYears, // Let calculatePropertyFinancials use dynamic default
      balloonYears: editForm.balloonYears,
      balloonPayment: editForm.balloonPayment
    });

    setEditForm({
      ...editForm,
      interestRate: newRate,
      monthlyPayment: updatedFinancials.monthlyPayment
    });
  };

  // Upload functions
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setFile(selectedFile || null);
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/upload-properties-v4', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setUploadResult({ error: errorData.error || `HTTP ${response.status}` });
        return;
      }

      const data = await response.json();
      setUploadResult(data);

      if (data.success) {
        setFile(null);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        loadStats(); // Refresh stats
      }
    } catch (error) {
      setUploadResult({ error: `Upload failed: ${(error as Error).message}` });
    } finally {
      setUploading(false);
    }
  };

  // Scraper functions
  const pollJobStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/scraper/status?jobId=${jobId}`);
        const data = await response.json();

        if (data.status === 'complete') {
          clearInterval(interval);
          setScraperProgress({
            status: 'complete',
            message: `✅ Complete! Imported ${data.imported} properties to Firebase`,
            propertiesScraped: data.imported,
            total: data.total,
          });
        } else if (data.status === 'error') {
          clearInterval(interval);
          setScraperProgress({
            status: 'error',
            message: `❌ Error: ${data.error}`,
          });
        } else {
          setScraperProgress({
            status: 'scraping',
            message: `Scraping... ${data.progress || 0}% complete`,
            propertiesScraped: data.imported || 0,
            total: data.total || 0,
          });
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    }, 3000);
  };

  const onScraperDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    const fileCount = acceptedFiles.length;
    const fileNames = acceptedFiles.map(f => f.name).join(', ');

    setScraperProgress({
      status: 'uploading',
      message: `Uploading ${fileCount} file${fileCount > 1 ? 's' : ''}: ${fileNames}...`,
      totalFiles: fileCount,
    });

    const formData = new FormData();
    acceptedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/admin/scraper/batch-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();

      let message = `Processed ${data.filesProcessed} file${data.filesProcessed > 1 ? 's' : ''}. `;
      message += `Found ${data.totalUrls} total URLs.`;
      if (data.duplicatesInFiles > 0) {
        message += ` Removed ${data.duplicatesInFiles} duplicates.`;
      }
      if (data.alreadyInDatabase > 0) {
        message += ` ${data.alreadyInDatabase} already in database.`;
      }
      message += ` Importing ${data.newProperties} new properties...`;

      setScraperProgress({
        status: 'scraping',
        message,
        urlsFound: data.totalUrls,
        duplicatesInFile: data.duplicatesInFiles,
        alreadyInDatabase: data.alreadyInDatabase,
        newProperties: data.newProperties,
        totalFiles: data.filesProcessed,
      });

      // Poll for job status
      pollJobStatus(data.batchJobId);

    } catch (error: any) {
      setScraperProgress({
        status: 'error',
        message: error.message || 'Failed to upload files',
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onScraperDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: true,
  });

  // Dispute resolution
  const resolveDispute = async (disputeId: string, action: 'approve' | 'deny', refundCredits: number = 1) => {
    try {
      const response = await fetch('/api/admin/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disputeId, action, refundCredits })
      });

      if (response.ok) {
        alert(`Dispute ${action === 'approve' ? 'approved' : 'denied'} successfully`);
        fetchDisputes();
      } else {
        const error = await response.json();
        alert(`Failed to resolve dispute: ${error.error}`);
      }
    } catch {
      alert('Failed to resolve dispute');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg font-medium text-gray-900">Loading Admin Dashboard</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col md:flex-row max-w-full overflow-hidden">
      {/* Mobile Dropdown Navigation */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
            <h1 className="text-lg font-bold text-slate-900">OwnerFi Admin</h1>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signout' })}
            className="text-slate-600 hover:text-red-600"
            title="Sign Out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as any)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="overview">📊 Overview</option>
          <option value="properties">🏠 Properties {stats.totalProperties > 0 ? `(${stats.totalProperties})` : ''}</option>
          <option value="buyer-preview">👁️ Buyer Preview</option>
          <option value="upload">📤 Upload</option>
          <option value="cash-houses">💰 Cash Houses {cashHouses.length > 0 ? `(${cashHouses.length})` : ''}</option>
          <option value="buyers">👤 Buyers {stats.totalBuyers > 0 ? `(${stats.totalBuyers})` : ''}</option>
          <option value="realtors">🏢 Realtors {stats.totalRealtors > 0 ? `(${stats.totalRealtors})` : ''}</option>
          <option value="disputes">⚖️ Disputes {stats.pendingDisputes > 0 ? `(${stats.pendingDisputes})` : ''}</option>
          <option value="contacts">📧 Contacts</option>
          <option value="social">📱 Social & Articles</option>
        </select>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 lg:w-72 bg-white shadow-xl border-r border-slate-200 flex-shrink-0 relative flex-col h-screen">
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <div className="w-5 h-5 bg-white rounded-md"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">OwnerFi</h1>
              <p className="text-sm text-slate-500">Admin Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {[
            { key: 'overview', label: 'Overview', icon: '📊', count: null },
            { key: 'properties', label: 'Properties', icon: '🏠', count: stats.totalProperties },
            { key: 'buyer-preview', label: 'Buyer Preview', icon: '👁️', count: null },
            { key: 'upload', label: 'Upload', icon: '📤', count: null },
            { key: 'cash-houses', label: 'Cash Houses', icon: '💰', count: cashHouses.length || null },
            { key: 'buyers', label: 'Buyers', icon: '👤', count: stats.totalBuyers },
            { key: 'realtors', label: 'Realtors', icon: '🏢', count: stats.totalRealtors },
            { key: 'disputes', label: 'Disputes', icon: '⚖️', count: stats.pendingDisputes },
            { key: 'contacts', label: 'Contacts', icon: '📧', count: null },
            { key: 'social', label: 'Social & Articles', icon: '📱', count: null },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all duration-200 group ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg transform scale-[1.02]'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </div>
              {tab.count !== null && tab.count > 0 && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  activeTab === tab.key
                    ? 'bg-white/20 text-white'
                    : tab.key === 'disputes'
                    ? 'bg-red-100 text-red-700 animate-pulse'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* External Dashboards */}
        <div className="p-4 space-y-2 border-t border-slate-200 flex-shrink-0">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
            Dashboards
          </div>
          <a
            href="/admin/analytics"
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="text-lg">📈</span>
            <span className="font-medium">Analytics</span>
          </a>
          <a
            href="/admin/costs"
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="text-lg">💰</span>
            <span className="font-medium">Cost Tracking</span>
          </a>
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-slate-200 bg-white flex-shrink-0 mt-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-slate-600">System Online</span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signout' })}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
              title="Sign Out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full">
        {/* Top Header */}
        {activeTab !== 'buyer-preview' && (
        <header className="bg-white shadow-sm border-b border-slate-200 px-4 md:px-6 lg:px-8 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                {activeTab === 'overview' && 'Dashboard Overview'}
                {activeTab === 'properties' && 'Property Management'}
                {activeTab === 'upload' && 'Upload Properties'}
                {activeTab === 'cash-houses' && 'Cash Houses (80% ARV Deals)'}
                {activeTab === 'buyers' && 'Buyer Management'}
                {activeTab === 'realtors' && 'Realtor Management'}
                {activeTab === 'disputes' && 'Dispute Resolution'}
                {activeTab === 'contacts' && 'Contact Submissions'}
                {activeTab === 'social' && 'Social Media & Articles'}
              </h2>
              <p className="text-sm md:text-base text-slate-600 mt-1">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Quick Actions */}
            {activeTab === 'properties' && (
              <div className="flex space-x-3">
                <button
                  onClick={async () => {
                    if (confirm('Remove all duplicate properties?')) {
                      const response = await fetch('/api/admin/remove-duplicates', { method: 'POST' });
                      const data = await response.json();
                      if (data.success) {
                        alert(`Removed ${data.summary.deleted} duplicates`);
                        fetchProperties(undefined, false);
                      }
                    }
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors shadow-sm"
                >
                  Remove Duplicates
                </button>
                <button
                  onClick={() => fetchProperties(undefined, false)}
                  disabled={loadingProperties}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 shadow-sm"
                >
                  {loadingProperties ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            )}
          </div>
        </header>
        )}

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 bg-slate-50 overflow-y-auto w-full">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.707 2.293a1 1 0 00-1.414 0l-9 9a1 1 0 001.414 1.414L2 12.414V17a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1v-4.586l.293.293a1 1 0 001.414-1.414l-9-9z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Properties</dt>
                          <dd className="text-lg font-medium text-gray-900">{stats.totalProperties.toLocaleString()}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Active Buyers</dt>
                          <dd className="text-lg font-medium text-gray-900">{stats.totalBuyers.toLocaleString()}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 2h6v4H7V6zm8 8v2h1v-2h-1zm-2-2H7v4h6v-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Active Realtors</dt>
                          <dd className="text-lg font-medium text-gray-900">{stats.totalRealtors.toLocaleString()}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                          stats.pendingDisputes > 0 ? 'bg-red-500' : 'bg-gray-400'
                        }`}>
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Pending Disputes</dt>
                          <dd className="text-lg font-medium text-gray-900">{stats.pendingDisputes}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="relative group bg-gray-50 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <span className="rounded-lg inline-flex p-3 bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </span>
                      </div>
                      <div className="mt-8">
                        <h3 className="text-lg font-medium text-gray-900">Upload Properties</h3>
                        <p className="mt-2 text-sm text-gray-500">Upload new property listings via CSV file</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('properties')}
                      className="relative group bg-gray-50 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-600 group-hover:bg-green-100">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.707 2.293a1 1 0 00-1.414 0l-9 9a1 1 0 001.414 1.414L2 12.414V17a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1v-4.586l.293.293a1 1 0 001.414-1.414l-9-9z" />
                          </svg>
                        </span>
                      </div>
                      <div className="mt-8">
                        <h3 className="text-lg font-medium text-gray-900">Manage Properties</h3>
                        <p className="mt-2 text-sm text-gray-500">View, edit, and manage all property listings</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('disputes')}
                      className="relative group bg-gray-50 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <span className={`rounded-lg inline-flex p-3 ${
                          stats.pendingDisputes > 0
                            ? 'bg-red-50 text-red-600 group-hover:bg-red-100'
                            : 'bg-gray-50 text-gray-600 group-hover:bg-gray-100'
                        }`}>
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </div>
                      <div className="mt-8">
                        <h3 className="text-lg font-medium text-gray-900">Resolve Disputes</h3>
                        <p className="mt-2 text-sm text-gray-500">
                          {stats.pendingDisputes > 0
                            ? `${stats.pendingDisputes} pending dispute${stats.pendingDisputes > 1 ? 's' : ''}`
                            : 'No pending disputes'
                          }
                        </p>
                      </div>
                    </button>

                    <a
                      href="/admin/analytics"
                      className="relative group bg-gradient-to-br from-blue-50 to-indigo-50 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg hover:from-blue-100 hover:to-indigo-100 transition-colors"
                    >
                      <div>
                        <span className="rounded-lg inline-flex p-3 bg-blue-500 text-white group-hover:bg-blue-600">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </span>
                      </div>
                      <div className="mt-8">
                        <h3 className="text-lg font-medium text-gray-900">Analytics Dashboard</h3>
                        <p className="mt-2 text-sm text-gray-600">View social media performance insights</p>
                      </div>
                    </a>

                    <a
                      href="/admin/costs"
                      className="relative group bg-gradient-to-br from-green-50 to-emerald-50 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-green-500 rounded-lg hover:from-green-100 hover:to-emerald-100 transition-colors"
                    >
                      <div>
                        <span className="rounded-lg inline-flex p-3 bg-green-500 text-white group-hover:bg-green-600">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                      </div>
                      <div className="mt-8">
                        <h3 className="text-lg font-medium text-gray-900">Cost Dashboard</h3>
                        <p className="mt-2 text-sm text-gray-600">Track API costs and budget usage</p>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Properties Tab */}
          {activeTab === 'properties' && (
            <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="text-gray-500">Loading properties...</div></div>}>
              <PropertiesTab
                setEditingProperty={setEditingProperty}
                setEditForm={setEditForm as any}
              />
            </Suspense>
          )}

                                  </ul>
                                )}
                                {property.missingFields && property.missingFields.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {property.missingFields.map((field: string, idx: number) => (
                                      <span key={idx} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                                        Missing: {field}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {property.failureType === 'withdrawn' && (
                                  <span className="text-gray-600">Status: {property.status}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                property.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {property.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => {
                                    setEditingProperty(property.id);
                                    setEditForm(property);
                                  }}
                                  className="text-indigo-600 hover:text-indigo-900 font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm(`Delete property: ${property.address}?`)) {
                                      try {
                                        await fetch(`/api/admin/properties/${property.id}`, { method: 'DELETE' });
                                        fetchFailedProperties();
                                        alert('Property deleted successfully');
                                      } catch (error) {
                                        alert('Failed to delete property');
                                        console.error('Delete error:', error);
                                      }
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-900 font-medium"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {editingProperty && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <h2 className="text-xl font-bold mb-4">Edit Property</h2>

                  {/* Debug info */}
                  <div className="mb-4 p-3 bg-gray-100 rounded text-xs">
                    <p>Property ID: {editingProperty.id || 'Missing'}</p>
                    <p>Address: {editingProperty.address || 'Missing'}</p>
                    <p>Has all data: {Object.keys(editingProperty).length} fields</p>
                  </div>

                  <div className="space-y-4">
                    {/* Address */}
                    <div>
                      <label className="block text-sm font-medium mb-1">Address</label>
                      <input
                        type="text"
                        value={editingProperty.address || ''}
                        onChange={(e) => setEditingProperty({ ...editingProperty, address: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>

                    {/* City, State, Zip */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">City</label>
                        <input
                          type="text"
                          value={editingProperty.city || ''}
                          onChange={(e) => setEditingProperty({ ...editingProperty, city: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">State</label>
                        <input
                          type="text"
                          value={editingProperty.state || ''}
                          onChange={(e) => setEditingProperty({ ...editingProperty, state: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Zip Code</label>
                        <input
                          type="text"
                          value={editingProperty.zipCode || ''}
                          onChange={(e) => setEditingProperty({ ...editingProperty, zipCode: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                    </div>

                    {/* Financial Fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">List Price ($)</label>
                        <input
                          type="number"
                          value={editingProperty.listPrice || ''}
                          onChange={(e) => setEditingProperty({ ...editingProperty, listPrice: parseFloat(e.target.value) })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Monthly Payment ($)</label>
                        <input
                          type="number"
                          value={editingProperty.monthlyPayment || ''}
                          onChange={(e) => setEditingProperty({ ...editingProperty, monthlyPayment: parseFloat(e.target.value) })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Down Payment ($)</label>
                        <input
                          type="number"
                          value={editingProperty.downPaymentAmount || ''}
                          onChange={(e) => setEditingProperty({ ...editingProperty, downPaymentAmount: parseFloat(e.target.value) })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Down Payment (%)</label>
                        <input
                          type="number"
                          value={editingProperty.downPaymentPercent || ''}
                          onChange={(e) => setEditingProperty({ ...editingProperty, downPaymentPercent: parseFloat(e.target.value) })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Interest Rate (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editingProperty.interestRate || ''}
                          onChange={(e) => setEditingProperty({ ...editingProperty, interestRate: parseFloat(e.target.value) })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Term (years)</label>
                        <input
                          type="number"
                          value={editingProperty.termYears || ''}
                          onChange={(e) => setEditingProperty({ ...editingProperty, termYears: parseFloat(e.target.value) })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                    </div>

                    {/* Property Details */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Bedrooms</label>
                        <input
                          type="number"
                          value={editingProperty.bedrooms || ''}
                          onChange={(e) => setEditingProperty({ ...editingProperty, bedrooms: parseInt(e.target.value) })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Bathrooms</label>
                        <input
                          type="number"
                          step="0.5"
                          value={editingProperty.bathrooms || ''}
                          onChange={(e) => setEditingProperty({ ...editingProperty, bathrooms: parseFloat(e.target.value) })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Sq Ft</label>
                        <input
                          type="number"
                          value={editingProperty.squareFeet || ''}
                          onChange={(e) => setEditingProperty({ ...editingProperty, squareFeet: parseInt(e.target.value) })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium mb-1">Description</label>
                      <textarea
                        value={editingProperty.description || ''}
                        onChange={(e) => setEditingProperty({ ...editingProperty, description: e.target.value })}
                        rows={3}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setEditingProperty(null)}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEditedProperty}
                      className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'social' && (
            <div className="space-y-6">
              {/* Social Media Dashboard Component */}
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold mb-4">Social Media Automation</h3>
                <iframe
                  src="/admin/social-dashboard"
                  className="w-full h-[calc(50vh-150px)] border-0 rounded-lg shadow-lg bg-white"
                  title="Social Media Dashboard"
                />
              </div>

              {/* Articles Queue Dashboard Component */}
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold mb-4">Article Queue Management</h3>
                <iframe
                  src="/admin/articles"
                  className="w-full h-[calc(50vh-150px)] border-0 rounded-lg shadow-lg bg-white"
                  title="Articles Queue Dashboard"
                />
              </div>
            </div>
          )}

          {/* Contacts Tab */}
          {activeTab === 'contacts' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Contact Form Submissions</h3>
                    <p className="mt-1 text-sm text-gray-500">Messages from the contact page</p>
                  </div>
                  <button
                    onClick={fetchContacts}
                    disabled={loadingContacts}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
                  >
                    {loadingContacts ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {loadingContacts ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">📭</div>
                    <p className="text-gray-500">No contact submissions yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contacts.map((contact) => (
                      <div key={contact.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-semibold text-gray-900">{contact.name}</span>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                contact.status === 'new' ? 'bg-blue-100 text-blue-800' :
                                contact.status === 'read' ? 'bg-gray-100 text-gray-800' :
                                contact.status === 'responded' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {contact.status || 'new'}
                              </span>
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                {contact.subject}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                              <a href={`mailto:${contact.email}`} className="hover:text-indigo-600">{contact.email}</a>
                              {contact.phone && (
                                <a href={`tel:${contact.phone}`} className="hover:text-indigo-600">{contact.phone}</a>
                              )}
                              <span>{contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : 'Unknown date'}</span>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap">{contact.message}</p>
                          </div>
                          <button
                            onClick={async () => {
                              if (confirm('Delete this contact submission?')) {
                                const response = await fetch(`/api/admin/contacts?id=${contact.id}`, { method: 'DELETE' });
                                if (response.ok) {
                                  fetchContacts();
                                }
                              }
                            }}
                            className="text-red-500 hover:text-red-700 p-2"
                            title="Delete"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cash Houses Tab */}
          {activeTab === 'cash-houses' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Cash Houses - Investor Opportunities</h3>
                    <p className="mt-1 text-sm text-gray-500">Properties for investors: discounted deals, owner finance, and fixer-uppers</p>
                  </div>
                  <button
                    onClick={fetchCashHouses}
                    disabled={loadingCashHouses}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                  >
                    {loadingCashHouses ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {/* Filter Tabs */}
                <div className="border-b border-gray-200 mb-6">
                  <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {[
                      { key: 'all', label: 'All Properties', icon: '🏘️' },
                      { key: 'discount', label: 'Discount (<80% ARV)', icon: '💰' },
                      { key: 'needs_work', label: 'Needs Work (Cash)', icon: '🔨' },
                      { key: 'owner_finance', label: 'Owner Finance (Zillow)', icon: '🏠' },
                    ].map((filter) => (
                      <button
                        key={filter.key}
                        onClick={() => setCashHousesFilter(filter.key as any)}
                        className={`${
                          cashHousesFilter === filter.key
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                      >
                        <span>{filter.icon}</span>
                        <span>{filter.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Sort and Bulk Actions */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">
                      Sort by:
                      <select
                        value={cashHousesSortBy}
                        onChange={(e) => setCashHousesSortBy(e.target.value as any)}
                        className="ml-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                      >
                        <option value="newest">Newest First</option>
                        <option value="discount_desc">Highest Discount %</option>
                        <option value="discount_asc">Lowest Discount %</option>
                      </select>
                    </label>
                  </div>
                  {selectedCashHouses.size > 0 && (
                    <button
                      onClick={() => deleteCashHouses(Array.from(selectedCashHouses))}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Delete Selected ({selectedCashHouses.size})
                    </button>
                  )}
                </div>

                {loadingCashHouses ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  </div>
                ) : (() => {
                  // Filter cash houses based on selected filter
                  let filteredHouses = cashHouses.filter(house => {
                    if (cashHousesFilter === 'all') return true;
                    // Discount: ONLY from cash deals scraper under 80% ARV
                    if (cashHousesFilter === 'discount') {
                      return house.dealType === 'discount' && house.source === 'cash_deals_scraper';
                    }
                    // Needs Work: ALL properties with keywords from cash deals scraper (any price)
                    if (cashHousesFilter === 'needs_work') {
                      return house.source === 'cash_deals_scraper' && house.needsWork === true;
                    }
                    // Owner Finance: ONLY from Zillow scraper with keywords
                    if (cashHousesFilter === 'owner_finance') {
                      return house.dealType === 'owner_finance' && house.source === 'zillow_scraper';
                    }
                    return true;
                  });

                  // Sort houses
                  if (cashHousesSortBy === 'discount_desc') {
                    filteredHouses = [...filteredHouses].sort((a, b) =>
                      (b.discountPercentage || 0) - (a.discountPercentage || 0)
                    );
                  } else if (cashHousesSortBy === 'discount_asc') {
                    filteredHouses = [...filteredHouses].sort((a, b) =>
                      (a.discountPercentage || 0) - (b.discountPercentage || 0)
                    );
                  }
                  // 'newest' is already sorted by importedAt from Firestore query

                  const allSelected = filteredHouses.length > 0 && filteredHouses.every(h => selectedCashHouses.has(h.id));

                  return filteredHouses.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No Properties Found</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {cashHousesFilter === 'all' && 'Use the Chrome extension to add properties to the cash deals queue'}
                        {cashHousesFilter === 'discount' && 'No discount deals found (properties under 80% ARV)'}
                        {cashHousesFilter === 'needs_work' && 'No properties with keywords from cash scraper found (any price)'}
                        {cashHousesFilter === 'owner_finance' && 'No owner finance opportunities from Zillow scraper found'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-3 text-left">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCashHouses(new Set(filteredHouses.map(h => h.id)));
                                  } else {
                                    setSelectedCashHouses(new Set());
                                  }
                                }}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zestimate / 80%</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount %</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredHouses.map((house) => {
                            const isSelected = selectedCashHouses.has(house.id);
                            const discountPct = house.discountPercentage || 0;
                            const isDiscount = discountPct > 0;
                            return (
                          <tr key={house.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
                            <td className="px-3 py-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedCashHouses);
                                  if (e.target.checked) {
                                    newSelected.add(house.id);
                                  } else {
                                    newSelected.delete(house.id);
                                  }
                                  setSelectedCashHouses(newSelected);
                                }}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                {house.firstPropertyImage && (
                                  <div className="flex-shrink-0 h-16 w-16 mr-3">
                                    <img
                                      src={house.firstPropertyImage}
                                      alt={house.fullAddress}
                                      className="h-16 w-16 rounded object-cover"
                                    />
                                  </div>
                                )}
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{house.streetAddress}</div>
                                  <div className="text-sm text-gray-500">{house.city}, {house.state} {house.zipCode}</div>
                                  <div className="text-xs text-gray-400">ZPID: {house.zpid}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-semibold text-green-600">
                                ${house.price?.toLocaleString() || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                ${house.estimate?.toLocaleString() || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500">
                                80% = ${house.eightyPercentOfZestimate?.toLocaleString() || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {isDiscount ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  ✅ {discountPct.toFixed(1)}% DISCOUNT
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  ⚠️ {Math.abs(discountPct).toFixed(1)}% PREMIUM
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="space-y-1">
                                {house.dealType === 'discount' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    💰 Discount
                                  </span>
                                )}
                                {house.dealType === 'needs_work' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                    🔨 Needs Work
                                  </span>
                                )}
                                {house.dealType === 'owner_finance' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    🏠 Owner Finance
                                  </span>
                                )}
                                {house.needsWork && house.needsWorkKeywords && house.needsWorkKeywords.length > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {house.needsWorkKeywords.slice(0, 3).join(', ')}
                                    {house.needsWorkKeywords.length > 3 && '...'}
                                  </div>
                                )}
                                {house.source && (
                                  <div className="text-xs text-gray-400">
                                    {house.source === 'zillow_scraper' && 'Zillow'}
                                    {house.source === 'cash_deals_scraper' && 'Cash'}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                {house.bedrooms} bed | {house.bathrooms} bath
                              </div>
                              <div className="text-xs text-gray-500">
                                {house.squareFoot?.toLocaleString() || 'N/A'} sqft
                              </div>
                              {house.agentPhoneNumber && (
                                <div className="text-xs text-indigo-600 mt-1">
                                  📞 {house.agentPhoneNumber}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <a
                                href={house.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-900 font-medium"
                              >
                                View on Zillow →
                              </a>
                            </td>
                          </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                          Showing {filteredHouses.length} of {cashHouses.length} total properties
                          {cashHousesFilter !== 'all' && (
                            <span className="ml-2 text-indigo-600 font-medium">
                              ({cashHousesFilter === 'discount' && 'Discount Deals'}
                              {cashHousesFilter === 'needs_work' && 'Needs Work'}
                              {cashHousesFilter === 'owner_finance' && 'Owner Finance'})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}


          {/* Buyer Preview Tab */}
          {activeTab === 'buyer-preview' && (
            <div className="fixed inset-0 z-50 left-0">
              {/* Exit Button */}
              <button
                onClick={() => setActiveTab('overview')}
                className="fixed top-4 left-4 z-header px-4 py-2 bg-slate-800/90 hover:bg-slate-700 text-white rounded-xl transition-colors font-semibold text-sm shadow-lg backdrop-blur-sm flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Exit Preview
              </button>

              {/* PropertySwiper2 Component - Modern Swiper with Optimized Performance */}
              <PropertySwiper2
                properties={previewProperties}
                onLike={() => {}} // Dummy handler for preview
                onPass={() => {}} // Dummy handler for preview
                favorites={[]}
                passedIds={[]}
                isLoading={loadingPreview}
              />
            </div>
          )}
        </main>
      </div>

      {/* Edit Property Modal */}
      {editingProperty && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Edit Property</h3>
                  <p className="text-slate-600 mt-1">Update property information and details</p>
                </div>
                <button
                  onClick={() => setEditingProperty(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Basic Info */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900 mb-4">Property Details</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                        <input
                          type="text"
                          value={editForm.address || ''}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                          <input
                            type="text"
                            value={editForm.city || ''}
                            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">State</label>
                          <input
                            type="text"
                            value={editForm.state || ''}
                            onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">ZIP Code</label>
                          <input
                            type="text"
                            value={editForm.zipCode || ''}
                            onChange={(e) => setEditForm({ ...editForm, zipCode: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Bedrooms</label>
                          <input
                            type="number"
                            value={editForm.bedrooms || ''}
                            onChange={(e) => setEditForm({ ...editForm, bedrooms: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Bathrooms</label>
                          <input
                            type="number"
                            step="0.5"
                            value={editForm.bathrooms || ''}
                            onChange={(e) => setEditForm({ ...editForm, bathrooms: parseFloat(e.target.value) })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Square Feet</label>
                          <input
                            type="number"
                            value={editForm.squareFeet || ''}
                            onChange={(e) => setEditForm({ ...editForm, squareFeet: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Financial Info */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900 mb-4">Financial Information</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">List Price</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium z-10 pointer-events-none">$</span>
                          <input
                            type="number"
                            value={editForm.listPrice || ''}
                            onChange={(e) => {
                              const newPrice = parseFloat(e.target.value) || 0;
                              handlePriceChange(newPrice);
                            }}
                            placeholder="169000"
                            className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Monthly Payment</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium z-10 pointer-events-none">$</span>
                            <input
                              type="number"
                              value={editForm.monthlyPayment || ''}
                              onChange={(e) => setEditForm({ ...editForm, monthlyPayment: parseFloat(e.target.value) })}
                              placeholder="1092"
                              className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Down Payment</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium z-10 pointer-events-none">$</span>
                            <input
                              type="number"
                              value={editForm.downPaymentAmount || ''}
                              onChange={(e) => setEditForm({ ...editForm, downPaymentAmount: parseFloat(e.target.value) })}
                              placeholder="16900"
                              className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Interest Rate and Down Payment Percentage */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Interest Rate</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={editForm.interestRate || ''}
                              onChange={(e) => {
                                const newRate = parseFloat(e.target.value) || 0;
                                handleInterestRateChange(newRate);
                              }}
                              placeholder="6.75"
                              className="w-full pr-10 pl-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                            />
                            <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">%</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Down Payment %</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.1"
                              value={editForm.downPaymentPercent ? Math.round(editForm.downPaymentPercent * 100) / 100 : ''}
                              onChange={(e) => {
                                const newPercent = parseFloat(e.target.value) || 0;
                                handleDownPaymentPercentChange(newPercent);
                              }}
                              placeholder="10"
                              className="w-full pr-10 pl-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                            />
                            <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">%</span>
                          </div>
                        </div>
                      </div>

                      {/* Term Years (Amortization) */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Amortization Term Years</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max="40"
                            value={editForm.termYears || ''}
                            onChange={(e) => setEditForm({ ...editForm, termYears: parseInt(e.target.value) || undefined })}
                            placeholder="Auto-calculated based on price"
                            className="w-full pr-16 pl-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          />
                          <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">years</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">Leave blank for auto: &lt;150k=15yr, 150-300k=20yr, 300-600k=25yr, 600k+=30yr</p>
                      </div>

                      {/* Balloon Year Term */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Balloon Year Term</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max="30"
                            value={editForm.balloonYears || ''}
                            onChange={(e) => setEditForm({ ...editForm, balloonYears: parseInt(e.target.value) || undefined })}
                            placeholder="5"
                            className="w-full pr-16 pl-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          />
                          <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">years</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">Number of years until balloon payment is due (if applicable)</p>
                      </div>

                      {/* Image URL Field */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Property Image URL</label>
                        <input
                          type="url"
                          value={editForm.imageUrl || ''}
                          onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                          placeholder="https://example.com/image.jpg"
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        />
                        {(editForm.imageUrl || editingProperty.imageUrl || (editingProperty as any).imageUrls?.[0]) && (
                          <div className="mt-3">
                            <Image
                              src={convertToDirectImageUrl(editForm.imageUrl || editingProperty.imageUrl || (editingProperty as any).imageUrls?.[0]) || '/placeholder-house.svg'}
                              alt="Property preview"
                              width={300}
                              height={200}
                              className="rounded-lg border border-slate-200 object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/placeholder-house.jpg';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-slate-200">
                <button
                  onClick={() => setEditingProperty(null)}
                  className="px-6 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const formDataWithConvertedUrl = {
                      ...editForm,
                      imageUrl: editForm.imageUrl ? convertToDirectImageUrl(editForm.imageUrl) : editForm.imageUrl
                    };
                    await fetch(`/api/admin/properties/${editingProperty.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(formDataWithConvertedUrl)
                    });
                    setEditingProperty(null);
                    fetchProperties(undefined, false);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-105 shadow-lg"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}