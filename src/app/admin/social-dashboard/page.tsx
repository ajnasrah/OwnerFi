'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface SchedulerStatus {
  timestamp: string;
  scheduler: {
    running: boolean;
    config: {
      maxVideosPerDay: {
        carz: number;
        ownerfi: number;
      };
    };
  };
  feeds: {
    total: number;
    carz: number;
    ownerfi: number;
  };
  articles?: {
    carz: number;
    ownerfi: number;
  };
  queue: {
    carz: {
      pending: number;
      items: any[];
    };
    ownerfi: {
      pending: number;
      items: any[];
    };
  };
  stats?: {
    carz: {
      totalFeeds: number;
      activeFeeds: number;
      totalArticles: number;
      unprocessedArticles: number;
      videosGenerated: number;
      queuePending: number;
      queueProcessing: number;
    };
    ownerfi: {
      totalFeeds: number;
      activeFeeds: number;
      totalArticles: number;
      unprocessedArticles: number;
      videosGenerated: number;
      queuePending: number;
      queueProcessing: number;
    };
  };
  results?: Array<{
    brand: string;
    success: boolean;
    article?: string;
    videoId?: string;
    error?: string;
  }>;
}

interface WorkflowLog {
  id: string;
  articleId: string;
  articleTitle: string;
  brand: 'carz' | 'ownerfi';
  status: 'pending' | 'heygen_processing' | 'submagic_processing' | 'posting' | 'completed' | 'failed';
  heygenVideoId?: string;
  submagicVideoId?: string;
  metricoolPostId?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface WorkflowLogs {
  success: boolean;
  workflows: {
    carz: WorkflowLog[];
    ownerfi: WorkflowLog[];
  };
  timestamp: string;
}

interface PodcastWorkflowLog {
  id: string;
  episodeNumber: number;
  episodeTitle: string;
  guestName: string;
  topic: string;
  status: 'script_generation' | 'heygen_processing' | 'submagic_processing' | 'publishing' | 'completed' | 'failed';
  heygenVideoId?: string;
  submagicProjectId?: string;
  finalVideoUrl?: string;
  metricoolPostId?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface PodcastWorkflowLogs {
  success: boolean;
  workflows: PodcastWorkflowLog[];
  timestamp: string;
}

export default function SocialMediaDashboard() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [activeSubTab, setActiveSubTab] = useState<'carz' | 'ownerfi' | 'podcast'>('carz');
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowLogs | null>(null);
  const [podcastWorkflows, setPodcastWorkflows] = useState<PodcastWorkflowLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringViral, setTriggeringViral] = useState(false);
  const [triggeringPodcast, setTriggeringPodcast] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [deletingWorkflow, setDeletingWorkflow] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }

    if (authStatus === 'authenticated') {
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
  }, [authStatus, session, router]);

  useEffect(() => {
    if (authStatus === 'authenticated' && (session?.user as { role?: string })?.role === 'admin') {
      loadStatus();
      loadWorkflows();
      loadPodcastWorkflows();
      const statusInterval = setInterval(loadStatus, 30000); // Refresh every 30 seconds
      const workflowInterval = setInterval(loadWorkflows, 5000); // Refresh every 5 seconds for real-time updates
      const podcastWorkflowInterval = setInterval(loadPodcastWorkflows, 5000); // Refresh every 5 seconds for real-time updates
      return () => {
        clearInterval(statusInterval);
        clearInterval(workflowInterval);
        clearInterval(podcastWorkflowInterval);
      };
    }
  }, [showHistory, authStatus, session]);

  const loadWorkflows = async () => {
    try {
      const url = showHistory ? '/api/workflow/logs?history=true' : '/api/workflow/logs';
      const response = await fetch(url);
      const data = await response.json();
      setWorkflows(data);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  };

  const loadPodcastWorkflows = async () => {
    try {
      const response = await fetch('/api/podcast/workflow/logs');
      const data = await response.json();
      setPodcastWorkflows(data);
    } catch (error) {
      console.error('Failed to load podcast workflows:', error);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/debug/scheduler-status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to load status:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerCron = async () => {
    setTriggeringViral(true);
    try {
      const response = await fetch('/api/cron/viral-video', {
        method: 'POST',
        credentials: 'include', // Include cookies for session auth
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cron trigger failed:', response.status, errorText);
        alert(`Failed to trigger cron (${response.status}): ${errorText}`);
        return;
      }

      const data = await response.json();

      if (data.success) {
        alert(`Cron triggered successfully!\n\nWorkflows started: ${data.workflowsTriggered?.join(', ') || 'none'}\nNew articles: ${data.stats?.newArticlesFetched || 0}`);
        loadStatus();
        loadWorkflows();
      } else {
        alert(`Error: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Cron trigger error:', error);
      alert(`Failed to trigger cron: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTriggeringViral(false);
    }
  };

  const triggerPodcastCron = async () => {
    setTriggeringPodcast(true);
    try {
      const response = await fetch('/api/podcast/cron?force=true', { method: 'POST' });
      const data = await response.json();
      alert(data.success ? 'Podcast cron triggered successfully!' : `Error: ${data.error}`);
    } catch (error) {
      alert('Failed to trigger podcast cron');
    } finally {
      setTriggeringPodcast(false);
    }
  };

  const deleteWorkflow = async (workflowId: string, brand: 'carz' | 'ownerfi') => {
    if (!confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
      return;
    }

    setDeletingWorkflow(workflowId);
    try {
      const response = await fetch(`/api/workflow/delete?workflowId=${workflowId}&brand=${brand}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (data.success) {
        // Refresh workflows list
        await loadWorkflows();
      } else {
        alert(`Failed to delete workflow: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to delete workflow');
      console.error('Delete error:', error);
    } finally {
      setDeletingWorkflow(null);
    }
  };

  const getStatusColor = (status: WorkflowLog['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-700';
      case 'heygen_processing': return 'bg-blue-100 text-blue-700';
      case 'submagic_processing': return 'bg-purple-100 text-purple-700';
      case 'posting': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPodcastStatusColor = (status: PodcastWorkflowLog['status']) => {
    switch (status) {
      case 'script_generation': return 'bg-gray-100 text-gray-700';
      case 'heygen_processing': return 'bg-blue-100 text-blue-700';
      case 'submagic_processing': return 'bg-purple-100 text-purple-700';
      case 'publishing': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatStatus = (status: WorkflowLog['status'] | PodcastWorkflowLog['status']) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg font-medium text-gray-900">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Social Media Automation</h1>
          <p className="text-slate-600 mt-1">Monitor and control viral video generation</p>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex space-x-2 mb-6">
          {[
            { key: 'carz', label: 'Carz Inc', icon: '🚗' },
            { key: 'ownerfi', label: 'OwnerFi', icon: '🏠' },
            { key: 'podcast', label: 'Podcast', icon: '🎙️' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key as any)}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeSubTab === tab.key
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-600">System Mode</div>
                <div className="text-lg font-bold text-slate-900 mt-1">
                  Serverless Cron
                </div>
                <div className="text-xs text-slate-500 mt-1">Runs every 2 hours</div>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-100">
                <div className="w-6 h-6 rounded-full bg-blue-500"></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-600">RSS Feeds</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {status?.feeds?.total || 0}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {status?.feeds?.carz || 0} Carz • {status?.feeds?.ownerfi || 0} OwnerFi
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📰</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-600">Articles in Queue</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {(status?.stats?.carz?.unprocessedArticles || 0) + (status?.stats?.ownerfi?.unprocessedArticles || 0)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {status?.stats?.carz?.unprocessedArticles || 0} Carz • {status?.stats?.ownerfi?.unprocessedArticles || 0} OwnerFi
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
            </div>
          </div>
        </div>

        {/* Brand-Specific Content */}
        {activeSubTab === 'carz' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Carz Inc Status</h3>
                <button
                  onClick={triggerCron}
                  disabled={triggeringViral}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggeringViral ? 'Generating...' : 'Generate Video Now'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Daily Limit</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.scheduler?.config?.maxVideosPerDay?.carz || 5}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">videos/day</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Available Articles</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.stats?.carz?.unprocessedArticles || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">ready to process</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">In Queue</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {(status?.stats?.carz?.queuePending || 0) + (status?.stats?.carz?.queueProcessing || 0)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {status?.stats?.carz?.queueProcessing || 0} processing
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">RSS Feeds</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.feeds?.carz || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">active sources</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Publishing Platforms</h4>
                <div className="flex flex-wrap gap-2">
                  {['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn'].map((platform) => (
                    <span key={platform} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {platform}
                    </span>
                  ))}
                </div>
              </div>

              {/* Workflow Logs */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-900">Workflows</h4>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                  >
                    {showHistory ? 'Active Only' : 'Show History'}
                  </button>
                </div>
                {workflows && workflows.workflows && workflows.workflows.carz && workflows.workflows.carz.length > 0 ? (
                  <div className="space-y-3">
                    {workflows.workflows.carz.map((workflow) => (
                      <div key={workflow.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900 text-sm mb-1" dangerouslySetInnerHTML={{ __html: workflow.articleTitle }} />
                            <div className="text-xs text-slate-500">{formatTimeAgo(workflow.createdAt)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(workflow.status)}`}>
                              {formatStatus(workflow.status)}
                            </span>
                            <button
                              onClick={() => deleteWorkflow(workflow.id, 'carz')}
                              disabled={deletingWorkflow === workflow.id}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete workflow"
                            >
                              {deletingWorkflow === workflow.id ? (
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                        {(workflow.heygenVideoId || workflow.submagicVideoId || workflow.metricoolPostId) && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {workflow.heygenVideoId && (
                              <div>
                                <div className="text-slate-500 mb-1">HeyGen</div>
                                <div className="font-mono text-slate-700 truncate">{workflow.heygenVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.submagicVideoId && (
                              <div>
                                <div className="text-slate-500 mb-1">Submagic</div>
                                <div className="font-mono text-slate-700 truncate">{workflow.submagicVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.metricoolPostId && (
                              <div>
                                <div className="text-slate-500 mb-1">Metricool</div>
                                <div className="font-mono text-slate-700 truncate">{workflow.metricoolPostId}</div>
                              </div>
                            )}
                          </div>
                        )}
                        {workflow.error && (
                          <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                            <span className="font-semibold">Error:</span> {workflow.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-lg p-8 text-center border border-slate-200">
                    <div className="text-slate-500 text-sm font-medium">No active workflows</div>
                    <div className="text-xs text-slate-400 mt-1">Videos will appear here when being processed</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'ownerfi' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">OwnerFi Status</h3>
                <button
                  onClick={triggerCron}
                  disabled={triggeringViral}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggeringViral ? 'Generating...' : 'Generate Video Now'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Daily Limit</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.scheduler?.config?.maxVideosPerDay?.ownerfi || 5}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">videos/day</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Available Articles</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.stats?.ownerfi?.unprocessedArticles || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">ready to process</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">In Queue</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {(status?.stats?.ownerfi?.queuePending || 0) + (status?.stats?.ownerfi?.queueProcessing || 0)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {status?.stats?.ownerfi?.queueProcessing || 0} processing
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">RSS Feeds</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.feeds?.ownerfi || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">active sources</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Publishing Platforms</h4>
                <div className="flex flex-wrap gap-2">
                  {['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Threads'].map((platform) => (
                    <span key={platform} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {platform}
                    </span>
                  ))}
                </div>
              </div>

              {/* Workflow Logs */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-900">Workflows</h4>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                  >
                    {showHistory ? 'Active Only' : 'Show History'}
                  </button>
                </div>
                {workflows && workflows.workflows && workflows.workflows.ownerfi && workflows.workflows.ownerfi.length > 0 ? (
                  <div className="space-y-3">
                    {workflows.workflows.ownerfi.map((workflow) => (
                      <div key={workflow.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900 text-sm mb-1" dangerouslySetInnerHTML={{ __html: workflow.articleTitle }} />
                            <div className="text-xs text-slate-500">{formatTimeAgo(workflow.createdAt)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(workflow.status)}`}>
                              {formatStatus(workflow.status)}
                            </span>
                            <button
                              onClick={() => deleteWorkflow(workflow.id, 'ownerfi')}
                              disabled={deletingWorkflow === workflow.id}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete workflow"
                            >
                              {deletingWorkflow === workflow.id ? (
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                        {(workflow.heygenVideoId || workflow.submagicVideoId || workflow.metricoolPostId) && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {workflow.heygenVideoId && (
                              <div>
                                <div className="text-slate-500 mb-1">HeyGen</div>
                                <div className="font-mono text-slate-700 truncate">{workflow.heygenVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.submagicVideoId && (
                              <div>
                                <div className="text-slate-500 mb-1">Submagic</div>
                                <div className="font-mono text-slate-700 truncate">{workflow.submagicVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.metricoolPostId && (
                              <div>
                                <div className="text-slate-500 mb-1">Metricool</div>
                                <div className="font-mono text-slate-700 truncate">{workflow.metricoolPostId}</div>
                              </div>
                            )}
                          </div>
                        )}
                        {workflow.error && (
                          <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                            <span className="font-semibold">Error:</span> {workflow.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-lg p-8 text-center border border-slate-200">
                    <div className="text-slate-500 text-sm font-medium">No active workflows</div>
                    <div className="text-xs text-slate-400 mt-1">Videos will appear here when being processed</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'podcast' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Podcast Status</h3>
                <button
                  onClick={triggerPodcastCron}
                  disabled={triggeringPodcast}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggeringPodcast ? 'Generating...' : 'Generate Episode Now'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Schedule</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    Monday 9 AM
                  </div>
                  <div className="text-xs text-slate-500 mt-1">weekly</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Last Episode</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    #0
                  </div>
                  <div className="text-xs text-slate-500 mt-1">total episodes</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Duration</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    ~10 min
                  </div>
                  <div className="text-xs text-slate-500 mt-1">per episode</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Status</div>
                  <div className="text-lg font-bold text-green-600 mt-1">
                    Ready
                  </div>
                  <div className="text-xs text-slate-500 mt-1">operational</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Publishing Platforms</h4>
                <div className="flex flex-wrap gap-2">
                  {['YouTube', 'Facebook', 'Instagram Reels', 'TikTok', 'LinkedIn', 'Twitter', 'Threads'].map((platform) => (
                    <span key={platform} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {platform}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Episode Format</h4>
                <div className="bg-slate-50 rounded-lg p-4">
                  <ul className="text-sm text-slate-700 space-y-2">
                    <li>• Host + AI Guest (HeyGen avatars)</li>
                    <li>• 2 Q&A pairs (~1.5 minutes each)</li>
                    <li>• Hormozi 2 caption template (Submagic)</li>
                    <li>• Uploaded to R2 storage → Published to Metricool</li>
                  </ul>
                </div>
              </div>

              {/* Podcast Workflow Logs */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Active Workflows</h4>
                {podcastWorkflows && podcastWorkflows.workflows && podcastWorkflows.workflows.length > 0 ? (
                  <div className="space-y-3">
                    {podcastWorkflows.workflows.map((workflow) => (
                      <div key={workflow.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900 text-sm mb-1">
                              Episode #{workflow.episodeNumber}: {workflow.episodeTitle || 'Generating...'}
                            </div>
                            {workflow.guestName && (
                              <div className="text-xs text-slate-600 mb-1">Guest: {workflow.guestName}</div>
                            )}
                            {workflow.topic && (
                              <div className="text-xs text-slate-600 mb-1">Topic: {workflow.topic}</div>
                            )}
                            <div className="text-xs text-slate-500">{formatTimeAgo(workflow.createdAt)}</div>
                          </div>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getPodcastStatusColor(workflow.status)}`}>
                            {formatStatus(workflow.status)}
                          </span>
                        </div>
                        {(workflow.heygenVideoId || workflow.submagicProjectId || workflow.metricoolPostId) && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {workflow.heygenVideoId && (
                              <div>
                                <div className="text-slate-500 mb-1">HeyGen</div>
                                <div className="font-mono text-slate-700 truncate">{workflow.heygenVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.submagicProjectId && (
                              <div>
                                <div className="text-slate-500 mb-1">Submagic</div>
                                <div className="font-mono text-slate-700 truncate">{workflow.submagicProjectId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.metricoolPostId && (
                              <div>
                                <div className="text-slate-500 mb-1">Metricool</div>
                                <div className="font-mono text-slate-700 truncate">{workflow.metricoolPostId}</div>
                              </div>
                            )}
                          </div>
                        )}
                        {workflow.error && (
                          <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                            <span className="font-semibold">Error:</span> {workflow.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-lg p-8 text-center border border-slate-200">
                    <div className="text-slate-500 text-sm font-medium">No active workflows</div>
                    <div className="text-xs text-slate-400 mt-1">Episodes will appear here when being generated</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* System Information */}
        <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">System Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-600">Cron Schedule</div>
              <div className="font-medium text-slate-900 mt-1">Every 2 hours</div>
            </div>
            <div>
              <div className="text-slate-600">Video Generation</div>
              <div className="font-medium text-slate-900 mt-1">HeyGen + Submagic</div>
            </div>
            <div>
              <div className="text-slate-600">Storage</div>
              <div className="font-medium text-slate-900 mt-1">Cloudflare R2</div>
            </div>
            <div>
              <div className="text-slate-600">Publishing</div>
              <div className="font-medium text-slate-900 mt-1">Metricool API</div>
            </div>
            <div>
              <div className="text-slate-600">Last Updated</div>
              <div className="font-medium text-slate-900 mt-1">
                {status?.timestamp ? new Date(status.timestamp).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-slate-600">Cost per Video</div>
              <div className="font-medium text-slate-900 mt-1">~$1.05</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
