'use client';

import { useState, useEffect } from 'react';

interface LateFailure {
  id: string;
  postId?: string;
  brand: string;
  platforms: string[];
  failedPlatforms?: string[];
  caption: string;
  videoUrl: string;
  error: string;
  timestamp: string;
  retryCount: number;
  status: 'failed' | 'retrying' | 'resolved';
  workflowId?: string;
}

interface Stats {
  total: number;
  byBrand: Record<string, number>;
  byPlatform: Record<string, number>;
  byStatus: {
    failed: number;
    retrying: number;
    resolved: number;
  };
  commonErrors: Record<string, number>;
}

export default function LateFailuresPage() {
  const [failures, setFailures] = useState<LateFailure[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('failed');
  const [days, setDays] = useState<number>(7);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchFailures();
  }, [selectedBrand, selectedStatus, days]);

  const fetchFailures = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: selectedStatus,
        days: days.toString(),
        limit: '100',
      });

      if (selectedBrand !== 'all') {
        params.append('brand', selectedBrand);
      }

      const response = await fetch(`/api/admin/late-failures?${params}`);
      const data = await response.json();

      if (data.success) {
        setFailures(data.failures);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching failures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (failure: LateFailure) => {
    if (retrying.has(failure.id)) return;

    setRetrying(prev => new Set(prev).add(failure.id));

    try {
      // Call retry endpoint - you'll need to implement this
      const response = await fetch('/api/admin/retry-late-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          failureId: failure.id,
          brand: failure.brand,
          platforms: failure.failedPlatforms || failure.platforms,
          caption: failure.caption,
          videoUrl: failure.videoUrl,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Retry initiated successfully!');
        fetchFailures(); // Refresh the list
      } else {
        alert(`Retry failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error retrying post:', error);
      alert('Failed to retry post');
    } finally {
      setRetrying(prev => {
        const next = new Set(prev);
        next.delete(failure.id);
        return next;
      });
    }
  };

  const getErrorCategory = (error: string): { type: string; color: string } => {
    const lowerError = error.toLowerCase();

    if (lowerError.includes('401') || lowerError.includes('invalid token') || lowerError.includes('unauthorized')) {
      return { type: 'Auth Issue (401)', color: 'bg-red-100 text-red-800' };
    }
    if (lowerError.includes('429') || lowerError.includes('rate limit')) {
      return { type: 'Rate Limited', color: 'bg-yellow-100 text-yellow-800' };
    }
    if (lowerError.includes('timeout')) {
      return { type: 'Timeout', color: 'bg-orange-100 text-orange-800' };
    }
    if (lowerError.includes('token refresh')) {
      return { type: 'Token Refresh Failed', color: 'bg-red-100 text-red-800' };
    }
    if (lowerError.includes('missing connected accounts')) {
      return { type: 'Missing Accounts', color: 'bg-purple-100 text-purple-800' };
    }

    return { type: 'Other Error', color: 'bg-gray-100 text-gray-800' };
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Late Posting Failures</h1>
          <p className="text-gray-600">Track and diagnose social media posting issues</p>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Total Failures</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Currently Failed</div>
              <div className="mt-2 text-3xl font-bold text-red-600">{stats.byStatus.failed}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Retrying</div>
              <div className="mt-2 text-3xl font-bold text-yellow-600">{stats.byStatus.retrying}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Resolved</div>
              <div className="mt-2 text-3xl font-bold text-green-600">{stats.byStatus.resolved}</div>
            </div>
          </div>
        )}

        {/* Common Errors */}
        {stats && Object.keys(stats.commonErrors).length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Common Error Types</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.commonErrors)
                .sort((a, b) => b[1] - a[1])
                .map(([error, count]) => (
                  <div key={error} className="border rounded p-3">
                    <div className="text-sm text-gray-600">{error}</div>
                    <div className="text-2xl font-bold text-gray-900">{count}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="all">All Brands</option>
                <option value="ownerfi">OwnerFi</option>
                <option value="carz">Carz</option>
                <option value="podcast">Podcast</option>
                <option value="vassdistro">VassDistro</option>
                <option value="benefit">Benefit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="all">All Statuses</option>
                <option value="failed">Failed</option>
                <option value="retrying">Retrying</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
              <select
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="1">Last 24 hours</option>
                <option value="3">Last 3 days</option>
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </div>
          </div>

          <button
            onClick={fetchFailures}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {/* Failures List */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-gray-600">Loading failures...</div>
            </div>
          ) : failures.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-gray-600">No failures found for the selected filters</div>
            </div>
          ) : (
            failures.map((failure) => {
              const errorCategory = getErrorCategory(failure.error);

              return (
                <div key={failure.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          {failure.brand}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${errorCategory.color}`}>
                          {errorCategory.type}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(failure.timestamp).toLocaleString()}
                        </span>
                      </div>

                      {/* Caption */}
                      <div className="mb-3">
                        <div className="text-sm font-medium text-gray-700 mb-1">Caption:</div>
                        <div className="text-sm text-gray-900 line-clamp-2">
                          {failure.caption || 'No caption'}
                        </div>
                      </div>

                      {/* Platforms */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="text-sm font-medium text-gray-700">Failed Platforms:</div>
                        <div className="flex gap-2">
                          {(failure.failedPlatforms || failure.platforms).map((platform) => (
                            <span
                              key={platform}
                              className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-medium"
                            >
                              {platform}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Error Message */}
                      <div className="mb-3">
                        <div className="text-sm font-medium text-gray-700 mb-1">Error:</div>
                        <div className="text-sm text-red-600 bg-red-50 rounded p-3 font-mono">
                          {failure.error}
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
                        {failure.postId && (
                          <div>
                            <span className="font-medium">Post ID:</span> {failure.postId}
                          </div>
                        )}
                        {failure.workflowId && (
                          <div>
                            <span className="font-medium">Workflow:</span> {failure.workflowId.substring(0, 8)}...
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Retry Count:</span> {failure.retryCount}
                        </div>
                        <div>
                          <span className="font-medium">Status:</span>{' '}
                          <span className={
                            failure.status === 'failed' ? 'text-red-600' :
                            failure.status === 'retrying' ? 'text-yellow-600' :
                            'text-green-600'
                          }>
                            {failure.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="ml-4 flex flex-col gap-2">
                      <button
                        onClick={() => handleRetry(failure)}
                        disabled={retrying.has(failure.id) || failure.status === 'resolved'}
                        className={`px-4 py-2 rounded-md text-sm font-medium ${
                          failure.status === 'resolved'
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : retrying.has(failure.id)
                            ? 'bg-yellow-200 text-yellow-700 cursor-wait'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {retrying.has(failure.id) ? 'Retrying...' : 'Retry Post'}
                      </button>

                      {failure.videoUrl && (
                        <a
                          href={failure.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md text-sm font-medium text-center hover:bg-blue-200"
                        >
                          View Video
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
