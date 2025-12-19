'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds?: number;
}

interface Realtor {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  licenseNumber?: string;
  state?: string;
  createdAt: string | FirestoreTimestamp;
}

export default function AdminRealtors() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [realtors, setRealtors] = useState<Realtor[]>([]);
  const [selectedRealtors, setSelectedRealtors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || (session?.user as { role?: string })?.role !== 'admin') {
      router.push('/');
    } else {
      loadRealtors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  const loadRealtors = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/realtors');
      if (response.ok) {
        const data = await response.json();
        setRealtors(data.realtors || []);
      }
    } catch (error) {
      console.error('Error loading realtors:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectRealtor = (realtorId: string) => {
    const newSelected = new Set(selectedRealtors);
    if (newSelected.has(realtorId)) {
      newSelected.delete(realtorId);
    } else {
      newSelected.add(realtorId);
    }
    setSelectedRealtors(newSelected);
    setSelectAll(newSelected.size === realtors.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRealtors(new Set());
      setSelectAll(false);
    } else {
      const allRealtorIds = new Set(realtors.map(r => r.id));
      setSelectedRealtors(allRealtorIds);
      setSelectAll(true);
    }
  };

  const deleteRealtors = async () => {
    if (selectedRealtors.size === 0) return;

    const confirmMsg = `Are you sure you want to delete ${selectedRealtors.size} realtor(s)? This action cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    setDeleting(true);
    try {
      const response = await fetch('/api/admin/realtors', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realtorIds: Array.from(selectedRealtors) })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully deleted ${result.deletedCount} realtor(s)`);
        setSelectedRealtors(new Set());
        setSelectAll(false);
        loadRealtors();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting realtors:', error);
      alert('Failed to delete realtors');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="text-center text-white">Loading realtors...</div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-900 flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="text-emerald-400 hover:text-emerald-300 mb-4 inline-block">
            ← Back to Admin Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Manage Realtors</h1>
          <p className="text-slate-400">Total: {realtors.length} realtors</p>
        </div>

        {/* Actions Bar */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Select All</span>
            </label>
            <span className="text-slate-400">
              {selectedRealtors.size > 0 && `${selectedRealtors.size} selected`}
            </span>
          </div>

          <button
            onClick={deleteRealtors}
            disabled={selectedRealtors.size === 0 || deleting}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              selectedRealtors.size > 0
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {deleting ? 'Deleting...' : `Delete Selected (${selectedRealtors.size})`}
          </button>
        </div>

        {/* Realtors Table */}
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700 text-white">
                <tr>
                  <th className="p-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Phone</th>
                  <th className="p-3 text-left">Company</th>
                  <th className="p-3 text-left">License</th>
                  <th className="p-3 text-left">State</th>
                  <th className="p-3 text-left">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {realtors.map((realtor) => (
                  <tr key={realtor.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedRealtors.has(realtor.id)}
                        onChange={() => toggleSelectRealtor(realtor.id)}
                        className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="p-3 text-white">
                      {realtor.firstName || realtor.lastName
                        ? `${realtor.firstName || ''} ${realtor.lastName || ''}`.trim()
                        : 'N/A'}
                    </td>
                    <td className="p-3 text-slate-300">{realtor.email}</td>
                    <td className="p-3 text-slate-300">{realtor.phone || 'N/A'}</td>
                    <td className="p-3 text-slate-300">{realtor.company || 'N/A'}</td>
                    <td className="p-3 text-slate-300">{realtor.licenseNumber || 'N/A'}</td>
                    <td className="p-3 text-slate-300">{realtor.state || 'N/A'}</td>
                    <td className="p-3 text-slate-300">
                      {(() => {
                        if (!realtor.createdAt) return 'N/A';
                        const ts = realtor.createdAt;
                        // Handle serialized Firestore timestamp { _seconds, _nanoseconds }
                        if (typeof ts === 'object' && '_seconds' in ts && typeof ts._seconds === 'number') {
                          return new Date(ts._seconds * 1000).toLocaleDateString();
                        }
                        // Handle ISO string or other date formats
                        const date = new Date(ts);
                        return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {realtors.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                No realtors found
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}