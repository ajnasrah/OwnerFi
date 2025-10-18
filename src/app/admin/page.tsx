'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LeadDispute } from '@/lib/firebase-models';
import { PropertyListing } from '@/lib/property-schema';
import Image from 'next/image';

// Extended Property interface for admin with legacy imageUrl field
interface AdminProperty extends PropertyListing {
  imageUrl?: string; // Legacy field for backward compatibility
}

// Helper function to convert Google Drive sharing links to direct image URLs
function convertToDirectImageUrl(url: string): string {
  if (!url) return url;

  // Handle Google Drive sharing links
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
  }

  return url;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'properties' | 'upload' | 'disputes' | 'contacts' | 'buyers' | 'realtors' | 'logs' | 'social' | 'articles'>('overview');

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

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

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
      // Load properties count
      const propResponse = await fetch('/api/admin/properties?limit=1');
      const propData = await propResponse.json();

      // Load buyers count
      const buyersResponse = await fetch('/api/admin/buyers');
      const buyersData = await buyersResponse.json();

      // Load realtors count
      const realtorsResponse = await fetch('/api/admin/realtors');
      const realtorsData = await realtorsResponse.json();

      // Load disputes count
      const disputesResponse = await fetch('/api/admin/disputes');
      const disputesData = await disputesResponse.json();

      setStats({
        totalProperties: propData.properties?.length || 0,
        totalBuyers: buyersData.buyers?.length || 0,
        totalRealtors: realtorsData.realtors?.length || 0,
        pendingDisputes: disputesData.pendingDisputes?.length || 0
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  // Fetch functions
  const fetchProperties = async (limit?: number) => {
    setLoadingProperties(true);
    try {
      const url = limit ? `/api/admin/properties?limit=${limit}` : '/api/admin/properties';
      const response = await fetch(url);
      const data = await response.json();
      if (data.properties) {
        setProperties(data.properties);
        setStats(prev => ({ ...prev, totalProperties: data.properties.length }));
        if (!limit) {
          setCurrentPage(1);
        }
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error);
    } finally {
      setLoadingProperties(false);
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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left Sidebar */}
      <div className="w-72 bg-white shadow-xl border-r border-slate-200 flex-shrink-0">
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
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-slate-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {activeTab === 'overview' && 'Dashboard Overview'}
                {activeTab === 'properties' && 'Property Management'}
                {activeTab === 'upload' && 'Upload Properties'}
                {activeTab === 'buyers' && 'Buyer Management'}
                {activeTab === 'realtors' && 'Realtor Management'}
                {activeTab === 'disputes' && 'Dispute Resolution'}
                {activeTab === 'contacts' && 'Contact Submissions'}
                {activeTab === 'social' && 'Social Media Automation'}
                {activeTab === 'articles' && 'Article Queue Management'}
                {activeTab === 'logs' && 'System Logs'}
              </h2>
              <p className="text-slate-600 mt-1">
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
                        fetchProperties();
                      }
                    }
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors shadow-sm"
                >
                  Remove Duplicates
                </button>
                <button
                  onClick={() => fetchProperties()}
                  disabled={loadingProperties}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 shadow-sm"
                >
                  {loadingProperties ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-8 bg-slate-50 overflow-y-auto">
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
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                              fetchProperties();
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="relative px-6 py-3">
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
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Property
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('city')}>
                        Location {sortField === 'city' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('listPrice')}>
                        Price {sortField === 'listPrice' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getPaginatedProperties().map((property) => (
                      <tr key={property.id} className="hover:bg-gray-50">
                        <td className="relative px-6 py-4">
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-16 w-20">
                              <Image
                                src={convertToDirectImageUrl(property.imageUrl || (property as any).imageUrls?.[0]) || '/placeholder-house.svg'}
                                alt={property.address}
                                width={80}
                                height={64}
                                className="h-16 w-20 rounded-md object-cover"
                              />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{property.address}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{property.city}, {property.state}</div>
                          <div className="text-sm text-gray-500">{property.zipCode}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">${property.listPrice?.toLocaleString()}</div>
                          <div className="text-sm text-gray-500">${property.monthlyPayment?.toLocaleString()}/mo</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{property.bedrooms} bed • {property.bathrooms} bath</div>
                          <div>{property.squareFeet?.toLocaleString()} sqft</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
                                  fetchProperties();
                                }
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </div>
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

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="max-w-3xl mx-auto">
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
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-sm font-medium text-gray-700">
                                    {buyer.firstName?.charAt(0).toUpperCase() || buyer.email.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {buyer.firstName && buyer.lastName ? `${buyer.firstName} ${buyer.lastName}` : buyer.email}
                                </div>
                                <div className="text-sm text-gray-500">{buyer.email}</div>
                                {buyer.phone && <div className="text-sm text-gray-500">{buyer.phone}</div>}
                                {(buyer.city || buyer.primaryCity) && (buyer.state || buyer.primaryState) && (
                                  <div className="text-sm text-gray-500">📍 {buyer.city || buyer.primaryCity}, {buyer.state || buyer.primaryState}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-8">
                              <div className="text-center">
                                <div className="text-lg font-semibold text-gray-900">{buyer.matchedPropertiesCount || 0}</div>
                                <div className="text-xs text-gray-500">Matched</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-gray-900">{buyer.likedPropertiesCount || 0}</div>
                                <div className="text-xs text-gray-500">Liked</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-gray-900">${(buyer.maxMonthlyPayment || buyer.monthlyBudget || 0).toLocaleString()}</div>
                                <div className="text-xs text-gray-500">Budget/mo</div>
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

                      <div className="grid grid-cols-2 gap-4">
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
                            onChange={(e) => setEditForm({ ...editForm, listPrice: parseFloat(e.target.value) })}
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
                              onChange={(e) => setEditForm({ ...editForm, interestRate: parseFloat(e.target.value) })}
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
                              value={editForm.downPaymentPercent || ''}
                              onChange={(e) => setEditForm({ ...editForm, downPaymentPercent: parseFloat(e.target.value) })}
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
                    fetchProperties();
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