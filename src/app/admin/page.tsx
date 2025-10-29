'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LeadDispute } from '@/lib/firebase-models';
import { PropertyListing } from '@/lib/property-schema';
import Image from 'next/image';
import { calculatePropertyFinancials } from '@/lib/property-calculations';
import { useDropzone } from 'react-dropzone';
import { PropertySwiper2 } from '@/components/ui/PropertySwiper2';

// Extended Property interface for admin with legacy imageUrl field
interface AdminProperty extends PropertyListing {
  imageUrl?: string; // Legacy field for backward compatibility
}

// Helper function to convert Google Drive sharing links to direct image URLs
function convertToDirectImageUrl(url: string): string {
  if (!url) return url;

  // Fix malformed URLs (e.g., "mahttps://" or multiple "https://")
  let cleanedUrl = url;

  // Remove any prefix before "https://" or "http://"
  const httpMatch = cleanedUrl.match(/(https?:\/\/.+)$/);
  if (httpMatch) {
    cleanedUrl = httpMatch[1];
  }

  // Remove duplicate protocol prefixes
  cleanedUrl = cleanedUrl.replace(/^(https?:\/\/)+/, 'https://');

  // Handle Google Drive sharing links
  const driveMatch = cleanedUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
  }

  return cleanedUrl;
}

interface BuyerStats {
  id: string;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'properties' | 'failed-properties' | 'upload' | 'disputes' | 'contacts' | 'buyers' | 'realtors' | 'logs' | 'social' | 'articles' | 'image-quality' | 'buyer-preview'>('overview');

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
  const [sortField, setSortField] = useState<'address' | 'city' | 'state' | 'listPrice' | 'bedrooms' | null>('address');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Failed Properties state
  const [failedProperties, setFailedProperties] = useState<AdminProperty[]>([]);
  const [loadingFailedProperties, setLoadingFailedProperties] = useState(false);
  const [failedPropertiesFilter, setFailedPropertiesFilter] = useState<'all' | 'validation' | 'withdrawn' | 'missing-data'>('all');
  const [failedPropertySummary, setFailedPropertySummary] = useState({ total: 0, withdrawn: 0, missingData: 0, validation: 0 });

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
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  const [realtors, setRealtors] = useState<RealtorStats[]>([]);
  const [loadingRealtors, setLoadingRealtors] = useState(false);

  // Edit modal state
  const [editingProperty, setEditingProperty] = useState<AdminProperty | null>(null);
  const [editForm, setEditForm] = useState<Partial<AdminProperty>>({});

