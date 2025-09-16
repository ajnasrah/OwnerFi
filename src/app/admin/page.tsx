'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { Button } from '@/components/ui/Button';
import { LeadDispute } from '@/lib/firebase-models';
import { PropertyListing } from '@/lib/property-schema';

// Extended Property interface for admin with legacy imageUrl field
interface AdminProperty extends PropertyListing {
  imageUrl?: string; // Legacy field for backward compatibility
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


import Image from 'next/image';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'upload' | 'manage' | 'disputes' | 'contacts' | 'buyers' | 'realtors'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    error?: string;
    details?: string[];
    success?: boolean;
    summary?: {
      totalRows?: number;
      successfulInserts?: number;
    };
    parseErrors?: string[];
    duplicates?: string[];
    insertedProperties?: AdminProperty[];
  } | null>(null);
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [disputes, setDisputes] = useState<LeadDispute[]>([]);
  const [loadingDisputes, setLoadingDisputes] = useState(false);
  const [contacts, setContacts] = useState<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    message: string;
    createdAt: string;
  }[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Buyers and Realtors state
  const [buyers, setBuyers] = useState<BuyerStats[]>([]);
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  const [realtors, setRealtors] = useState<RealtorStats[]>([]);
  const [loadingRealtors, setLoadingRealtors] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Edit modal state
  const [editingProperty, setEditingProperty] = useState<AdminProperty | null>(null);
  const [editForm, setEditForm] = useState<Partial<AdminProperty>>({});
  const [isSigningOut, setIsSigningOut] = useState(false);


  // Sorting state
  const [sortField, setSortField] = useState<'address' | 'city' | 'state' | 'listPrice' | 'bedrooms' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setFile(selectedFile || null);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/upload-properties', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setResult({ error: errorData.error || `HTTP ${response.status}: ${response.statusText}` });
        return;
      }

      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        setFile(null);
        // Clear the file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      setResult({ error: `Upload failed: ${(error as Error).message}` });
    } finally {
      setUploading(false);
    }
  };

  const fetchProperties = async (limit?: number) => {
    setLoadingProperties(true);
    try {
      const url = limit ? `/api/admin/properties?limit=${limit}` : '/api/admin/properties';
      const response = await fetch(url);
      const data = await response.json();
      if (data.properties) {
        setProperties(data.properties);
      }
    } catch {
    } finally {
      setLoadingProperties(false);
    }
  };

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
          aValue = a.bedrooms || 0;
          bValue = b.bedrooms || 0;
          break;
      }

      if (aValue < bValue) return newDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return newDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setProperties(sortedProperties);
  };

  const handleSelectAll = () => {
    if (selectedProperties.length === properties.length) {
      setSelectedProperties([]);
    } else {
      setSelectedProperties(properties.map(p => p.id));
    }
  };

  const handleSelectProperty = (propertyId: string) => {
    setSelectedProperties(prev => 
      prev.includes(propertyId) 
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedProperties.length === 0) return;

    const confirmDelete = confirm(`Are you sure you want to permanently delete ${selectedProperties.length} properties? This cannot be undone and will remove them from all user accounts.`);
    if (!confirmDelete) return;

    setDeleting(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const propertyId of selectedProperties) {
        try {
          const response = await fetch(`/api/admin/properties?propertyId=${propertyId}`, {
            method: 'DELETE'
          });

          if (response.ok) {
            successCount++;
          } else {
            const error = await response.json();
            console.error(`Failed to delete property ${propertyId}:`, error);
            failCount++;
          }
        } catch (error) {
          console.error(`Error deleting property ${propertyId}:`, error);
          failCount++;
        }
      }

      setSelectedProperties([]);
      fetchProperties();

      if (failCount === 0) {
        alert(`✅ Successfully deleted ${successCount} properties`);
      } else {
        alert(`⚠️ Deleted ${successCount} properties, ${failCount} failed. Check console for details.`);
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert('Failed to delete properties - check console for details');
    } finally {
      setDeleting(false);
    }
  };

  // Dispute functions
  const fetchDisputes = async () => {
    setLoadingDisputes(true);
    try {
      const response = await fetch('/api/admin/disputes');
      const data = await response.json();
      // Combine pending and resolved disputes
      const allDisputes = [
        ...(data.pendingDisputes || []),
        ...(data.resolvedDisputes || [])
      ];
      setDisputes(allDisputes);
    } catch {
    } finally {
      setLoadingDisputes(false);
    }
  };

  // Property edit functions
  const handleEditProperty = (property: AdminProperty) => {
    setEditingProperty(property);
    setEditForm({
      address: property.address || '',
      city: property.city || '',
      state: property.state || '',
      zipCode: property.zipCode || '',
      bedrooms: property.bedrooms || 0,
      bathrooms: property.bathrooms || 0,
      squareFeet: property.squareFeet || 0,
      listPrice: property.listPrice || 0,
      downPaymentAmount: property.downPaymentAmount || 0,
      monthlyPayment: property.monthlyPayment || 0,
      interestRate: property.interestRate || 0,
      termYears: property.termYears || 20,
      description: property.description || '',
      imageUrl: property.imageUrls?.[0] || property.imageUrl || '',
      isActive: property.isActive !== false
    });
  };

  const handleSaveProperty = async () => {
    if (!editingProperty) return;
    
    try {
      const response = await fetch(`/api/admin/properties/${editingProperty.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      
      if (response.ok) {
        alert('Property updated successfully');
        setEditingProperty(null);
        fetchProperties();
      } else {
        const error = await response.json();
        alert(`Failed to update: ${error.error}`);
      }
    } catch {
      alert('Failed to update property');
    }
  };

  const resolveDispute = async (disputeId: string, action: 'approve' | 'deny', refundCredits: number = 1) => {
    try {
      const response = await fetch('/api/admin/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId,
          action,
          refundCredits
        })
      });

      if (response.ok) {
        alert(`Dispute ${action === 'approve' ? 'approved' : 'denied'} successfully${refundCredits > 0 ? ` with ${refundCredits} credit(s) refunded` : ''}`);
        fetchDisputes();
      } else {
        const error = await response.json();
        alert(`Failed to resolve dispute: ${error.error}`);
      }
    } catch (error) {
      console.error('Dispute resolution error:', error);
      alert('Failed to resolve dispute - check console for details');
    }
  };

  // Contact form functions
  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut({ 
        redirect: false 
      });
      router.push('/');
    } catch {
      setIsSigningOut(false);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const response = await fetch('/api/admin/contacts');
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setContacts(data.contacts || []);
    } catch {
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchBuyers = async () => {
    setLoadingBuyers(true);
    try {
      const response = await fetch('/api/admin/buyers');
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setBuyers(data.buyers || []);
    } catch {
    } finally {
      setLoadingBuyers(false);
    }
  };

  const fetchRealtors = async () => {
    setLoadingRealtors(true);
    try {
      const response = await fetch('/api/admin/realtors');
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setRealtors(data.realtors || []);
    } catch {
    } finally {
      setLoadingRealtors(false);
    }
  };

  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };


  useEffect(() => {
    if (activeTab === 'manage') {
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

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-bg flex flex-col">
      <Header />
      
      <div className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 relative">
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="absolute top-0 right-0 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {isSigningOut ? 'Signing out...' : 'Sign Out'}
            </button>
            <h1 className="text-3xl font-bold text-primary-text mb-2">Admin Dashboard</h1>
            <p className="text-secondary-text">Manage properties and system settings</p>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-4 mb-8 justify-center">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'upload' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              📤 Upload Properties
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'manage' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              🏠 Manage Properties
            </button>
            <button
              onClick={() => setActiveTab('disputes')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'disputes' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              ⚖️ Disputes
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'contacts'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              📧 Contact Forms
            </button>
            <button
              onClick={() => setActiveTab('buyers')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'buyers'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              👤 Buyers
            </button>
            <button
              onClick={() => setActiveTab('realtors')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'realtors'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              🏢 Realtors
            </button>
          </div>

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h2 className="text-2xl font-semibold text-slate-900 mb-6">Upload Properties</h2>
              
              <div className="mb-6">
                <label className="block text-lg font-medium text-slate-700 mb-3">
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-base text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
                />
              </div>

              {file && (
                <div className="mb-6 p-4 bg-blue-50 rounded-xl">
                  <p className="text-blue-800 font-medium">File selected: {file.name}</p>
                  <p className="text-blue-600 text-sm">Size: {(file.size / 1024).toFixed(1)} KB</p>
                </div>
              )}

              <Button
                onClick={handleUpload}
                variant="primary"
                size="lg"
                disabled={!file || uploading}
                className="w-full font-semibold text-lg py-5"
              >
                {uploading ? 'Uploading...' : 'Upload Properties'}
              </Button>

              {/* Upload Results */}
              {result && (
                <div className="mt-6">
                  {result.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-800 font-medium">Error: {result.error}</p>
                      {result.details && Array.isArray(result.details) && (
                        <div className="mt-3">
                          <p className="text-red-700 text-sm font-medium">Details:</p>
                          <ul className="text-red-600 text-xs mt-1 space-y-1">
                            {result.details.slice(0, 10).map((error: string | { message?: string; error?: string }, index: number) => (
                              <li key={index}>
                                {typeof error === 'string' ? error : `Error: ${error.message || error.error || 'Unknown error'}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-green-800 mb-4">Upload Results</h3>
                      
                      <div className="grid grid-cols-2 gap-6 mb-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-600">{result.summary?.totalRows || 0}</div>
                          <div className="text-sm text-green-700">Total Rows</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-600">{result.summary?.successfulInserts || 0}</div>
                          <div className="text-sm text-green-700">Inserted</div>
                        </div>
                      </div>

                      {/* Parse Errors Section */}
                      {result.parseErrors && result.parseErrors.length > 0 && (
                        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <h4 className="font-medium text-yellow-800 mb-2">
                            ⚠️ Parse Errors ({result.parseErrors.length} rows skipped):
                          </h4>
                          <div className="text-sm text-yellow-700 space-y-1 max-h-32 overflow-y-auto">
                            {result.parseErrors.slice(0, 10).map((error: string, index: number) => (
                              <div key={index} className="font-mono text-xs bg-yellow-100 p-2 rounded">
                                {error}
                              </div>
                            ))}
                            {result.parseErrors.length > 10 && (
                              <div className="text-yellow-600 text-xs italic">
                                ... and {result.parseErrors.length - 10} more errors
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Duplicates Section */}
                      {result.duplicates && result.duplicates.length > 0 && (
                        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                          <h4 className="font-medium text-orange-800 mb-2">
                            🔄 Duplicates Detected ({result.duplicates.length} rows skipped):
                          </h4>
                          <div className="text-sm text-orange-700 space-y-1 max-h-32 overflow-y-auto">
                            {result.duplicates.slice(0, 10).map((duplicate: string, index: number) => (
                              <div key={index} className="font-mono text-xs bg-orange-100 p-2 rounded">
                                {duplicate}
                              </div>
                            ))}
                            {result.duplicates.length > 10 && (
                              <div className="text-orange-600 text-xs italic">
                                ... and {result.duplicates.length - 10} more duplicates
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {result.insertedProperties && result.insertedProperties.length > 0 && (
                        <div>
                          <p className="font-medium text-green-800 mb-2">Sample Inserted Properties:</p>
                          <div className="text-sm text-green-700 space-y-1">
                            {result.insertedProperties.slice(0, 5).map((property: AdminProperty, index: number) => (
                              <div key={index}>
                                {property.address}, {property.city}, {property.state}
                              </div>
                            ))}
                            {result.insertedProperties.length > 5 && (
                              <div>... and {result.insertedProperties.length - 5} more</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manage Properties Tab */}
          {activeTab === 'manage' && (
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-slate-900">Manage Properties</h2>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-slate-600">
                      Showing {properties.length} properties
                    </span>
                    <button
                      onClick={() => fetchProperties(5000)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                    >
                      Load All
                    </button>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm('⚠️ This will DELETE ALL PROPERTIES from the database. Are you sure?')) {
                        try {
                          const response = await fetch('/api/admin/clean-database', { method: 'POST' });
                          const data = await response.json();
                          if (data.success) {
                            alert(`✅ ${data.message}`);
                            fetchProperties();
                          } else {
                            alert(`❌ Error: ${data.error}`);
                          }
                        } catch (error) {
                          alert(`❌ Failed to clean database: ${error}`);
                        }
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    🗑️ Clean All
                  </button>
                  <button
                    onClick={() => fetchProperties()}
                    disabled={loadingProperties}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400"
                  >
                    {loadingProperties ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>

              {/* Bulk Actions */}
              {properties.length > 0 && (
                <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedProperties.length === properties.length && properties.length > 0}
                        onChange={handleSelectAll}
                        className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-slate-700">Select All ({properties.length})</span>
                    </label>
                    {selectedProperties.length > 0 && (
                      <span className="text-blue-600 font-medium">
                        {selectedProperties.length} selected
                      </span>
                    )}
                  </div>
                  
                  {selectedProperties.length > 0 && (
                    <button
                      onClick={handleDeleteSelected}
                      disabled={deleting}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-slate-400"
                    >
                      {deleting ? 'Deleting...' : `Permanently Delete ${selectedProperties.length} Properties`}
                    </button>
                  )}
                </div>
              )}

              {/* Properties Table */}
              {loadingProperties ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-slate-600">Loading properties...</p>
                </div>
              ) : properties.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🏠</div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">No Properties Yet</h3>
                  <p className="text-slate-600 mb-6">Upload a CSV file to add properties to your system</p>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Upload Properties
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-4 text-left border-b">
                          <input
                            type="checkbox"
                            checked={selectedProperties.length === properties.length && properties.length > 0}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded"
                          />
                        </th>
                        <th className="p-4 text-left border-b font-semibold text-slate-700">Image</th>
                        <th className="p-4 text-left border-b font-semibold text-slate-700">
                          <button
                            onClick={() => handleSort('address')}
                            className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
                          >
                            <span>Address</span>
                            <span className="text-xs">
                              {sortField === 'address' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </button>
                        </th>
                        <th className="p-4 text-left border-b font-semibold text-slate-700">
                          <button
                            onClick={() => handleSort('city')}
                            className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
                          >
                            <span>City, State</span>
                            <span className="text-xs">
                              {sortField === 'city' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </button>
                        </th>
                        <th className="p-4 text-left border-b font-semibold text-slate-700">
                          <button
                            onClick={() => handleSort('listPrice')}
                            className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
                          >
                            <span>Price</span>
                            <span className="text-xs">
                              {sortField === 'listPrice' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </button>
                        </th>
                        <th className="p-4 text-left border-b font-semibold text-slate-700">
                          <button
                            onClick={() => handleSort('bedrooms')}
                            className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
                          >
                            <span>Beds/Baths</span>
                            <span className="text-xs">
                              {sortField === 'bedrooms' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </button>
                        </th>
                        <th className="p-4 text-left border-b font-semibold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {properties.map((property) => (
                        <tr key={property.id} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={selectedProperties.includes(property.id)}
                              onChange={() => handleSelectProperty(property.id)}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded"
                            />
                          </td>
                          <td className="p-4">
                            {(() => {
                              const getValidImageUrl = () => {
                                const urls = [
                                  ...(property.imageUrls || []),
                                  property.imageUrl
                                ].filter(Boolean);

                                for (const url of urls) {
                                  try {
                                    if (url && typeof url === 'string' && url.trim()) {
                                      new URL(url.trim());
                                      return url.trim();
                                    }
                                  } catch {
                                    continue;
                                  }
                                }
                                return null;
                              };

                              const validImageUrl = getValidImageUrl();

                              return validImageUrl ? (
                                <Image
                                  src={validImageUrl}
                                  alt={property.address}
                                  width={80}
                                  height={64}
                                  className="w-20 h-16 object-cover rounded cursor-pointer hover:opacity-80"
                                  onClick={() => window.open(validImageUrl, '_blank')}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = '/placeholder-house.jpg';
                                  }}
                                />
                              ) : (
                                <div className="w-20 h-16 bg-slate-200 rounded flex items-center justify-center text-slate-400">
                                  <span className="text-xs">No Image</span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-slate-900">{property.address}</div>
                          </td>
                          <td className="p-4 text-slate-700">{property.city}, {property.state} {property.zipCode}</td>
                          <td className="p-4">
                            <div className="font-semibold text-green-600">
                              ${property.listPrice?.toLocaleString() || 'N/A'}
                            </div>
                            {property.monthlyPayment && (
                              <div className="text-sm text-slate-500">
                                ${property.monthlyPayment?.toLocaleString()}/mo
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-slate-700">
                            {property.bedrooms || 'N/A'} bed / {property.bathrooms || 'N/A'} bath
                            {property.squareFeet && property.squareFeet > 0 && (
                              <div className="text-sm text-slate-500">{property.squareFeet.toLocaleString()} sq ft</div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEditProperty(property)}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  const confirm = window.confirm(`Permanently delete ${property.address}? This cannot be undone.`);
                                  if (confirm) {
                                    try {
                                      const response = await fetch(`/api/admin/properties/${property.id}`, { method: 'DELETE' });

                                      if (response.ok) {
                                        alert('✅ Property deleted successfully');
                                        fetchProperties();
                                      } else {
                                        const error = await response.json();
                                        alert(`❌ Failed to delete: ${error.error}`);
                                        console.error('Delete error:', error);
                                      }
                                    } catch (error) {
                                      alert('❌ Delete failed - check console for details');
                                      console.error('Delete request failed:', error);
                                    }
                                  }
                                }}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors"
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
              )}
            </div>
          )}

          {/* Disputes Tab */}
          {activeTab === 'disputes' && (
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Lead Disputes</h2>
                  <p className="text-slate-600">Manage realtor complaints and refund requests</p>
                </div>
                <button
                  onClick={fetchDisputes}
                  disabled={loadingDisputes}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400"
                >
                  {loadingDisputes ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {loadingDisputes ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-slate-600">Loading disputes...</p>
                </div>
              ) : disputes.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">⚖️</div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">No Disputes</h3>
                  <p className="text-slate-600">No realtor disputes at this time</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {disputes.map((dispute) => (
                    <div key={dispute.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold text-slate-900">Dispute #{dispute.id.substring(0, 8)}...</h3>
                          <div className="mt-2 space-y-1">
                            <p className="text-slate-800 font-medium">📋 Transaction Details:</p>
                            <p className="text-slate-600">• Realtor: {dispute.realtorName} ({dispute.realtorEmail})</p>
                            <p className="text-slate-600">• Purchase Date: {new Date(dispute.purchaseDate).toLocaleDateString()}</p>
                          </div>
                          <div className="mt-2 space-y-1">
                            <p className="text-slate-800 font-medium">👤 Buyer Information:</p>
                            <p className="text-slate-600">• Name: {dispute.buyerName}</p>
                            <p className="text-slate-600">• Phone: {dispute.buyerPhone || 'Not provided'}</p>
                            <p className="text-slate-600">• Email: {dispute.buyerEmail || 'Not provided'}</p>
                            <p className="text-slate-600">• Location: {dispute.buyerCity}, {dispute.buyerState}</p>
                            <p className="text-slate-600">• Budget: ${dispute.maxMonthlyPayment}/mo, ${dispute.maxDownPayment} down</p>
                          </div>
                          <p className="text-sm text-slate-500 mt-2">Submitted: {dispute.submittedAt?.toDate?.()?.toLocaleString() || 'N/A'}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          dispute.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          dispute.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {dispute.status}
                        </span>
                      </div>

                      <div className="mb-4">
                        <p className="font-medium text-slate-800 mb-2">Reason:</p>
                        <div className="text-slate-700 bg-white p-3 rounded border">
                          <p className="font-semibold">
                            {dispute.reason === 'no_response' ? '❌ No Response from Buyer' :
                             dispute.reason === 'wrong_info' ? '⚠️ Wrong/Invalid Information' :
                             dispute.reason === 'not_interested' ? '🚫 Buyer Not Interested' :
                             dispute.reason === 'other' ? '📝 Other Reason' :
                             dispute.reason || 'No reason provided'}
                          </p>
                          {dispute.explanation && (
                            <p className="mt-2 text-sm">{dispute.explanation}</p>
                          )}
                          {dispute.contactAttempts && (
                            <p className="mt-2 text-sm text-slate-600">
                              <strong>Contact Attempts:</strong> {dispute.contactAttempts}
                            </p>
                          )}
                        </div>
                      </div>
                      {dispute.evidence && Array.isArray(dispute.evidence) && dispute.evidence.length > 0 && (
                        <div className="mb-4">
                          <p className="font-medium text-slate-800 mb-2">Evidence Images:</p>
                          <div className="flex flex-wrap gap-2">
                            {(dispute.evidence as string[])?.map((imageUrl: string, index: number) => (
                              <Image 
                                key={index}
                                src={imageUrl} 
                                alt={`Evidence ${index + 1}`}
                                width={128}
                                height={96}
                                className="w-32 h-24 object-cover rounded border cursor-pointer hover:opacity-80"
                                onClick={() => window.open(imageUrl, '_blank')}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {dispute.status === 'pending' && (
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <label className="text-sm text-slate-700">Credits to refund:</label>
                            <select 
                              id={`credits-${dispute.id}`}
                              className="border border-slate-300 rounded px-2 py-1 text-sm"
                              defaultValue="1"
                            >
                              <option value="1">1 Credit</option>
                              <option value="2">2 Credits</option>
                              <option value="3">3 Credits</option>
                              <option value="5">5 Credits</option>
                            </select>
                          </div>
                          <button
                            onClick={() => {
                              const creditsSelect = document.getElementById(`credits-${dispute.id}`) as HTMLSelectElement;
                              const credits = parseInt(creditsSelect?.value || '1');
                              resolveDispute(dispute.id, 'approve', credits);
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            Approve & Refund Credits
                          </button>
                          <button
                            onClick={() => resolveDispute(dispute.id, 'deny', 0)}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Reject Dispute
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contact Forms Tab */}
          {activeTab === 'contacts' && (
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Contact Form Submissions</h2>
                  <p className="text-slate-600">Messages from website contact forms</p>
                </div>
                <button
                  onClick={fetchContacts}
                  disabled={loadingContacts}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400"
                >
                  {loadingContacts ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {loadingContacts ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-slate-600">Loading contacts...</p>
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📧</div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">No Contact Forms</h3>
                  <p className="text-slate-600">No contact form submissions yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">{contact.name}</h3>
                          <p className="text-slate-600">{contact.email}</p>
                          {contact.phone && <p className="text-slate-600">{contact.phone}</p>}
                        </div>
                        <span className="text-sm text-slate-500">
                          {new Date(contact.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <p className="text-slate-700">{contact.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Buyers Tab */}
          {activeTab === 'buyers' && (
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Buyer Users</h2>
                  <p className="text-slate-600">Manage registered buyers and their statistics</p>
                </div>
                <button
                  onClick={() => fetchBuyers()}
                  disabled={loadingBuyers}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400"
                >
                  {loadingBuyers ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {loadingBuyers ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-slate-600">Loading buyers...</p>
                </div>
              ) : buyers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">👤</div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">No Buyers Yet</h3>
                  <p className="text-slate-600">No registered buyers in the system</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {buyers.map((buyer) => (
                    <div key={buyer.id} className="border border-slate-200 rounded-lg bg-slate-50">
                      {/* Collapsed view */}
                      <div
                        className="p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => toggleRowExpansion(buyer.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <span className="text-lg">{expandedRows.has(buyer.id) ? '▼' : '▶'}</span>
                            <div>
                              <h3 className="font-semibold text-slate-900">{buyer.name}</h3>
                              <p className="text-sm text-slate-600">{buyer.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6 text-sm">
                            <div className="text-center">
                              <div className="font-semibold text-blue-600">{buyer.matchedPropertiesCount}</div>
                              <div className="text-slate-500">Matched</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-green-600">{buyer.likedPropertiesCount}</div>
                              <div className="text-slate-500">Liked</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-purple-600">{buyer.loginCount}</div>
                              <div className="text-slate-500">Logins</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded view */}
                      {expandedRows.has(buyer.id) && (
                        <div className="px-4 pb-4 border-t border-slate-200 bg-white">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                            <div>
                              <label className="text-sm font-medium text-slate-700">Phone</label>
                              <p className="text-slate-900">{buyer.phone || 'Not provided'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700">Primary City</label>
                              <p className="text-slate-900">{buyer.primaryCity ? `${buyer.primaryCity}, ${buyer.primaryState}` : 'Not provided'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700">Down Payment</label>
                              <p className="text-slate-900">{buyer.downPayment ? `$${buyer.downPayment.toLocaleString()}` : 'Not set'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700">Monthly Budget</label>
                              <p className="text-slate-900">{buyer.monthlyBudget ? `$${buyer.monthlyBudget.toLocaleString()}/mo` : 'Not set'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700">Last Sign In</label>
                              <p className="text-slate-900">{buyer.lastSignIn ? new Date(buyer.lastSignIn).toLocaleDateString() : 'Never'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700">Status</label>
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                buyer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {buyer.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Realtors Tab */}
          {activeTab === 'realtors' && (
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Realtor Users</h2>
                  <p className="text-slate-600">Manage registered realtors and their statistics</p>
                </div>
                <button
                  onClick={fetchRealtors}
                  disabled={loadingRealtors}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400"
                >
                  {loadingRealtors ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {loadingRealtors ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-slate-600">Loading realtors...</p>
                </div>
              ) : realtors.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🏢</div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">No Realtors Yet</h3>
                  <p className="text-slate-600">No registered realtors in the system</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {realtors.map((realtor) => (
                    <div key={realtor.id} className="border border-slate-200 rounded-lg bg-slate-50">
                      {/* Collapsed view */}
                      <div
                        className="p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => toggleRowExpansion(realtor.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <span className="text-lg">{expandedRows.has(realtor.id) ? '▼' : '▶'}</span>
                            <div>
                              <h3 className="font-semibold text-slate-900">{realtor.name}</h3>
                              <p className="text-sm text-slate-600">{realtor.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6 text-sm">
                            <div className="text-center">
                              <div className="font-semibold text-blue-600">{realtor.credits}</div>
                              <div className="text-slate-500">Credits</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-green-600">{realtor.availableBuyersCount}</div>
                              <div className="text-slate-500">Available</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-purple-600">{realtor.totalLeadsPurchased}</div>
                              <div className="text-slate-500">Purchased</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded view */}
                      {expandedRows.has(realtor.id) && (
                        <div className="px-4 pb-4 border-t border-slate-200 bg-white">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                            <div>
                              <label className="text-sm font-medium text-slate-700">Phone</label>
                              <p className="text-slate-900">{realtor.phone || 'Not provided'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700">License Number</label>
                              <p className="text-slate-900">{realtor.licenseNumber || 'Not provided'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700">Brokerage</label>
                              <p className="text-slate-900">{realtor.brokerage || 'Not provided'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700">Location</label>
                              <p className="text-slate-900">{realtor.city ? `${realtor.city}, ${realtor.state}` : 'Not provided'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700">Last Sign In</label>
                              <p className="text-slate-900">{realtor.lastSignIn ? new Date(realtor.lastSignIn).toLocaleDateString() : 'Never'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700">Subscription</label>
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                realtor.subscriptionStatus === 'active' ? 'bg-green-100 text-green-800' :
                                realtor.subscriptionStatus === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {realtor.subscriptionStatus || 'none'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Edit Property Modal */}
      {editingProperty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Edit Property</h2>
              <button
                onClick={() => setEditingProperty(null)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Property ID (read-only) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Property ID</label>
                <input
                  type="text"
                  value={editingProperty.id}
                  disabled
                  className="w-full p-2 border rounded bg-slate-100 text-slate-500"
                />
              </div>
              
              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              
              {/* City, State, Zip in a row */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={editForm.state}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Zip Code</label>
                  <input
                    type="text"
                    value={editForm.zipCode}
                    onChange={(e) => setEditForm({ ...editForm, zipCode: e.target.value })}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
              
              {/* Beds, Baths, Sq Ft */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bedrooms</label>
                  <input
                    type="number"
                    value={editForm.bedrooms}
                    onChange={(e) => setEditForm({ ...editForm, bedrooms: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bathrooms</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editForm.bathrooms}
                    onChange={(e) => setEditForm({ ...editForm, bathrooms: parseFloat(e.target.value) })}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Square Feet</label>
                  <input
                    type="number"
                    value={editForm.squareFeet}
                    onChange={(e) => setEditForm({ ...editForm, squareFeet: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
              
              {/* Financial Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">List Price</label>
                  <input
                    type="number"
                    value={editForm.listPrice}
                    onChange={(e) => setEditForm({ ...editForm, listPrice: parseFloat(e.target.value) })}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Down Payment</label>
                  <input
                    type="number"
                    value={editForm.downPaymentAmount}
                    onChange={(e) => setEditForm({ ...editForm, downPaymentAmount: parseFloat(e.target.value) })}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Payment</label>
                  <input
                    type="number"
                    value={editForm.monthlyPayment}
                    onChange={(e) => setEditForm({ ...editForm, monthlyPayment: parseFloat(e.target.value) })}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.interestRate}
                    onChange={(e) => setEditForm({ ...editForm, interestRate: parseFloat(e.target.value) })}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Term (Years)</label>
                  <input
                    type="number"
                    value={editForm.termYears}
                    onChange={(e) => setEditForm({ ...editForm, termYears: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full p-2 border rounded"
                  rows={3}
                />
              </div>
              
              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
                <input
                  type="text"
                  value={editForm.imageUrl}
                  onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                  className="w-full p-2 border rounded"
                />
                {editForm.imageUrl && (
                  <Image 
                    src={editForm.imageUrl || '/placeholder-house.jpg'} 
                    alt="Preview" 
                    width={400}
                    height={192}
                    className="mt-2 w-full h-48 object-cover rounded"
                  />
                )}
              </div>
              
              {/* Active Status */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 text-sm font-medium text-slate-700">
                  Property is Active
                </label>
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setEditingProperty(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProperty}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}