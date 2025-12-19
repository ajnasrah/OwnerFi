'use client';

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LeadDispute } from '@/lib/firebase-models';
import { PropertyListing } from '@/lib/property-schema';
import Image from 'next/image';
import { calculatePropertyFinancials } from '@/lib/property-calculations';
import { useDropzone } from 'react-dropzone';
import { convertToDirectImageUrl } from '../lib/image-utils';

// Lazy load tab components
const PropertiesTab = lazy(() => import('../components/PropertiesTab'));

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
  const [activeTab, setActiveTab] = useState<'overview' | 'properties' | 'upload' | 'disputes' | 'contacts' | 'buyers' | 'realtors' | 'social'>('overview');

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
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);
  const [uploadMode, setUploadMode] = useState<'csv' | 'manual' | 'scraper' | 'new-properties'>('csv');
  const [manualPropertyData, setManualPropertyData] = useState<Partial<AdminProperty>>({
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
    totalFiles?: number;
  }>({
    status: 'idle',
    message: 'Upload an Excel or CSV file to begin',
  });

  // Quick add URL state
  const [quickUrl, setQuickUrl] = useState('');
  const [quickResults, setQuickResults] = useState<Array<{
    url: string;
    status: 'pending' | 'adding' | 'added' | 'exists' | 'error';
    message?: string;
  }>>([]);
  const [quickAdding, setQuickAdding] = useState(false);

  const handleQuickAdd = async () => {
    const urls = quickUrl
      .split(/[\n,]/)
      .map(u => u.trim())
      .filter(u => u.includes('zillow.com'));

    if (urls.length === 0) {
      alert('No valid Zillow URLs found');
      return;
    }

    setQuickAdding(true);
    setQuickResults(urls.map(url => ({ url, status: 'pending' })));

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      setQuickResults(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'adding' } : r
      ));

      try {
        const response = await fetch('/api/v2/scraper/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed');
        }

        // Check results from v2 endpoint
        const result = data.results?.[0];
        if (result?.skipped && result?.skipReason?.includes('Duplicate')) {
          setQuickResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, status: 'exists', message: result.skipReason } : r
          ));
        } else if (result?.skipped) {
          setQuickResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, status: 'error', message: result.skipReason || 'Skipped' } : r
          ));
        } else if (result?.savedTo?.length > 0) {
          setQuickResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, status: 'added', message: `Added as ${result.savedTo.join(', ')}` } : r
          ));
        } else {
          throw new Error(result?.error || 'No results returned');
        }
      } catch (error) {
        setQuickResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'error', message: error instanceof Error ? error.message : 'Unknown error' } : r
        ));
      }

      if (i < urls.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    setQuickAdding(false);
    setQuickUrl('');
  };

  // New Properties state (zillow_imports collection)
  interface NewProperty {
    id: string;
    url?: string;
    streetAddress?: string;
    fullAddress?: string;
    city?: string;
    state?: string;
    price?: number;
    bedrooms?: number;
    bathrooms?: number;
    squareFeet?: number;
  }
  const [newPropertiesData, setNewPropertiesData] = useState<NewProperty[]>([]);
  const [loadingNewProperties, setLoadingNewProperties] = useState(false);
  const [exportingGHL, setExportingGHL] = useState(false);
  const [sendingToGHL, setSendingToGHL] = useState(false);
  const [ghlSendResult, setGhlSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // Disputes state
  const [disputes, setDisputes] = useState<LeadDispute[]>([]);

  // Contacts state
  interface Contact {
    id: string;
    name?: string;
    email?: string;
    message?: string;
    createdAt?: unknown;
  }
  const [contacts, setContacts] = useState<Contact[]>([]);
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

  // Edit modal state - extra fields
  const [newImageUrl, setNewImageUrl] = useState('');

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
      // Use countOnly=true for fast count queries
      const [propData, buyersData, realtorsData, disputesData] = await Promise.all([
        fetch('/api/admin/properties?countOnly=true').then(r => r.json()),
        fetch('/api/admin/buyers?countOnly=true').then(r => r.json()),
        fetch('/api/admin/realtors?countOnly=true').then(r => r.json()),
        fetch('/api/admin/disputes').then(r => r.json())
      ]);

      setStats({
        totalProperties: propData.total || 0,
        totalBuyers: buyersData.total || 0,
        totalRealtors: realtorsData.total || 0,
        pendingDisputes: disputesData.stats?.pending || disputesData.pendingDisputes?.length || 0
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
      setStats(prev => ({ ...prev, totalRealtors: data.total || data.realtors?.length || 0 }));
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
    }
  }, [activeTab]);

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

    } catch (error) {
      setScraperProgress({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload files',
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg font-medium text-white">Loading Admin Dashboard</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-900 flex flex-col md:flex-row">
      {/* Mobile Dropdown Navigation */}
      <div className="md:hidden bg-slate-800 border-b border-slate-700 p-4">
        <Link href="/admin" className="text-emerald-400 hover:text-emerald-300 text-sm mb-2 inline-flex items-center gap-1">
          ← Back to Hub
        </Link>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 bg-slate-800 rounded-sm"></div>
            </div>
            <h1 className="text-lg font-bold text-white">OwnerFi Admin</h1>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signout' })}
            className="text-slate-400 hover:text-red-600"
            title="Sign Out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as 'overview' | 'properties' | 'upload' | 'disputes' | 'contacts' | 'buyers' | 'realtors' | 'social')}
          className="w-full px-4 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="overview">📊 Overview</option>
          <option value="properties">🏠 Properties {stats.totalProperties > 0 ? `(${stats.totalProperties})` : ''}</option>
          <option value="upload">📤 Upload</option>
          <option value="buyers">👤 Buyers {stats.totalBuyers > 0 ? `(${stats.totalBuyers})` : ''}</option>
          <option value="realtors">🏢 Realtors {stats.totalRealtors > 0 ? `(${stats.totalRealtors})` : ''}</option>
          <option value="disputes">⚖️ Disputes {stats.pendingDisputes > 0 ? `(${stats.pendingDisputes})` : ''}</option>
          <option value="contacts">📧 Contacts</option>
          <option value="social">📱 Social & Articles</option>
        </select>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 lg:w-72 bg-slate-800 shadow-xl border-r border-slate-700 flex-shrink-0 relative flex-col h-screen">
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-700 flex-shrink-0">
          <Link href="/admin" className="text-emerald-400 hover:text-emerald-300 text-sm mb-2 inline-flex items-center gap-1">
            ← Back to Hub
          </Link>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <div className="w-5 h-5 bg-slate-800 rounded-md"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">OwnerFi</h1>
              <p className="text-sm text-slate-500">Admin Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {[
            { key: 'overview', label: 'Overview', icon: '📊', count: null },
            { key: 'properties', label: 'Properties', icon: '🏠', count: stats.totalProperties },
            { key: 'upload', label: 'Upload', icon: '📤', count: null },
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
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg transform scale-[1.02]'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </div>
              {tab.count !== null && tab.count > 0 && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  activeTab === tab.key
                    ? 'bg-slate-800/20 text-white'
                    : tab.key === 'disputes'
                    ? 'bg-red-100 text-red-700 animate-pulse'
                    : 'bg-slate-200 text-slate-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* External Dashboards */}
        <div className="p-4 space-y-2 border-t border-slate-700 flex-shrink-0">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
            Dashboards
          </div>
          <Link
            href="/admin/analytics"
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <span className="text-lg">📈</span>
            <span className="font-medium">Analytics</span>
          </Link>
          <Link
            href="/admin/costs"
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <span className="text-lg">💰</span>
            <span className="font-medium">Cost Tracking</span>
          </Link>
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-slate-700 bg-slate-800 flex-shrink-0 mt-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-slate-400">System Online</span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signout' })}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
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
        <header className="bg-slate-800 shadow-sm border-b border-slate-700 px-4 md:px-6 lg:px-8 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">
                {activeTab === 'overview' && 'Dashboard Overview'}
                {activeTab === 'properties' && 'Property Management'}
                {activeTab === 'upload' && 'Upload Properties'}
                {activeTab === 'buyers' && 'Buyer Management'}
                {activeTab === 'realtors' && 'Realtor Management'}
                {activeTab === 'disputes' && 'Dispute Resolution'}
                {activeTab === 'contacts' && 'Contact Submissions'}
                {activeTab === 'social' && 'Social Media & Articles'}
              </h2>
              <p className="text-sm md:text-base text-slate-400 mt-1">
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
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-slate-600 shadow-sm"
                >
                  {loadingProperties ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-20 md:pb-8 bg-slate-900 md:overflow-y-auto w-full">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-slate-800 overflow-hidden shadow rounded-lg">
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
                          <dt className="text-sm font-medium text-slate-400 truncate">Total Properties</dt>
                          <dd className="text-lg font-medium text-white">{stats.totalProperties.toLocaleString()}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 overflow-hidden shadow rounded-lg">
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
                          <dt className="text-sm font-medium text-slate-400 truncate">Active Buyers</dt>
                          <dd className="text-lg font-medium text-white">{stats.totalBuyers.toLocaleString()}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-emerald-900/300 rounded-md flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 2h6v4H7V6zm8 8v2h1v-2h-1zm-2-2H7v4h6v-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-slate-400 truncate">Active Realtors</dt>
                          <dd className="text-lg font-medium text-white">{stats.totalRealtors.toLocaleString()}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                          stats.pendingDisputes > 0 ? 'bg-red-500' : 'bg-slate-600'
                        }`}>
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-slate-400 truncate">Pending Disputes</dt>
                          <dd className="text-lg font-medium text-white">{stats.pendingDisputes}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-slate-800 shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-white mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="relative group bg-slate-700 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-emerald-500 rounded-lg hover:bg-slate-600 transition-colors"
                    >
                      <div>
                        <span className="rounded-lg inline-flex p-3 bg-emerald-900/30 text-emerald-400 group-hover:bg-emerald-800">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </span>
                      </div>
                      <div className="mt-8">
                        <h3 className="text-lg font-medium text-white">Upload Properties</h3>
                        <p className="mt-2 text-sm text-slate-400">Upload new property listings via CSV file</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('properties')}
                      className="relative group bg-slate-700 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-emerald-500 rounded-lg hover:bg-slate-600 transition-colors"
                    >
                      <div>
                        <span className="rounded-lg inline-flex p-3 bg-green-900/30 text-green-400 group-hover:bg-green-800/50">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.707 2.293a1 1 0 00-1.414 0l-9 9a1 1 0 001.414 1.414L2 12.414V17a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1v-4.586l.293.293a1 1 0 001.414-1.414l-9-9z" />
                          </svg>
                        </span>
                      </div>
                      <div className="mt-8">
                        <h3 className="text-lg font-medium text-white">Manage Properties</h3>
                        <p className="mt-2 text-sm text-slate-400">View, edit, and manage all property listings</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('disputes')}
                      className="relative group bg-slate-700 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-emerald-500 rounded-lg hover:bg-slate-600 transition-colors"
                    >
                      <div>
                        <span className={`rounded-lg inline-flex p-3 ${
                          stats.pendingDisputes > 0
                            ? 'bg-red-900/30 text-red-400 group-hover:bg-red-800/50'
                            : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600'
                        }`}>
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </div>
                      <div className="mt-8">
                        <h3 className="text-lg font-medium text-white">Resolve Disputes</h3>
                        <p className="mt-2 text-sm text-slate-400">
                          {stats.pendingDisputes > 0
                            ? `${stats.pendingDisputes} pending dispute${stats.pendingDisputes > 1 ? 's' : ''}`
                            : 'No pending disputes'
                          }
                        </p>
                      </div>
                    </button>

                    <Link
                      href="/admin/analytics"
                      className="relative group bg-slate-700 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg hover:bg-slate-600 transition-colors"
                    >
                      <div>
                        <span className="rounded-lg inline-flex p-3 bg-blue-500 text-white group-hover:bg-blue-600">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </span>
                      </div>
                      <div className="mt-8">
                        <h3 className="text-lg font-medium text-white">Analytics Dashboard</h3>
                        <p className="mt-2 text-sm text-slate-400">View social media performance insights</p>
                      </div>
                    </Link>

                    <Link
                      href="/admin/costs"
                      className="relative group bg-slate-700 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-green-500 rounded-lg hover:bg-slate-600 transition-colors"
                    >
                      <div>
                        <span className="rounded-lg inline-flex p-3 bg-green-500 text-white group-hover:bg-green-600">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                      </div>
                      <div className="mt-8">
                        <h3 className="text-lg font-medium text-white">Cost Dashboard</h3>
                        <p className="mt-2 text-sm text-slate-400">Track API costs and budget usage</p>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Properties Tab */}
          {activeTab === 'properties' && (
            <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="text-slate-400">Loading properties...</div></div>}>
              <PropertiesTab
                setEditingProperty={setEditingProperty as any}
                setEditForm={setEditForm as any}
              />
            </Suspense>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="max-w-4xl mx-auto">
              {/* Mode Toggle */}
              <div className="bg-slate-800 shadow rounded-lg p-4 mb-6">
                <div className="flex space-x-3">
                  <button
                    onClick={() => { setUploadMode('csv'); setUploadResult(null); }}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      uploadMode === 'csv'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    📄 CSV Upload
                  </button>
                  <button
                    onClick={() => { setUploadMode('scraper'); setUploadResult(null); }}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      uploadMode === 'scraper'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    🤖 Zillow Scraper
                  </button>
                  <button
                    onClick={() => { setUploadMode('new-properties'); setUploadResult(null); }}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      uploadMode === 'new-properties'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    ✨ New Properties
                  </button>
                  <button
                    onClick={() => { setUploadMode('manual'); setUploadResult(null); }}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      uploadMode === 'manual'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    ✏️ Manual Entry
                  </button>
                </div>
              </div>

              {/* CSV Upload Mode */}
              {uploadMode === 'csv' && (
                <div className="bg-slate-800 shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-white mb-6">Upload Property CSV File</h3>

                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-600 border-dashed rounded-md">
                      <div className="space-y-1 text-center">
                        <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="flex text-sm text-slate-400">
                          <label htmlFor="file-upload" className="relative cursor-pointer bg-slate-800 rounded-md font-medium text-emerald-400 hover:text-emerald-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                            <span>{file ? file.name : 'Upload a file'}</span>
                            <input
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              accept=".csv"
                              onChange={handleFileChange}
                              className="sr-only"
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-slate-400">CSV files only</p>
                      </div>
                    </div>

                    {file && (
                      <div className="mt-6">
                        <button
                          onClick={handleUpload}
                          disabled={uploading}
                          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-slate-600"
                        >
                          {uploading ? 'Uploading...' : 'Upload Properties'}
                        </button>
                      </div>
                    )}

                    {uploadResult && (
                      <div className={`mt-6 rounded-md p-4 ${uploadResult.error ? 'bg-red-50' : 'bg-green-50'}`}>
                        <div className="flex">
                          <div className="flex-shrink-0">
                            {uploadResult.error ? (
                              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div className="ml-3">
                            <h3 className={`text-sm font-medium ${uploadResult.error ? 'text-red-800' : 'text-green-800'}`}>
                              {uploadResult.error ? 'Upload Failed' : 'Upload Successful'}
                            </h3>
                            <div className={`mt-2 text-sm ${uploadResult.error ? 'text-red-700' : 'text-green-700'}`}>
                              {uploadResult.error ? (
                                <p>{uploadResult.error}</p>
                              ) : (
                                <p>Successfully uploaded {uploadResult.summary?.successfulInserts} of {uploadResult.summary?.totalRows} properties</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Zillow Scraper Mode */}
              {uploadMode === 'scraper' && (
                <div className="space-y-6">
                  {/* Quick Add URLs Section */}
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-2 text-white">Quick Add URLs</h3>
                    <p className="text-sm text-slate-400 mb-4">Paste Zillow URLs (one per line) to add to scraper queue</p>

                    <textarea
                      value={quickUrl}
                      onChange={(e) => setQuickUrl(e.target.value)}
                      placeholder="https://www.zillow.com/homedetails/123-Main-St/12345678_zpid/"
                      className="w-full h-24 bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm font-mono"
                      disabled={quickAdding}
                    />

                    <div className="mt-3 flex items-center gap-4">
                      <button
                        onClick={handleQuickAdd}
                        disabled={quickAdding || !quickUrl.trim()}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                          quickAdding || !quickUrl.trim()
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {quickAdding ? 'Adding...' : 'Add to Queue'}
                      </button>

                      {quickResults.length > 0 && (
                        <span className="text-sm text-slate-400">
                          {quickResults.filter(r => r.status === 'added').length} added,{' '}
                          {quickResults.filter(r => r.status === 'exists').length} already exist
                        </span>
                      )}
                    </div>

                    {/* Quick add results */}
                    {quickResults.length > 0 && (
                      <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                        {quickResults.map((result, idx) => (
                          <div
                            key={idx}
                            className={`text-sm px-3 py-2 rounded flex items-center justify-between ${
                              result.status === 'added'
                                ? 'bg-emerald-900/30 text-emerald-300'
                                : result.status === 'exists'
                                ? 'bg-yellow-900/30 text-yellow-300'
                                : result.status === 'error'
                                ? 'bg-red-900/30 text-red-300'
                                : result.status === 'adding'
                                ? 'bg-blue-900/30 text-blue-300'
                                : 'bg-slate-700 text-slate-400'
                            }`}
                          >
                            <span className="truncate flex-1 font-mono text-xs">{result.url.slice(0, 70)}...</span>
                            <span className="ml-2 whitespace-nowrap">
                              {result.status === 'adding' && '...'}
                              {result.status === 'added' && '✓ Added'}
                              {result.status === 'exists' && '⚠ Exists'}
                              {result.status === 'error' && '✗ Error'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-700"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 bg-slate-900 text-slate-500 text-sm">or upload a file</span>
                    </div>
                  </div>

                  {/* Dropzone */}
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors bg-slate-800 shadow ${
                      isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-600 hover:border-gray-400'
                    } ${
                      scraperProgress.status === 'uploading' || scraperProgress.status === 'scraping' ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <input {...getInputProps()} />

                    <div className="mb-4">
                      <svg
                        className="mx-auto h-12 w-12 text-slate-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>

                    {isDragActive ? (
                      <p className="text-lg text-blue-600">Drop the files here...</p>
                    ) : (
                      <div>
                        <p className="text-lg mb-2">Drag & drop Excel or CSV files here</p>
                        <p className="text-sm text-slate-400">or click to select files (multiple files supported)</p>
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  {scraperProgress.status !== 'idle' && (
                    <div
                      className={`p-6 rounded-lg border-2 bg-slate-800 shadow ${
                        scraperProgress.status === 'error'
                          ? 'bg-red-50 border-red-200'
                          : scraperProgress.status === 'complete'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start">
                        {scraperProgress.status === 'uploading' || scraperProgress.status === 'scraping' ? (
                          <div className="mr-3">
                            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                          </div>
                        ) : scraperProgress.status === 'complete' ? (
                          <svg
                            className="h-6 w-6 text-green-600 mr-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : scraperProgress.status === 'error' ? (
                          <svg
                            className="h-6 w-6 text-red-600 mr-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        ) : null}

                        <div className="flex-1">
                          <p className="font-semibold text-lg mb-1">{scraperProgress.message}</p>

                          <div className="mt-3 space-y-1">
                            {scraperProgress.urlsFound !== undefined && (
                              <p className="text-sm text-slate-300">
                                <span className="font-medium">URLs in file:</span> {scraperProgress.urlsFound}
                              </p>
                            )}

                            {scraperProgress.duplicatesInFile !== undefined && scraperProgress.duplicatesInFile > 0 && (
                              <p className="text-sm text-orange-700">
                                <span className="font-medium">Duplicates in file:</span> {scraperProgress.duplicatesInFile}
                              </p>
                            )}

                            {scraperProgress.alreadyInDatabase !== undefined && scraperProgress.alreadyInDatabase > 0 && (
                              <p className="text-sm text-orange-700">
                                <span className="font-medium">Already in database:</span> {scraperProgress.alreadyInDatabase}
                              </p>
                            )}

                            {scraperProgress.newProperties !== undefined && (
                              <p className="text-sm text-green-700 font-medium">
                                <span>New properties:</span> {scraperProgress.newProperties}
                              </p>
                            )}

                            {scraperProgress.propertiesScraped !== undefined && (
                              <p className="text-sm text-slate-300 mt-2">
                                <span className="font-medium">Properties imported:</span> {scraperProgress.propertiesScraped}
                                {scraperProgress.total && ` / ${scraperProgress.total}`}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="bg-slate-700 p-6 rounded-lg shadow">
                    <h2 className="text-lg font-semibold mb-3">How it works</h2>
                    <ol className="list-decimal list-inside space-y-2 text-slate-300">
                      <li>Upload one or multiple CSV/Excel files containing Zillow property URLs</li>
                      <li>The system combines all files and automatically removes duplicates</li>
                      <li>Checks against existing properties in the database</li>
                      <li>Only new properties are sent to Apify for scraping</li>
                      <li>All data is saved to the <code className="bg-slate-600 px-2 py-1 rounded">zillow_imports</code> collection</li>
                      <li>Review imported properties in Firebase before moving to production</li>
                    </ol>

                    <div className="mt-4 p-4 bg-purple-100 rounded">
                      <p className="text-sm font-medium text-purple-900 mb-1">🔄 Batch Upload Support</p>
                      <p className="text-sm text-purple-800">
                        You can upload multiple files at once (up to 20+ files). The system will process all files together, combining URLs and removing duplicates across all files.
                      </p>
                    </div>

                    <div className="mt-4 p-4 bg-green-100 rounded">
                      <p className="text-sm font-medium text-green-900 mb-1">✓ Duplicate Protection</p>
                      <p className="text-sm text-green-800">
                        The scraper automatically prevents importing duplicate properties. It checks both within your files and against existing database records.
                      </p>
                    </div>

                    <div className="mt-4 p-4 bg-blue-100 rounded">
                      <p className="text-sm font-medium text-blue-900 mb-1">Expected File Format</p>
                      <p className="text-sm text-blue-800">
                        Your file should have a column named <strong>URL</strong>, <strong>url</strong>, or{' '}
                        <strong>link</strong> containing Zillow property URLs
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* New Properties Mode */}
              {uploadMode === 'new-properties' && (
                <div className="space-y-6">
                  {/* Header with Retry Button */}
                  <div className="bg-slate-800 shadow rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-lg leading-6 font-medium text-white">⚠️ Failed GHL Webhook Sends</h3>
                        <p className="mt-1 text-sm text-slate-400">
                          Properties that failed to send to GoHighLevel - {newPropertiesData.length} total
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleSendToGHL}
                          disabled={sendingToGHL || newPropertiesData.length === 0}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                        >
                          {sendingToGHL ? 'Retrying...' : '🔄 Retry Send to GHL'}
                        </button>
                      </div>
                    </div>

                    {/* Loading State */}
                    {loadingNewProperties && (
                      <div className="text-center py-12">
                        <div className="animate-spin inline-block h-8 w-8 border-4 border-emerald-400 border-t-transparent rounded-full"></div>
                        <p className="mt-4 text-gray-600">Loading failed properties...</p>
                      </div>
                    )}

                    {/* Empty State */}
                    {!loadingNewProperties && newPropertiesData.length === 0 && (
                      <div className="text-center py-12">
                        <p className="text-green-600 font-medium">✅ No failed sends!</p>
                        <p className="text-sm text-slate-400 mt-2">All properties with contact info have been successfully sent to GHL.</p>
                      </div>
                    )}

                    {/* Properties Table */}
                    {!loadingNewProperties && newPropertiesData.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-slate-700">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Address
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                City
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                State
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Price
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Beds
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Baths
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Sq Ft
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Imported
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-slate-800 divide-y divide-gray-200">
                            {newPropertiesData.map((property) => (
                              <tr key={property.id} className="hover:bg-slate-700">
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                                  <a
                                    href={property.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 hover:text-emerald-300 hover:underline"
                                  >
                                    {property.streetAddress || property.fullAddress || 'N/A'}
                                  </a>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-400">
                                  {property.city || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-400">
                                  {property.state || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-medium">
                                  ${property.price?.toLocaleString() || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-400">
                                  {property.bedrooms || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-400">
                                  {property.bathrooms || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-400">
                                  {property.squareFoot?.toLocaleString() || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-400">
                                  {property.buildingType || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-400">
                                  {(() => {
                                    const ts = property.importedAt as any;
                                    if (!ts) return 'N/A';
                                    if (typeof ts === 'object' && typeof ts._seconds === 'number') return new Date(ts._seconds * 1000).toLocaleDateString();
                                    const date = new Date(ts);
                                    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
                                  })()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">ℹ️ GHL Export Format</h4>
                    <p className="text-sm text-blue-800">
                      Click "Export to GHL Format" to download an Excel file formatted for GoHighLevel import.
                      The export includes all required custom fields: property_id, property_address, property_city,
                      property_state, property_zip, property_price, property_bedrooms, property_bathrooms,
                      property_sqft, and property_image_url.
                    </p>
                  </div>
                </div>
              )}

              {/* Manual Entry Mode */}
              {uploadMode === 'manual' && (
                <div className="bg-slate-800 shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-white mb-6">Add Property Manually</h3>

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setUploading(true);
                      setUploadResult(null);

                      try {
                        const response = await fetch('/api/admin/properties/create', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(manualPropertyData)
                        });

                        const data = await response.json();

                        if (response.ok) {
                          setUploadResult({ success: true, propertyId: data.propertyId });
                          setManualPropertyData({
                            propertyType: 'single-family',
                            status: 'active',
                            isActive: true,
                            priority: 5
                          });
                          fetchProperties();
                        } else {
                          setUploadResult({ error: data.error });
                        }
                      } catch (error) {
                        setUploadResult({ error: 'Failed to create property' });
                      } finally {
                        setUploading(false);
                      }
                    }} className="space-y-6">
                      {/* Address Section */}
                      <div className="border-b border-slate-700 pb-6">
                        <h4 className="text-md font-semibold text-white mb-4">Address & Location</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300">Street Address *</label>
                            <input
                              type="text"
                              required
                              value={manualPropertyData.address || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, address: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">City *</label>
                            <input
                              type="text"
                              required
                              value={manualPropertyData.city || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, city: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">State *</label>
                            <input
                              type="text"
                              required
                              maxLength={2}
                              value={manualPropertyData.state || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, state: e.target.value.toUpperCase() })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">ZIP Code *</label>
                            <input
                              type="text"
                              required
                              value={manualPropertyData.zipCode || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, zipCode: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Property Details */}
                      <div className="border-b border-slate-700 pb-6">
                        <h4 className="text-md font-semibold text-white mb-4">Property Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Property Type *</label>
                            <select
                              required
                              value={manualPropertyData.propertyType || 'single-family'}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, propertyType: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            >
                              <option value="single-family">Single Family</option>
                              <option value="condo">Condo</option>
                              <option value="townhouse">Townhouse</option>
                              <option value="mobile-home">Mobile Home</option>
                              <option value="multi-family">Multi-Family</option>
                              <option value="land">Land</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Bedrooms *</label>
                            <input
                              type="number"
                              required
                              min="0"
                              value={manualPropertyData.bedrooms || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, bedrooms: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Bathrooms *</label>
                            <input
                              type="number"
                              required
                              min="0"
                              step="0.5"
                              value={manualPropertyData.bathrooms || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, bathrooms: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Square Feet</label>
                            <input
                              type="number"
                              min="0"
                              value={manualPropertyData.squareFeet || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, squareFeet: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Year Built</label>
                            <input
                              type="number"
                              min="1800"
                              max={new Date().getFullYear() + 1}
                              value={manualPropertyData.yearBuilt || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, yearBuilt: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Financial Information */}
                      <div className="border-b border-slate-700 pb-6">
                        <h4 className="text-md font-semibold text-white mb-4">Financial Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300">List Price * ($)</label>
                            <input
                              type="number"
                              required
                              min="0"
                              value={manualPropertyData.listPrice || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, listPrice: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Down Payment * ($)</label>
                            <input
                              type="number"
                              required
                              min="0"
                              value={manualPropertyData.downPaymentAmount || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, downPaymentAmount: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Down Payment * (%)</label>
                            <input
                              type="number"
                              required
                              min="0"
                              max="100"
                              step="0.1"
                              value={manualPropertyData.downPaymentPercent || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, downPaymentPercent: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Monthly Payment * ($)</label>
                            <input
                              type="number"
                              required
                              min="0"
                              value={manualPropertyData.monthlyPayment || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, monthlyPayment: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Interest Rate * (%)</label>
                            <input
                              type="number"
                              required
                              min="0"
                              max="100"
                              step="0.01"
                              value={manualPropertyData.interestRate || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, interestRate: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Term * (Years)</label>
                            <input
                              type="number"
                              required
                              min="1"
                              max="50"
                              value={manualPropertyData.termYears || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, termYears: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Description & Images */}
                      <div className="border-b border-slate-700 pb-6">
                        <h4 className="text-md font-semibold text-white mb-4">Description & Media</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Description</label>
                            <textarea
                              rows={4}
                              value={manualPropertyData.description || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, description: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                              placeholder="Property description..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Image URLs (comma-separated)</label>
                            <textarea
                              rows={2}
                              value={manualPropertyData.imageUrls || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, imageUrls: e.target.value })}
                              className="mt-1 block w-full border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                              placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <div className="flex items-center justify-end space-x-4">
                        <button
                          type="button"
                          onClick={() => {
                            setManualPropertyData({
                              propertyType: 'single-family',
                              status: 'active',
                              isActive: true,
                              priority: 5
                            });
                          }}
                          className="px-4 py-2 border border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                        >
                          Reset Form
                        </button>
                        <button
                          type="submit"
                          disabled={uploading}
                          className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-slate-600"
                        >
                          {uploading ? 'Creating...' : 'Create Property'}
                        </button>
                      </div>
                    </form>

                    {/* Result Message */}
                    {uploadResult && (
                      <div className={`mt-6 rounded-md p-4 ${uploadResult.error ? 'bg-red-50' : 'bg-green-50'}`}>
                        <div className="flex">
                          <div className="flex-shrink-0">
                            {uploadResult.error ? (
                              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div className="ml-3">
                            <h3 className={`text-sm font-medium ${uploadResult.error ? 'text-red-800' : 'text-green-800'}`}>
                              {uploadResult.error ? 'Creation Failed' : 'Property Created Successfully'}
                            </h3>
                            <div className={`mt-2 text-sm ${uploadResult.error ? 'text-red-700' : 'text-green-700'}`}>
                              {uploadResult.error ? (
                                <p>{uploadResult.error}</p>
                              ) : (
                                <p>Property ID: {uploadResult.propertyId}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Buyers Tab */}
          {activeTab === 'buyers' && (
            <div className="bg-slate-800 shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                {/* Filter Section */}
                <div className="mb-6 bg-slate-700 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-3">🔍 Filter Buyers</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">City</label>
                      <input
                        type="text"
                        value={cityFilter}
                        onChange={(e) => setCityFilter(e.target.value)}
                        placeholder="Enter city name (e.g., Memphis, Dallas...)"
                        className="w-full px-3 py-2 border border-slate-600 rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">State</label>
                      <input
                        type="text"
                        value={stateFilter}
                        onChange={(e) => setStateFilter(e.target.value)}
                        placeholder="Enter state (e.g., TX, TN, CA...)"
                        className="w-full px-3 py-2 border border-slate-600 rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        maxLength={2}
                      />
                    </div>
                  </div>
                  {(cityFilter || stateFilter) && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-slate-400">
                        Showing {filteredBuyers.length} of {buyers.length} buyers
                      </span>
                      <button
                        onClick={() => {
                          setCityFilter('');
                          setStateFilter('');
                        }}
                        className="text-sm text-emerald-400 hover:text-emerald-400"
                      >
                        ✕ Clear filters
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg leading-6 font-medium text-white">Registered Buyers</h3>
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <input
                        type="checkbox"
                        checked={filteredBuyers.length > 0 && selectedBuyers.length === filteredBuyers.length}
                        onChange={() => {
                          if (selectedBuyers.length === filteredBuyers.length) {
                            setSelectedBuyers([]);
                          } else {
                            setSelectedBuyers(filteredBuyers.map(b => b.userId));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-600 text-emerald-400 focus:ring-indigo-500"
                      />
                      Select All
                    </label>
                    {selectedBuyers.length > 0 && (
                      <span className="text-sm text-slate-400">
                        {selectedBuyers.length} selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedBuyers.length > 0 && (
                      <button
                        onClick={async () => {
                          if (confirm(`Delete ${selectedBuyers.length} selected buyers? This action cannot be undone.`)) {
                            try {
                              const response = await fetch('/api/admin/buyers', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ buyerIds: selectedBuyers })
                              });
                              if (response.ok) {
                                const result = await response.json();
                                alert(`Successfully deleted ${result.deletedCount} buyer(s)`);
                                setSelectedBuyers([]);
                                fetchBuyers();
                              } else {
                                const error = await response.json();
                                alert(`Error: ${error.error}`);
                              }
                            } catch (error) {
                              alert('Failed to delete buyers');
                              console.error('Delete error:', error);
                            }
                          }
                        }}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Delete {selectedBuyers.length} Selected
                      </button>
                    )}
                    <button
                      onClick={fetchBuyers}
                      disabled={loadingBuyers}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-slate-600"
                    >
                      {loadingBuyers ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto bg-slate-800 shadow sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    {/* Table Header */}
                    <thead className="bg-slate-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-12">
                          {/* Checkbox column */}
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => {
                            if (buyerSortField === 'name') {
                              setBuyerSortDirection(buyerSortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setBuyerSortField('name');
                              setBuyerSortDirection('asc');
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            Name
                            {buyerSortField === 'name' && (
                              <span>{buyerSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-24"
                          onClick={() => {
                            if (buyerSortField === 'matched') {
                              setBuyerSortDirection(buyerSortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setBuyerSortField('matched');
                              setBuyerSortDirection('desc');
                            }
                          }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Matched
                            {buyerSortField === 'matched' && (
                              <span>{buyerSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-24"
                          onClick={() => {
                            if (buyerSortField === 'liked') {
                              setBuyerSortDirection(buyerSortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setBuyerSortField('liked');
                              setBuyerSortDirection('desc');
                            }
                          }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Liked
                            {buyerSortField === 'liked' && (
                              <span>{buyerSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-32"
                          onClick={() => {
                            if (buyerSortField === 'budget') {
                              setBuyerSortDirection(buyerSortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setBuyerSortField('budget');
                              setBuyerSortDirection('desc');
                            }
                          }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Budget/mo
                            {buyerSortField === 'budget' && (
                              <span>{buyerSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-32"
                          onClick={() => {
                            if (buyerSortField === 'downpay') {
                              setBuyerSortDirection(buyerSortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setBuyerSortField('downpay');
                              setBuyerSortDirection('desc');
                            }
                          }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Down Pay
                            {buyerSortField === 'downpay' && (
                              <span>{buyerSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    {/* Table Body */}
                    <tbody className="bg-slate-800 divide-y divide-gray-200">
                      {[...filteredBuyers].sort((a, b) => {
                        let aVal: string | number, bVal: string | number;
                        switch (buyerSortField) {
                          case 'name':
                            aVal = (a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : a.email).toLowerCase();
                            bVal = (b.firstName && b.lastName ? `${b.firstName} ${b.lastName}` : b.email).toLowerCase();
                            break;
                          case 'matched':
                            aVal = a.matchedPropertiesCount || 0;
                            bVal = b.matchedPropertiesCount || 0;
                            break;
                          case 'liked':
                            aVal = a.likedPropertiesCount || 0;
                            bVal = b.likedPropertiesCount || 0;
                            break;
                          case 'budget':
                            aVal = a.maxMonthlyPayment || a.monthlyBudget || 0;
                            bVal = b.maxMonthlyPayment || b.monthlyBudget || 0;
                            break;
                          case 'downpay':
                            aVal = a.maxDownPayment || a.downPayment || 0;
                            bVal = b.maxDownPayment || b.downPayment || 0;
                            break;
                        }
                        if (aVal < bVal) return buyerSortDirection === 'asc' ? -1 : 1;
                        if (aVal > bVal) return buyerSortDirection === 'asc' ? 1 : -1;
                        return 0;
                      }).map((buyer) => (
                        <tr key={buyer.id} className="hover:bg-slate-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedBuyers.includes(buyer.userId)}
                              onChange={() => {
                                if (selectedBuyers.includes(buyer.userId)) {
                                  setSelectedBuyers(prev => prev.filter(id => id !== buyer.userId));
                                } else {
                                  setSelectedBuyers(prev => [...prev, buyer.userId]);
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-600 text-emerald-400 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-sm font-medium text-slate-300">
                                    {buyer.firstName?.charAt(0).toUpperCase() || buyer.email.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-white">
                                  {buyer.firstName && buyer.lastName ? `${buyer.firstName} ${buyer.lastName}` : buyer.email}
                                </div>
                                <div className="text-sm text-slate-400">{buyer.email}</div>
                                {buyer.phone && <div className="text-sm text-slate-400">{buyer.phone}</div>}
                                {(buyer.city || buyer.primaryCity) && (buyer.state || buyer.primaryState) && (
                                  <div className="text-sm text-slate-400">📍 {buyer.city || buyer.primaryCity}, {buyer.state || buyer.primaryState}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="text-sm font-semibold text-white">{buyer.matchedPropertiesCount || 0}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="text-sm font-semibold text-white">{buyer.likedPropertiesCount || 0}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="text-sm font-semibold text-white">${(buyer.maxMonthlyPayment || buyer.monthlyBudget || 0).toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="text-sm font-semibold text-white">${(buyer.maxDownPayment || buyer.downPayment || 0).toLocaleString()}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredBuyers.length === 0 && (
                    <div className="p-8 text-center text-slate-400">
                      {cityFilter || stateFilter ? 'No buyers found matching your filters' : 'No buyers found'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Realtors Tab */}
          {activeTab === 'realtors' && (
            <div className="bg-slate-800 shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg leading-6 font-medium text-white">Registered Realtors</h3>
                  <button
                    onClick={fetchRealtors}
                    disabled={loadingRealtors}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-slate-600"
                  >
                    {loadingRealtors ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                <div className="overflow-hidden bg-slate-800 shadow sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {realtors.map((realtor) => (
                      <li key={realtor.id}>
                        <div className="px-4 py-4 sm:px-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                  <span className="text-sm font-medium text-emerald-400">
                                    {realtor.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-white">{realtor.name}</div>
                                <div className="text-sm text-slate-400">{realtor.email}</div>
                                {realtor.brokerage && <div className="text-sm text-slate-400">{realtor.brokerage}</div>}
                                {realtor.city && realtor.state && (
                                  <div className="text-sm text-slate-400">📍 {realtor.city}, {realtor.state}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-8">
                              <div className="text-center">
                                <div className="text-lg font-semibold text-white">{realtor.credits}</div>
                                <div className="text-xs text-slate-400">Credits</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-white">{realtor.availableBuyersCount}</div>
                                <div className="text-xs text-slate-400">Leads</div>
                              </div>
                              <div className="text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  realtor.subscriptionStatus === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : realtor.subscriptionStatus === 'cancelled'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {realtor.subscriptionStatus === 'active' ? 'Active' :
                                   realtor.subscriptionStatus === 'cancelled' ? 'Cancelled' :
                                   'Free'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Disputes Tab */}
          {activeTab === 'disputes' && (
            <div className="space-y-6">
              {disputes.map((dispute) => (
                <div key={dispute.id} className="bg-slate-800 shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-white">
                          Dispute #{dispute.id.substring(0, 8)}
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">
                          Submitted: {(() => {
                            const ts = dispute.submittedAt as any;
                            if (!ts) return 'N/A';
                            if (typeof ts?.toDate === 'function') return new Date(ts.toDate()).toLocaleDateString();
                            if (typeof ts === 'object' && typeof ts._seconds === 'number') return new Date(ts._seconds * 1000).toLocaleDateString();
                            const date = new Date(ts);
                            return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
                          })()}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        dispute.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        dispute.status === 'approved' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {dispute.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <h4 className="text-sm font-medium text-white mb-2">Realtor Information</h4>
                        <div className="bg-slate-700 rounded-md p-3">
                          <div className="text-sm text-white font-medium">{dispute.realtorName}</div>
                          <div className="text-sm text-slate-400">{dispute.realtorEmail}</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-white mb-2">Buyer Information</h4>
                        <div className="bg-slate-700 rounded-md p-3">
                          <div className="text-sm text-white font-medium">{dispute.buyerName}</div>
                          <div className="text-sm text-slate-400">{dispute.buyerPhone}</div>
                          <div className="text-sm text-slate-400">{dispute.buyerCity}, {dispute.buyerState}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-white mb-2">Dispute Reason</h4>
                      <div className="bg-slate-700 rounded-md p-3">
                        <p className="text-sm text-white font-medium">
                          {dispute.reason === 'no_response' ? 'No Response from Buyer' :
                           dispute.reason === 'wrong_info' ? 'Wrong/Invalid Information' :
                           dispute.reason === 'not_interested' ? 'Buyer Not Interested' :
                           dispute.reason}
                        </p>
                        {dispute.explanation && (
                          <p className="text-sm text-slate-400 mt-2">{dispute.explanation}</p>
                        )}
                      </div>
                    </div>

                    {dispute.status === 'pending' && (
                      <div className="border-t border-slate-700 pt-4">
                        <div className="flex items-center space-x-4">
                          <select className="block w-40 pl-3 pr-10 py-2 text-base border-slate-600 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-md">
                            <option value="1">Refund 1 Credit</option>
                            <option value="2">Refund 2 Credits</option>
                            <option value="3">Refund 3 Credits</option>
                          </select>
                          <button
                            onClick={() => resolveDispute(dispute.id, 'approve', 1)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            Approve Dispute
                          </button>
                          <button
                            onClick={() => resolveDispute(dispute.id, 'deny', 0)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            Deny Dispute
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Contacts Tab */}
          {activeTab === 'contacts' && (
            <div className="bg-slate-800 shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg leading-6 font-medium text-white">Contact Form Submissions</h3>
                  <button
                    onClick={fetchContacts}
                    disabled={loadingContacts}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-slate-600"
                  >
                    {loadingContacts ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                <div className="space-y-6">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="border border-slate-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-medium text-white">{contact.name}</h4>
                          <div className="text-sm text-slate-400">
                            <div>{contact.email}</div>
                            {contact.phone && <div>{contact.phone}</div>}
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">
                          {(() => {
                            const ts = contact.createdAt as any;
                            if (!ts) return 'N/A';
                            if (typeof ts === 'object' && typeof ts._seconds === 'number') return new Date(ts._seconds * 1000).toLocaleDateString();
                            const date = new Date(ts);
                            return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
                          })()}
                        </span>
                      </div>
                      <div className="bg-slate-700 rounded-md p-3">
                        <p className="text-sm text-slate-300">{contact.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Social Media & Articles Tab */}
          {activeTab === 'social' && (
            <div className="space-y-6">
              {/* Social Media Dashboard Component */}
              <div className="bg-slate-800 rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold mb-4">Social Media Automation</h3>
                <iframe
                  src="/admin/social-dashboard"
                  className="w-full h-[calc(50vh-150px)] border-0 rounded-lg shadow-lg bg-slate-800"
                  title="Social Media Dashboard"
                />
              </div>

              {/* Articles Queue Dashboard Component */}
              <div className="bg-slate-800 rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold mb-4">Article Queue Management</h3>
                <iframe
                  src="/admin/articles"
                  className="w-full h-[calc(50vh-150px)] border-0 rounded-lg shadow-lg bg-slate-800"
                  title="Articles Queue Dashboard"
                />
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Edit Property Modal */}
      {editingProperty && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">Edit Property</h3>
                  <p className="text-slate-400 mt-1">Update property information and details</p>
                </div>
                <button
                  onClick={() => setEditingProperty(null)}
                  className="p-2 text-slate-400 hover:text-slate-400 hover:bg-slate-700 rounded-lg transition-colors"
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
                    <h4 className="text-lg font-semibold text-white mb-4">Property Details</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Address</label>
                        <input
                          type="text"
                          value={editForm.address || ''}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">City</label>
                          <input
                            type="text"
                            value={editForm.city || ''}
                            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">State</label>
                          <input
                            type="text"
                            value={editForm.state || ''}
                            onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">ZIP Code</label>
                          <input
                            type="text"
                            value={editForm.zipCode || ''}
                            onChange={(e) => setEditForm({ ...editForm, zipCode: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Bedrooms</label>
                          <input
                            type="number"
                            value={editForm.bedrooms || ''}
                            onChange={(e) => setEditForm({ ...editForm, bedrooms: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Bathrooms</label>
                          <input
                            type="number"
                            step="0.5"
                            value={editForm.bathrooms || ''}
                            onChange={(e) => setEditForm({ ...editForm, bathrooms: parseFloat(e.target.value) })}
                            className="w-full px-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Square Feet</label>
                          <input
                            type="number"
                            value={editForm.squareFeet || ''}
                            onChange={(e) => setEditForm({ ...editForm, squareFeet: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Financial Info */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">Financial Information</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">List Price</label>
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
                            className="w-full pl-8 pr-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Monthly Payment</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium z-10 pointer-events-none">$</span>
                            <input
                              type="number"
                              value={editForm.monthlyPayment || ''}
                              onChange={(e) => setEditForm({ ...editForm, monthlyPayment: parseFloat(e.target.value) })}
                              placeholder="1092"
                              className="w-full pl-8 pr-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Down Payment</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium z-10 pointer-events-none">$</span>
                            <input
                              type="number"
                              value={editForm.downPaymentAmount || ''}
                              onChange={(e) => setEditForm({ ...editForm, downPaymentAmount: parseFloat(e.target.value) })}
                              placeholder="16900"
                              className="w-full pl-8 pr-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Interest Rate and Down Payment Percentage */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Interest Rate</label>
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
                              className="w-full pr-10 pl-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                            />
                            <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">%</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Down Payment %</label>
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
                              className="w-full pr-10 pl-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                            />
                            <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">%</span>
                          </div>
                        </div>
                      </div>

                      {/* Term Years (Amortization) */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Amortization Term Years</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max="40"
                            value={editForm.termYears || ''}
                            onChange={(e) => setEditForm({ ...editForm, termYears: parseInt(e.target.value) || undefined })}
                            placeholder="Auto-calculated based on price"
                            className="w-full pr-16 pl-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                          />
                          <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">years</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">Leave blank for auto: &lt;150k=15yr, 150-300k=20yr, 300-600k=25yr, 600k+=30yr</p>
                      </div>

                      {/* Balloon Year Term */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Balloon Year Term</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max="30"
                            value={editForm.balloonYears || ''}
                            onChange={(e) => setEditForm({ ...editForm, balloonYears: parseInt(e.target.value) || undefined })}
                            placeholder="5"
                            className="w-full pr-16 pl-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                          />
                          <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">years</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">Number of years until balloon payment is due (if applicable)</p>
                      </div>

                      {/* Image URL Field */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Property Image URL</label>
                        <input
                          type="url"
                          value={editForm.imageUrl || ''}
                          onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                          placeholder="https://example.com/image.jpg"
                          className="w-full px-4 py-3 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                        />
                        {(editForm.imageUrl || editingProperty.imageUrl || (editingProperty as any).imageUrls?.[0]) && (
                          <div className="mt-3">
                            <Image
                              src={convertToDirectImageUrl(editForm.imageUrl || editingProperty.imageUrl || (editingProperty as any).imageUrls?.[0]) || '/placeholder-house.svg'}
                              alt="Property preview"
                              width={300}
                              height={200}
                              className="rounded-lg border border-slate-700 object-cover"
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

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-slate-700">
                <button
                  onClick={() => setEditingProperty(null)}
                  className="px-6 py-3 border border-slate-600 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
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
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all transform hover:scale-105 shadow-lg"
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