  // Image quality state
  const [streetViewProperties, setStreetViewProperties] = useState<AdminProperty[]>([]);
  const [loadingStreetView, setLoadingStreetView] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);

  // Buyer Preview state
  const [previewProperties, setPreviewProperties] = useState<AdminProperty[]>([]);
  const [previewCurrentIndex, setPreviewCurrentIndex] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }

    if (status === 'authenticated') {
      const userRole = (session?.user as { role?: string })?.role;
      if (userRole !== 'admin') {
        if (userRole === 'buyer') {
          router.push('/dashboard');
        } else if (userRole === 'realtor') {
          router.push('/realtor/dashboard');
        } else {
          router.push('/auth/signin');
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
        totalBuyers: buyersData.buyers?.length || 0,
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

  const fetchFailedProperties = useCallback(async () => {
    setLoadingFailedProperties(true);
    try {
      const response = await fetch(`/api/admin/failed-properties?filter=${failedPropertiesFilter}`);
      const data = await response.json();
      if (data.properties) {
        setFailedProperties(data.properties);
        setFailedPropertySummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch failed properties:', error);
    } finally {
      setLoadingFailedProperties(false);
    }
  }, [failedPropertiesFilter]);

  const fetchStreetViewProperties = useCallback(async () => {
    setLoadingStreetView(true);
    try {
      const response = await fetch('/api/admin/street-view-properties');
      const data = await response.json();
      if (data.properties) {
        setStreetViewProperties(data.properties);
      }
    } catch (error) {
      console.error('Failed to fetch Street View properties:', error);
    } finally {
      setLoadingStreetView(false);
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
      setStats(prev => ({ ...prev, totalBuyers: data.buyers?.length || 0 }));
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
    } else if (activeTab === 'failed-properties') {
      fetchNewProperties(); // Fetch failed GHL properties
    } else if (activeTab === 'image-quality') {
      fetchStreetViewProperties();
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
  const handleSort = (field: 'address' | 'city' | 'state' | 'listPrice' | 'bedrooms') => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);

    const sortedProperties = [...properties].sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';

      switch (field) {
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
          aValue = a.bedrooms ?? 0;
          bValue = b.bedrooms ?? 0;
          break;
      }

      if (aValue < bValue) return newDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return newDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setProperties(sortedProperties);
  };

  const getFilteredProperties = () => {
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
  };

  const getPaginatedProperties = () => {
    const filtered = getFilteredProperties();
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  };

  const filteredProperties = getFilteredProperties();
  const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);

  // Helper function to recalculate financials when price or related fields change
  const handlePriceChange = (newPrice: number) => {
    const updatedFinancials = calculatePropertyFinancials({
      listPrice: newPrice,
      downPaymentPercent: editForm.downPaymentPercent,
      downPaymentAmount: editForm.downPaymentAmount,
      monthlyPayment: editForm.monthlyPayment,
      interestRate: editForm.interestRate,
      termYears: editForm.termYears || 20,
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
      termYears: editForm.termYears || 20,
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
      termYears: editForm.termYears || 20,
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
    <div className="min-h-screen bg-slate-50 flex max-w-full overflow-x-hidden">
      {/* Left Sidebar */}
      <div className="w-64 lg:w-72 bg-white shadow-xl border-r border-slate-200 flex-shrink-0">
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-200">
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
        <nav className="p-4 space-y-2">
          {[
            { key: 'overview', label: 'Overview', icon: '📊', count: null },
            { key: 'properties', label: 'Properties', icon: '🏠', count: stats.totalProperties },
            { key: 'buyer-preview', label: 'Buyer Preview', icon: '👁️', count: null },
            { key: 'failed-properties', label: 'Failed Properties', icon: '⚠️', count: failedPropertySummary.total || null },
            { key: 'image-quality', label: 'Image Quality', icon: '📸', count: null },
            { key: 'upload', label: 'Upload', icon: '📤', count: null },
            { key: 'buyers', label: 'Buyers', icon: '👤', count: stats.totalBuyers },
            { key: 'realtors', label: 'Realtors', icon: '🏢', count: stats.totalRealtors },
            { key: 'disputes', label: 'Disputes', icon: '⚖️', count: stats.pendingDisputes },
            { key: 'contacts', label: 'Contacts', icon: '📧', count: null },
            { key: 'social', label: 'Social Media', icon: '📱', count: null },
            { key: 'articles', label: 'Articles', icon: '📰', count: null },
            { key: 'logs', label: 'Logs', icon: '📋', count: null },
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

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-slate-600">System Online</span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
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
      <div className="flex-1 flex flex-col min-h-screen w-full overflow-x-hidden">
        {/* Top Header */}
        {activeTab !== 'buyer-preview' && (
        <header className="bg-white shadow-sm border-b border-slate-200 px-4 md:px-6 lg:px-8 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                {activeTab === 'overview' && 'Dashboard Overview'}
                {activeTab === 'properties' && 'Property Management'}
                {activeTab === 'failed-properties' && 'Failed Properties'}
                {activeTab === 'image-quality' && 'Image Quality Review'}
                {activeTab === 'upload' && 'Upload Properties'}
                {activeTab === 'buyers' && 'Buyer Management'}
                {activeTab === 'realtors' && 'Realtor Management'}
                {activeTab === 'disputes' && 'Dispute Resolution'}
                {activeTab === 'contacts' && 'Contact Submissions'}
                {activeTab === 'social' && 'Social Media Automation'}
                {activeTab === 'articles' && 'Article Queue Management'}
                {activeTab === 'logs' && 'System Logs'}
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
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Properties Tab */}
          {activeTab === 'properties' && (
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
                      <th scope="col" className="relative px-6 py-4">
                        <input
                          type="checkbox"
                          checked={getPaginatedProperties().length > 0 && getPaginatedProperties().every(p => selectedProperties.includes(p.id))}
                          onChange={() => {
                            const pageIds = getPaginatedProperties().map(p => p.id);
                            if (getPaginatedProperties().every(p => selectedProperties.includes(p.id))) {
                              setSelectedProperties(prev => prev.filter(id => !pageIds.includes(id)));
                            } else {
                              setSelectedProperties(prev => [...new Set([...prev, ...pageIds])]);
                            }
                          }}
                          className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Property
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('city')}>
                        Location {sortField === 'city' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('listPrice')}>
                        Price {sortField === 'listPrice' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getPaginatedProperties().map((property) => (
                      <tr key={property.id} className="hover:bg-gray-50">
                        <td className="relative px-6 py-6">
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
                        <td className="px-6 py-6 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-3">
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
                        <td className="px-6 py-6 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-24 w-32">
                              <Image
                                src={convertToDirectImageUrl(property.imageUrl || (property as any).imageUrls?.[0]) || '/placeholder-house.svg'}
                                alt={property.address}
                                width={128}
                                height={96}
                                className="h-24 w-32 rounded-lg object-cover"
                              />
                            </div>
                            <div className="ml-3">
                              <div className="flex items-center gap-2">
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
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{property.city}, {property.state}</div>
                          <div className="text-sm text-gray-500">{property.zipCode}</div>
                        </td>
                        <td className="px-6 py-6 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">${property.listPrice?.toLocaleString()}</div>
                          <div className="text-sm text-gray-500">${property.monthlyPayment?.toLocaleString()}/mo</div>
                        </td>
                        <td className="px-6 py-6 whitespace-nowrap text-sm text-gray-500">
                          <div>{property.bedrooms} bed • {property.bathrooms} bath</div>
                          <div>{property.squareFeet?.toLocaleString()} sqft</div>
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
          )}

          {/* Failed Properties Tab */}
          {activeTab === 'failed-properties' && (
            <div className="space-y-6">
              {/* Filter Buttons */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Filter by Issue Type</h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setFailedPropertiesFilter('all')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      failedPropertiesFilter === 'all'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All Issues ({failedPropertySummary.total})
                  </button>
                  <button
                    onClick={() => setFailedPropertiesFilter('validation')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      failedPropertiesFilter === 'validation'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-50 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    Validation Errors ({failedPropertySummary.validation})
                  </button>
                  <button
                    onClick={() => setFailedPropertiesFilter('missing-data')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      failedPropertiesFilter === 'missing-data'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                    }`}
                  >
                    Missing Data ({failedPropertySummary.missingData})
                  </button>
                  <button
                    onClick={() => setFailedPropertiesFilter('withdrawn')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      failedPropertiesFilter === 'withdrawn'
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Withdrawn/Expired ({failedPropertySummary.withdrawn})
                  </button>
                </div>
              </div>

              {/* Failed Properties Table */}
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {loadingFailedProperties ? 'Loading...' : `${failedProperties.length} Failed Properties`}
                    </h3>
                    <button
                      onClick={fetchFailedProperties}
                      disabled={loadingFailedProperties}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
                    >
                      {loadingFailedProperties ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Property
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Issue Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Problems
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {failedProperties.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                            {loadingFailedProperties ? 'Loading...' : 'No failed properties found'}
                          </td>
                        </tr>
                      ) : (
                        failedProperties.map((property: any) => (
                          <tr key={property.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">
                                {property.address || 'No Address'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {property.city}, {property.state} {property.zipCode}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                property.failureType === 'validation'
                                  ? 'bg-red-100 text-red-800'
                                  : property.failureType === 'missing-data'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {property.failureType === 'validation' && 'Validation'}
                                {property.failureType === 'missing-data' && 'Missing Data'}
                                {property.failureType === 'withdrawn' && 'Withdrawn/Expired'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                {property.validationErrors && property.validationErrors.length > 0 && (
                                  <ul className="list-disc list-inside space-y-1">
                                    {property.validationErrors.slice(0, 3).map((error: string, idx: number) => (
                                      <li key={idx} className="text-red-600">{error}</li>
                                    ))}
                                    {property.validationErrors.length > 3 && (
                                      <li className="text-gray-500">+{property.validationErrors.length - 3} more</li>
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

          {/* Image Quality Tab */}
          {activeTab === 'image-quality' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">📸 Google Street View Images</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Properties using Street View placeholders that need real photos
                    </p>
                  </div>
                  <button
                    onClick={fetchStreetViewProperties}
                    disabled={loadingStreetView}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
                  >
                    {loadingStreetView ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {/* Summary */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <span className="text-3xl font-bold text-red-900 mr-4">{streetViewProperties.length}</span>
                    <div>
                      <div className="text-sm font-medium text-red-900">Properties Using Street View</div>
                      <div className="text-xs text-red-700">Need real property photos</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Properties Table */}
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Image</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Image URL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loadingStreetView ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                            Loading...
                          </td>
                        </tr>
                      ) : streetViewProperties.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                            ✅ No properties using Street View! All properties have real images.
                          </td>
                        </tr>
                      ) : (
                        streetViewProperties.map((property: any) => {
                          const imageUrl = property.imageUrl || property.imageUrls?.[0];
                          return (
                            <tr key={property.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{property.address}</div>
                                    <div className="text-sm text-gray-500">{property.city}, {property.state} {property.zipCode}</div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const fullAddress = `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;
                                      navigator.clipboard.writeText(fullAddress);
                                    }}
                                    className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                                    title="Copy full address"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <a
                                  href={imageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-indigo-600 hover:text-indigo-800 break-all"
                                >
                                  Street View →
                                </a>
                              </td>
                              <td className="px-6 py-4">
                                {editingImageUrl === property.id ? (
                                  <input
                                    type="url"
                                    value={newImageUrl}
                                    onChange={(e) => setNewImageUrl(e.target.value)}
                                    placeholder="https://example.com/image.jpg"
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    autoFocus
                                  />
                                ) : (
                                  <span className="text-sm text-gray-400">Click edit to add</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                {editingImageUrl === property.id ? (
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={async () => {
                                        try {
                                          await fetch(`/api/admin/properties/${property.id}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              imageUrl: newImageUrl,
                                              imageUrls: [newImageUrl]
                                            })
                                          });
                                          setEditingImageUrl(null);
                                          setNewImageUrl('');
                                          fetchStreetViewProperties(); // Refresh list
                                          alert('Image updated successfully!');
                                        } catch (error) {
                                          alert('Failed to update image');
                                          console.error('Update error:', error);
                                        }
                                      }}
                                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingImageUrl(null);
                                        setNewImageUrl('');
                                      }}
                                      className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingImageUrl(property.id);
                                      setNewImageUrl('');
                                    }}
                                    className="text-indigo-600 hover:text-indigo-900 font-medium"
                                  >
                                    Edit
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Automatic Detection</h4>
                <p className="text-sm text-blue-800">
                  New properties are automatically checked for Street View images when they're added to the database.
                  Properties using Street View will appear here so you can replace them with real photos.
                </p>
              </div>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="max-w-4xl mx-auto">
              {/* Mode Toggle */}
              <div className="bg-white shadow rounded-lg p-4 mb-6">
                <div className="flex space-x-3">
                  <button
                    onClick={() => { setUploadMode('csv'); setUploadResult(null); }}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      uploadMode === 'csv'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    📄 CSV Upload
                  </button>
                  <button
                    onClick={() => { setUploadMode('scraper'); setUploadResult(null); }}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      uploadMode === 'scraper'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    🤖 Zillow Scraper
                  </button>
                  <button
                    onClick={() => { setUploadMode('new-properties'); setUploadResult(null); }}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      uploadMode === 'new-properties'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    ✨ New Properties
                  </button>
                  <button
                    onClick={() => { setUploadMode('manual'); setUploadResult(null); }}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      uploadMode === 'manual'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    ✏️ Manual Entry
                  </button>
                </div>
              </div>

              {/* CSV Upload Mode */}
              {uploadMode === 'csv' && (
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Upload Property CSV File</h3>

                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                      <div className="space-y-1 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="flex text-sm text-gray-600">
                          <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
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
                        <p className="text-xs text-gray-500">CSV files only</p>
                      </div>
                    </div>

                    {file && (
                      <div className="mt-6">
                        <button
                          onClick={handleUpload}
                          disabled={uploading}
                          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
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
                  {/* Dropzone */}
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors bg-white shadow ${
                      isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    } ${
                      scraperProgress.status === 'uploading' || scraperProgress.status === 'scraping' ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <input {...getInputProps()} />

                    <div className="mb-4">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
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
                        <p className="text-sm text-gray-500">or click to select files (multiple files supported)</p>
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  {scraperProgress.status !== 'idle' && (
                    <div
                      className={`p-6 rounded-lg border-2 bg-white shadow ${
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
                              <p className="text-sm text-gray-700">
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
                              <p className="text-sm text-gray-700 mt-2">
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
                  <div className="bg-gray-50 p-6 rounded-lg shadow">
                    <h2 className="text-lg font-semibold mb-3">How it works</h2>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700">
                      <li>Upload one or multiple CSV/Excel files containing Zillow property URLs</li>
                      <li>The system combines all files and automatically removes duplicates</li>
                      <li>Checks against existing properties in the database</li>
                      <li>Only new properties are sent to Apify for scraping</li>
                      <li>All data is saved to the <code className="bg-gray-200 px-2 py-1 rounded">zillow_imports</code> collection</li>
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
                  <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-lg leading-6 font-medium text-gray-900">⚠️ Failed GHL Webhook Sends</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Properties that failed to send to GoHighLevel - {newPropertiesData.length} total
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleSendToGHL}
                          disabled={sendingToGHL || newPropertiesData.length === 0}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {sendingToGHL ? 'Retrying...' : '🔄 Retry Send to GHL'}
                        </button>
                      </div>
                    </div>

                    {/* Loading State */}
                    {loadingNewProperties && (
                      <div className="text-center py-12">
                        <div className="animate-spin inline-block h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
                        <p className="mt-4 text-gray-600">Loading failed properties...</p>
                      </div>
                    )}

                    {/* Empty State */}
                    {!loadingNewProperties && newPropertiesData.length === 0 && (
                      <div className="text-center py-12">
                        <p className="text-green-600 font-medium">✅ No failed sends!</p>
                        <p className="text-sm text-gray-400 mt-2">All properties with contact info have been successfully sent to GHL.</p>
                      </div>
                    )}

                    {/* Properties Table */}
                    {!loadingNewProperties && newPropertiesData.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Address
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                City
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                State
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Price
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Beds
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Baths
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Sq Ft
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Imported
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {newPropertiesData.map((property) => (
                              <tr key={property.id} className="hover:bg-gray-50">
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <a
                                    href={property.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:text-indigo-900 hover:underline"
                                  >
                                    {property.streetAddress || property.fullAddress || 'N/A'}
                                  </a>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {property.city || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {property.state || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                  ${property.price?.toLocaleString() || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {property.bedrooms || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {property.bathrooms || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {property.squareFoot?.toLocaleString() || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {property.buildingType || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {property.importedAt ? new Date(property.importedAt).toLocaleDateString() : 'N/A'}
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
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Add Property Manually</h3>

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
                      <div className="border-b border-gray-200 pb-6">
                        <h4 className="text-md font-semibold text-gray-900 mb-4">Address & Location</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Street Address *</label>
                            <input
                              type="text"
                              required
                              value={manualPropertyData.address || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, address: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">City *</label>
                            <input
                              type="text"
                              required
                              value={manualPropertyData.city || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, city: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">State *</label>
                            <input
                              type="text"
                              required
                              maxLength={2}
                              value={manualPropertyData.state || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, state: e.target.value.toUpperCase() })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">ZIP Code *</label>
                            <input
                              type="text"
                              required
                              value={manualPropertyData.zipCode || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, zipCode: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Property Details */}
                      <div className="border-b border-gray-200 pb-6">
                        <h4 className="text-md font-semibold text-gray-900 mb-4">Property Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Property Type *</label>
                            <select
                              required
                              value={manualPropertyData.propertyType || 'single-family'}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, propertyType: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                            <label className="block text-sm font-medium text-gray-700">Bedrooms *</label>
                            <input
                              type="number"
                              required
                              min="0"
                              value={manualPropertyData.bedrooms || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, bedrooms: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Bathrooms *</label>
                            <input
                              type="number"
                              required
                              min="0"
                              step="0.5"
                              value={manualPropertyData.bathrooms || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, bathrooms: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Square Feet</label>
                            <input
                              type="number"
                              min="0"
                              value={manualPropertyData.squareFeet || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, squareFeet: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Year Built</label>
                            <input
                              type="number"
                              min="1800"
                              max={new Date().getFullYear() + 1}
                              value={manualPropertyData.yearBuilt || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, yearBuilt: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Financial Information */}
                      <div className="border-b border-gray-200 pb-6">
                        <h4 className="text-md font-semibold text-gray-900 mb-4">Financial Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">List Price * ($)</label>
                            <input
                              type="number"
                              required
                              min="0"
                              value={manualPropertyData.listPrice || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, listPrice: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Down Payment * ($)</label>
                            <input
                              type="number"
                              required
                              min="0"
                              value={manualPropertyData.downPaymentAmount || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, downPaymentAmount: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Down Payment * (%)</label>
                            <input
                              type="number"
                              required
                              min="0"
                              max="100"
                              step="0.1"
                              value={manualPropertyData.downPaymentPercent || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, downPaymentPercent: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Monthly Payment * ($)</label>
                            <input
                              type="number"
                              required
                              min="0"
                              value={manualPropertyData.monthlyPayment || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, monthlyPayment: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Interest Rate * (%)</label>
                            <input
                              type="number"
                              required
                              min="0"
                              max="100"
                              step="0.01"
                              value={manualPropertyData.interestRate || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, interestRate: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Term * (Years)</label>
                            <input
                              type="number"
                              required
                              min="1"
                              max="50"
                              value={manualPropertyData.termYears || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, termYears: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Description & Images */}
                      <div className="border-b border-gray-200 pb-6">
                        <h4 className="text-md font-semibold text-gray-900 mb-4">Description & Media</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Description</label>
                            <textarea
                              rows={4}
                              value={manualPropertyData.description || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, description: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Property description..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Image URLs (comma-separated)</label>
                            <textarea
                              rows={2}
                              value={manualPropertyData.imageUrls || ''}
                              onChange={(e) => setManualPropertyData({ ...manualPropertyData, imageUrls: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Reset Form
                        </button>
                        <button
                          type="submit"
                          disabled={uploading}
                          className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
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
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Registered Buyers</h3>
                  <button
                    onClick={fetchBuyers}
                    disabled={loadingBuyers}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                  >
                    {loadingBuyers ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                <div className="overflow-hidden bg-white shadow sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {buyers.map((buyer) => (
                      <li key={buyer.id}>
                        <div className="px-4 py-4 sm:px-6">
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            {/* Buyer Info */}
                            <div className="flex items-center flex-1 min-w-0">
                              <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-sm font-medium text-gray-700">
                                    {buyer.firstName?.charAt(0).toUpperCase() || buyer.email.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4 min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {buyer.firstName && buyer.lastName ? `${buyer.firstName} ${buyer.lastName}` : buyer.email}
                                </div>
                                <div className="text-sm text-gray-500 break-all">{buyer.email}</div>
                                {buyer.phone && <div className="text-sm text-gray-500">{buyer.phone}</div>}
                                {(buyer.city || buyer.primaryCity) && (buyer.state || buyer.primaryState) && (
                                  <div className="text-sm text-gray-500">📍 {buyer.city || buyer.primaryCity}, {buyer.state || buyer.primaryState}</div>
                                )}
                              </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-4 gap-3 sm:gap-6 flex-shrink-0">
                              <div className="text-center">
                                <div className="text-base sm:text-lg font-semibold text-gray-900">{buyer.matchedPropertiesCount || 0}</div>
                                <div className="text-xs text-gray-500">Matched</div>
                              </div>
                              <div className="text-center">
                                <div className="text-base sm:text-lg font-semibold text-gray-900">{buyer.likedPropertiesCount || 0}</div>
                                <div className="text-xs text-gray-500">Liked</div>
                              </div>
                              <div className="text-center">
                                <div className="text-base sm:text-lg font-semibold text-gray-900">${(buyer.maxMonthlyPayment || buyer.monthlyBudget || 0).toLocaleString()}</div>
                                <div className="text-xs text-gray-500">Budget/mo</div>
                              </div>
                              <div className="text-center">
                                <div className="text-base sm:text-lg font-semibold text-gray-900">${(buyer.maxDownPayment || buyer.downPayment || 0).toLocaleString()}</div>
                                <div className="text-xs text-gray-500">Down Pay</div>
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

          {/* Realtors Tab */}
          {activeTab === 'realtors' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Registered Realtors</h3>
                  <button
                    onClick={fetchRealtors}
                    disabled={loadingRealtors}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                  >
                    {loadingRealtors ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                <div className="overflow-hidden bg-white shadow sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {realtors.map((realtor) => (
                      <li key={realtor.id}>
                        <div className="px-4 py-4 sm:px-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                  <span className="text-sm font-medium text-indigo-700">
                                    {realtor.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{realtor.name}</div>
                                <div className="text-sm text-gray-500">{realtor.email}</div>
                                {realtor.brokerage && <div className="text-sm text-gray-500">{realtor.brokerage}</div>}
                                {realtor.city && realtor.state && (
                                  <div className="text-sm text-gray-500">📍 {realtor.city}, {realtor.state}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-8">
                              <div className="text-center">
                                <div className="text-lg font-semibold text-gray-900">{realtor.credits}</div>
                                <div className="text-xs text-gray-500">Credits</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-gray-900">{realtor.availableBuyersCount}</div>
                                <div className="text-xs text-gray-500">Leads</div>
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
                <div key={dispute.id} className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          Dispute #{dispute.id.substring(0, 8)}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Submitted: {new Date(dispute.submittedAt?.toDate?.() || '').toLocaleDateString()}
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
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Realtor Information</h4>
                        <div className="bg-gray-50 rounded-md p-3">
                          <div className="text-sm text-gray-900 font-medium">{dispute.realtorName}</div>
                          <div className="text-sm text-gray-600">{dispute.realtorEmail}</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Buyer Information</h4>
                        <div className="bg-gray-50 rounded-md p-3">
                          <div className="text-sm text-gray-900 font-medium">{dispute.buyerName}</div>
                          <div className="text-sm text-gray-600">{dispute.buyerPhone}</div>
                          <div className="text-sm text-gray-600">{dispute.buyerCity}, {dispute.buyerState}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Dispute Reason</h4>
                      <div className="bg-gray-50 rounded-md p-3">
                        <p className="text-sm text-gray-900 font-medium">
                          {dispute.reason === 'no_response' ? 'No Response from Buyer' :
                           dispute.reason === 'wrong_info' ? 'Wrong/Invalid Information' :
                           dispute.reason === 'not_interested' ? 'Buyer Not Interested' :
                           dispute.reason}
                        </p>
                        {dispute.explanation && (
                          <p className="text-sm text-gray-600 mt-2">{dispute.explanation}</p>
                        )}
                      </div>
                    </div>

                    {dispute.status === 'pending' && (
                      <div className="border-t border-gray-200 pt-4">
                        <div className="flex items-center space-x-4">
                          <select className="block w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
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
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Contact Form Submissions</h3>
                  <button
                    onClick={fetchContacts}
                    disabled={loadingContacts}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                  >
                    {loadingContacts ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                <div className="space-y-6">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{contact.name}</h4>
                          <div className="text-sm text-gray-600">
                            <div>{contact.email}</div>
                            {contact.phone && <div>{contact.phone}</div>}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(contact.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded-md p-3">
                        <p className="text-sm text-gray-700">{contact.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Social Media Tab */}
          {activeTab === 'social' && (
            <div className="space-y-6">
              {/* Social Media Dashboard Component */}
              <iframe
                src="/admin/social-dashboard"
                className="w-full h-[calc(100vh-200px)] border-0 rounded-lg shadow-lg bg-white"
                title="Social Media Dashboard"
              />
            </div>
          )}

          {/* Articles Tab */}
          {activeTab === 'articles' && (
            <div className="space-y-6">
              {/* Articles Queue Dashboard Component */}
              <iframe
                src="/admin/articles"
                className="w-full h-[calc(100vh-200px)] border-0 rounded-lg shadow-lg bg-white"
                title="Articles Queue Dashboard"
              />
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">System Logs</h3>
                  <button
                    onClick={() => router.push('/admin/logs')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    View Full Logs
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">System Logs</h3>
                  <p className="mt-1 text-sm text-gray-500">Click "View Full Logs" to access detailed system logs</p>
                </div>
              </div>
            </div>
          )}

          {/* Buyer Preview Tab */}
          {activeTab === 'buyer-preview' && (
            <div className="fixed inset-0 z-50 left-0">
              {/* Exit Button */}
              <button
                onClick={() => setActiveTab('overview')}
                className="fixed top-4 left-4 z-[60] px-4 py-2 bg-slate-800/90 hover:bg-slate-700 text-white rounded-xl transition-colors font-semibold text-sm shadow-lg backdrop-blur-sm flex items-center gap-2"
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