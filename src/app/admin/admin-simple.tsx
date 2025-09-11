'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ 
    error?: string; 
    success?: string; 
    processed?: number;
    summary?: {
      successfulInserts?: number;
    };
  } | null>(null);
  const [properties, setProperties] = useState<Array<{ id: string; address: string; city: string; state: string; listPrice: number; isActive: boolean }>>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && (session?.user as { role?: string })?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  // Upload function
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

      const data = await response.json();
      setResult(data);
    } catch {
      setResult({ error: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  // Property management functions
  const fetchProperties = async () => {
    setLoadingProperties(true);
    try {
      const response = await fetch('/api/admin/properties');
      const data = await response.json();
      setProperties(data.properties || []);
    } catch (error) {
    } finally {
      setLoadingProperties(false);
    }
  };

  const handleSelectAll = () => {
    setSelectedProperties(
      selectedProperties.length === properties.length ? [] : properties.map(p => p.id)
    );
  };

  const deleteSelected = async () => {
    if (selectedProperties.length === 0) return;
    
    const confirmDelete = confirm(`Permanently delete ${selectedProperties.length} properties?`);
    if (!confirmDelete) return;
    
    try {
      for (const propertyId of selectedProperties) {
        await fetch(`/api/admin/properties?propertyId=${propertyId}`, {
          method: 'DELETE'
        });
      }
      setSelectedProperties([]);
      fetchProperties();
      alert('Properties deleted successfully');
    } catch {
      alert('Failed to delete properties');
    }
  };

  useEffect(() => {
    if (activeTab === 'manage') {
      fetchProperties();
    }
  }, [activeTab]);

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>
        
        {/* Tabs */}
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 rounded-lg font-medium ${
              activeTab === 'upload' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📤 Upload
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-6 py-3 rounded-lg font-medium ${
              activeTab === 'manage' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            🏠 Manage
          </button>
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="bg-white rounded-lg p-6 shadow">
            <h2 className="text-2xl font-semibold mb-6">Upload Properties</h2>
            
            <div className="mb-6">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload CSV'}
            </button>

            {result && (
              <div className="mt-6 p-4 border rounded-lg">
                {result.error ? (
                  <div className="text-red-800">
                    <h3 className="font-semibold">Error: {result.error}</h3>
                  </div>
                ) : (
                  <div className="text-green-800">
                    <h3 className="font-semibold">Success!</h3>
                    <p>{result.summary?.successfulInserts || 0} properties uploaded</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Manage Tab */}
        {activeTab === 'manage' && (
          <div className="bg-white rounded-lg p-6 shadow">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">Manage Properties</h2>
              <button
                onClick={fetchProperties}
                disabled={loadingProperties}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loadingProperties ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {properties.length > 0 && (
              <div className="mb-4 flex justify-between items-center">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedProperties.length === properties.length}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                  <span>Select All ({properties.length})</span>
                </label>
                {selectedProperties.length > 0 && (
                  <button
                    onClick={deleteSelected}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete {selectedProperties.length} Selected
                  </button>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left border">Select</th>
                    <th className="p-3 text-left border">Address</th>
                    <th className="p-3 text-left border">City</th>
                    <th className="p-3 text-left border">Price</th>
                    <th className="p-3 text-left border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((property) => (
                    <tr key={property.id} className="hover:bg-gray-50">
                      <td className="p-3 border">
                        <input
                          type="checkbox"
                          checked={selectedProperties.includes(property.id)}
                          onChange={() => {
                            setSelectedProperties(prev =>
                              prev.includes(property.id)
                                ? prev.filter(id => id !== property.id)
                                : [...prev, property.id]
                            );
                          }}
                          className="rounded"
                        />
                      </td>
                      <td className="p-3 border font-medium">{property.address}</td>
                      <td className="p-3 border">{property.city}, {property.state}</td>
                      <td className="p-3 border">${property.listPrice?.toLocaleString()}</td>
                      <td className="p-3 border">
                        <button
                          onClick={async () => {
                            const confirm = window.confirm(`Delete ${property.address}?`);
                            if (confirm) {
                              await fetch(`/api/admin/properties?propertyId=${property.id}`, { method: 'DELETE' });
                              fetchProperties();
                            }
                          }}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}