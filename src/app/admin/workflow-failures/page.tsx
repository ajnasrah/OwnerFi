'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LateFailure {
  id: string;
  brand: string;
  platforms: string[];
  failedPlatforms?: string[];
  caption: string;
  error: string;
  timestamp: string;
  status: string;
}

interface SubmagicJob {
  workflowId: string;
  brand: string;
  submagicJobId: string;
  currentStage: string;
  submagicStatus: string;
  submagicError?: string;
  stuckDuration: number;
}

export default function WorkflowFailuresPage() {
  const [lateFailures, setLateFailures] = useState<LateFailure[]>([]);
  const [submagicJobs, setSubmagicJobs] = useState<SubmagicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'late' | 'submagic'>('late');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Late failures
      const lateResponse = await fetch('/api/admin/late-failures?status=failed&days=7&limit=50');
      const lateData = await lateResponse.json();

      if (lateData.success) {
        setLateFailures(lateData.failures);
      }

      // Fetch stuck Submagic jobs
      const submagicResponse = await fetch('/api/admin/submagic-status?stuck=true');
      const submagicData = await submagicResponse.json();

      if (submagicData.success) {
        setSubmagicJobs(submagicData.results);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getErrorSeverity = (error: string): 'critical' | 'warning' | 'info' => {
    const lowerError = error.toLowerCase();

    if (lowerError.includes('401') || lowerError.includes('token') || lowerError.includes('auth')) {
      return 'critical';
    }
    if (lowerError.includes('429') || lowerError.includes('rate limit')) {
      return 'warning';
    }
    return 'info';
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Workflow Failures Dashboard</h1>
              <p className="text-gray-600">Monitor and troubleshoot posting and video processing issues</p>
            </div>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>

          {/* Quick Links */}
          <div className="flex gap-4">
            <Link
              href="/admin/late-failures"
              className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              View All Late Failures →
            </Link>
            <Link
              href="/admin/social-dashboard"
              className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Social Dashboard →
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-600">Late Posting Failures</div>
                <div className="mt-2 text-3xl font-bold text-red-600">{lateFailures.length}</div>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-600">Stuck Submagic Jobs</div>
                <div className="mt-2 text-3xl font-bold text-yellow-600">{submagicJobs.length}</div>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-600">Total Issues</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">
                  {lateFailures.length + submagicJobs.length}
                </div>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('late')}
                className={`${
                  activeTab === 'late'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Late Posting Failures ({lateFailures.length})
              </button>
              <button
                onClick={() => setActiveTab('submagic')}
                className={`${
                  activeTab === 'submagic'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Stuck Submagic Jobs ({submagicJobs.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-gray-600">Loading...</div>
          </div>
        ) : (
          <div>
            {/* Late Failures Tab */}
            {activeTab === 'late' && (
              <div className="space-y-4">
                {lateFailures.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="text-green-600 font-medium">No Late posting failures! 🎉</div>
                  </div>
                ) : (
                  lateFailures.map((failure) => {
                    const severity = getErrorSeverity(failure.error);

                    return (
                      <div key={failure.id} className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                {failure.brand}
                              </span>
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                severity === 'critical' ? 'bg-red-100 text-red-800' :
                                severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {severity === 'critical' ? '🔴 Critical' :
                                 severity === 'warning' ? '⚠️ Warning' :
                                 'ℹ️ Info'}
                              </span>
                              <span className="text-sm text-gray-500">
                                {(() => {
                                  const ts = failure.timestamp as any;
                                  if (!ts) return 'N/A';
                                  if (typeof ts === 'object' && typeof ts._seconds === 'number') return new Date(ts._seconds * 1000).toLocaleString();
                                  if (typeof ts === 'object' && typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleString();
                                  const date = new Date(ts);
                                  return isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
                                })()}
                              </span>
                            </div>

                            <div className="mb-3">
                              <div className="text-sm font-medium text-gray-700 mb-1">Failed Platforms:</div>
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

                            <div className="text-sm text-red-600 bg-red-50 rounded p-3 font-mono">
                              {failure.error}
                            </div>
                          </div>

                          <Link
                            href={`/admin/late-failures`}
                            className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Submagic Jobs Tab */}
            {activeTab === 'submagic' && (
              <div className="space-y-4">
                {submagicJobs.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="text-green-600 font-medium">No stuck Submagic jobs! 🎉</div>
                  </div>
                ) : (
                  submagicJobs.map((job) => (
                    <div key={job.workflowId} className="bg-white rounded-lg shadow p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                              {job.brand}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              job.submagicStatus === 'failed' ? 'bg-red-100 text-red-800' :
                              job.submagicStatus === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {job.submagicStatus}
                            </span>
                            <span className="text-sm text-gray-500">
                              Stuck for {job.stuckDuration} minutes
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                            <div>
                              <span className="font-medium text-gray-700">Workflow ID:</span>{' '}
                              <span className="font-mono text-gray-900">{job.workflowId}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Submagic Job:</span>{' '}
                              <span className="font-mono text-gray-900">{job.submagicJobId}</span>
                            </div>
                          </div>

                          {job.submagicError && (
                            <div className="text-sm text-red-600 bg-red-50 rounded p-3 font-mono">
                              {job.submagicError}
                            </div>
                          )}
                        </div>

                        <div className="ml-4 flex flex-col gap-2">
                          <button
                            onClick={() => window.open(`/api/workflow/retry-submagic?workflowId=${job.workflowId}`, '_blank')}
                            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                          >
                            Retry Submagic
                          </button>
                          <Link
                            href={`/admin/social-dashboard`}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md text-sm text-center hover:bg-blue-200"
                          >
                            View Workflow
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
