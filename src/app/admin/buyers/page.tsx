'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BuyerAdminView } from '@/lib/view-models';

export default function AdminBuyers() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [buyers, setBuyers] = useState<BuyerAdminView[]>([]);
  const [selectedBuyers, setSelectedBuyers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || (session?.user as any)?.role !== 'admin') {
      router.push('/');
    } else {
      loadBuyers();
    }
  }, [status, session, router]);

  const loadBuyers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/buyers');
      if (response.ok) {
        const data = await response.json();
        setBuyers(data.buyers || []);
      }
    } catch (error) {
      console.error('Error loading buyers:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectBuyer = (buyerId: string) => {
    const newSelected = new Set(selectedBuyers);
    if (newSelected.has(buyerId)) {
      newSelected.delete(buyerId);
    } else {
      newSelected.add(buyerId);
    }
    setSelectedBuyers(newSelected);
    setSelectAll(newSelected.size === buyers.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedBuyers(new Set());
      setSelectAll(false);
    } else {
      const allBuyerIds = new Set(buyers.map(b => b.id));
      setSelectedBuyers(allBuyerIds);
      setSelectAll(true);
    }
  };

  const deleteBuyers = async () => {
    if (selectedBuyers.size === 0) return;

    const confirmMsg = `Are you sure you want to delete ${selectedBuyers.size} buyer(s)? This action cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    setDeleting(true);
    try {
      const response = await fetch('/api/admin/buyers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerIds: Array.from(selectedBuyers) })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully deleted ${result.deletedCount} buyer(s)`);
        setSelectedBuyers(new Set());
        setSelectAll(false);
        loadBuyers();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting buyers:', error);
      alert('Failed to delete buyers');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="text-center text-white">Loading buyers...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8 relative isolate">
      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="text-emerald-400 hover:text-emerald-300 mb-4 inline-block">
            ← Back to Admin Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Manage Buyers</h1>
          <p className="text-slate-400">Total: {buyers.length} buyers</p>
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
              {selectedBuyers.size > 0 && `${selectedBuyers.size} selected`}
            </span>
          </div>

          <button
            onClick={deleteBuyers}
            disabled={selectedBuyers.size === 0 || deleting}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              selectedBuyers.size > 0
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {deleting ? 'Deleting...' : `Delete Selected (${selectedBuyers.size})`}
          </button>
        </div>

        {/* Buyers Table */}
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
                  <th className="p-3 text-left">Location</th>
                  <th className="p-3 text-left">Monthly Payment</th>
                  <th className="p-3 text-left">Down Payment</th>
                  <th className="p-3 text-left">Joined</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {buyers.map((buyer) => (
                  <tr key={buyer.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedBuyers.has(buyer.id)}
                        onChange={() => toggleSelectBuyer(buyer.id)}
                        className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="p-3 text-white">
                      {buyer.firstName || buyer.lastName
                        ? `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim()
                        : 'N/A'}
                    </td>
                    <td className="p-3 text-slate-300">{buyer.email}</td>
                    <td className="p-3 text-slate-300">{buyer.phone || 'N/A'}</td>
                    <td className="p-3 text-slate-300">
                      {(buyer.preferredCity || buyer.city) && (buyer.preferredState || buyer.state)
                        ? `${buyer.preferredCity || buyer.city}, ${buyer.preferredState || buyer.state}`
                        : 'N/A'}
                    </td>
                    <td className="p-3 text-slate-300">
                      {buyer.maxMonthlyPayment
                        ? `$${buyer.maxMonthlyPayment.toLocaleString()}/mo`
                        : 'N/A'}
                    </td>
                    <td className="p-3 text-emerald-400 font-semibold">
                      {buyer.maxDownPayment
                        ? `$${buyer.maxDownPayment.toLocaleString()}`
                        : '$0'}
                    </td>
                    <td className="p-3 text-slate-300">
                      {buyer.createdAt && typeof buyer.createdAt === 'object' && 'toDate' in buyer.createdAt
                        ? new Date((buyer.createdAt as any).toDate()).toLocaleDateString()
                        : buyer.createdAt
                        ? new Date(buyer.createdAt as any).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/admin/buyers/preview/${buyer.id}`}
                        className="text-emerald-400 hover:text-emerald-300 font-semibold text-sm"
                      >
                        👁️ Preview
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {buyers.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                No buyers found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}