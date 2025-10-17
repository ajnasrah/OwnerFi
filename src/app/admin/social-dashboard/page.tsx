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
  latePostId?: string; // Changed from metricoolPostId
  metricoolPostId?: string; // Keep for backwards compatibility with old workflows
  captionTemplate?: string; // For A/B testing tracking
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
  latePostId?: string; // Changed from metricoolPostId
  metricoolPostId?: string; // Keep for backwards compatibility with old workflows
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface PodcastWorkflowLogs {
  success: boolean;
  workflows: PodcastWorkflowLog[];
  timestamp: string;
}

interface GuestProfile {
  id: string;
  name: string;
  title: string;
  expertise: string;
  avatar_id: string;
  voice_id: string;
  enabled: boolean;
}

interface Recommendation {
  id: string;
  type: 'success' | 'warning' | 'info' | 'critical';
  category: 'performance' | 'content' | 'scheduling' | 'technical';
  title: string;
  description: string;
  action: string;
  impact: 'high' | 'medium' | 'low';
  copyPasteText: string;
}

interface AnalyticsData {
  timestamp: string;
  brands: {
    carz: BrandAnalytics;
    ownerfi: BrandAnalytics;
  };
  recommendations: Recommendation[];
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
  keyMetrics: {
    totalVideosGenerated: number;
    successRate: number;
    averageProcessingTime: string;
    contentQuality: string;
  };
}

interface BrandAnalytics {
  totalFeeds: number;
  activeFeeds: number;
  totalArticles: number;
  unprocessedArticles: number;
  videosGenerated: number;
  queueStats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  successRate: number;
  health: 'excellent' | 'good' | 'fair' | 'poor';
}

export default function SocialMediaDashboard() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [activeSubTab, setActiveSubTab] = useState<'carz' | 'ownerfi' | 'podcast' | 'analytics'>('carz');
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowLogs | null>(null);
  const [podcastWorkflows, setPodcastWorkflows] = useState<PodcastWorkflowLogs | null>(null);
  const [guestProfiles, setGuestProfiles] = useState<GuestProfile[]>([]);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringViral, setTriggeringViral] = useState(false);
  const [triggeringPodcast, setTriggeringPodcast] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [deletingWorkflow, setDeletingWorkflow] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [copiedRecId, setCopiedRecId] = useState<string | null>(null);

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
      loadGuestProfiles();
      loadAnalytics();
      const statusInterval = setInterval(loadStatus, 30000); // Refresh every 30 seconds
      const workflowInterval = setInterval(loadWorkflows, 5000); // Refresh every 5 seconds for real-time updates
      const podcastWorkflowInterval = setInterval(loadPodcastWorkflows, 5000); // Refresh every 5 seconds for real-time updates
      const analyticsInterval = setInterval(loadAnalytics, 60000); // Refresh every 60 seconds
      return () => {
        clearInterval(statusInterval);
        clearInterval(workflowInterval);
        clearInterval(podcastWorkflowInterval);
        clearInterval(analyticsInterval);
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
      const url = showHistory ? '/api/podcast/workflow/logs?history=true' : '/api/podcast/workflow/logs';
      const response = await fetch(url);
      const data = await response.json();
      setPodcastWorkflows(data);
    } catch (error) {
      console.error('Failed to load podcast workflows:', error);
    }
  };

  const loadGuestProfiles = async () => {
    try {
      const response = await fetch('/api/podcast/profiles');
      const data = await response.json();
      if (data.success && data.profiles) {
        const profileArray = Object.values(data.profiles) as GuestProfile[];
        const enabled = profileArray.filter(p => p.enabled);
        setGuestProfiles(enabled);
      }
    } catch (error) {
      console.error('Failed to load guest profiles:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics/recommendations');
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const copyToClipboard = async (text: string, recId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRecId(recId);
      setTimeout(() => setCopiedRecId(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const updateGuestProfile = async (profileId: string, updates: Partial<GuestProfile>) => {
    try {
      const response = await fetch(`/api/podcast/profiles/${profileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      if (data.success) {
        await loadGuestProfiles();
        setEditingProfile(null);
      }
    } catch (error) {
      console.error('Failed to update guest profile:', error);
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
      // Determine which brand based on active tab
      const brand = activeSubTab === 'carz' ? 'carz' : 'ownerfi';

      const response = await fetch('/api/workflow/complete-viral', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brand: brand,
          platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
          schedule: 'immediate'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Workflow trigger failed:', response.status, errorText);
        alert(`Failed to start workflow (${response.status}): ${errorText}`);
        return;
      }

      const data = await response.json();

      if (data.success) {
        alert(`Video workflow started!\n\nArticle: ${data.article?.title || 'N/A'}\nWorkflow ID: ${data.workflow_id || 'N/A'}`);
        loadStatus();
        loadWorkflows();
      } else {
        alert(`Error: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Workflow trigger error:', error);
      alert(`Failed to start workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const deleteWorkflow = async (workflowId: string, brand: 'carz' | 'ownerfi' | 'podcast') => {
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
        if (brand === 'podcast') {
          await loadPodcastWorkflows();
        } else {
          await loadWorkflows();
        }
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Social Media Automation</h1>
            <p className="text-slate-600 mt-1">Monitor and control viral video generation</p>
          </div>
          <a
            href="/admin/ab-tests"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
          >
            <span className="text-xl">🧪</span>
            <span>A/B Testing</span>
          </a>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex space-x-2 mb-6">
          {[
            { key: 'carz', label: 'Carz Inc', icon: '🚗' },
            { key: 'ownerfi', label: 'OwnerFi', icon: '🏠' },
            { key: 'podcast', label: 'Podcast', icon: '🎙️' },
            { key: 'analytics', label: 'Analytics', icon: '📊' }
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
                <div className="text-xs text-slate-500 mt-1">5x daily (9AM-9PM CDT)</div>
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
                            <div className="flex items-center gap-2 mt-1">
                              <div className="text-xs text-slate-500">{formatTimeAgo(workflow.createdAt)}</div>
                              {workflow.captionTemplate && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700" title="A/B Test Caption Template">
                                  🧪 {workflow.captionTemplate.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
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
                        {(workflow.heygenVideoId || workflow.submagicVideoId || workflow.latePostId || workflow.metricoolPostId) && (
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
                            {(workflow.latePostId || workflow.metricoolPostId) && (
                              <div>
                                <div className="text-slate-500 mb-1">GetLate</div>
                                <div className="font-mono text-slate-700 truncate">{(workflow.latePostId || workflow.metricoolPostId)?.substring(0, 12)}...</div>
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
                            <div className="flex items-center gap-2 mt-1">
                              <div className="text-xs text-slate-500">{formatTimeAgo(workflow.createdAt)}</div>
                              {workflow.captionTemplate && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700" title="A/B Test Caption Template">
                                  🧪 {workflow.captionTemplate.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
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
                        {(workflow.heygenVideoId || workflow.submagicVideoId || workflow.latePostId || workflow.metricoolPostId) && (
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
                            {(workflow.latePostId || workflow.metricoolPostId) && (
                              <div>
                                <div className="text-slate-500 mb-1">GetLate</div>
                                <div className="font-mono text-slate-700 truncate">{(workflow.latePostId || workflow.metricoolPostId)?.substring(0, 12)}...</div>
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
                  <div className="text-sm text-slate-600">Post Schedule</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    Smart Slots
                  </div>
                  <div className="text-xs text-slate-500 mt-1">9AM, 12PM, 3PM, 6PM, 9PM CDT</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Daily Limit</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    3 episodes
                  </div>
                  <div className="text-xs text-slate-500 mt-1">per day</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Duration</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    ~3-4 min
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
                    <li>• <strong>3 episodes daily</strong> - Posted at optimal engagement times</li>
                    <li>• Host + AI Guest (HeyGen avatars)</li>
                    <li>• 2 Q&A pairs (~1.5 minutes each)</li>
                    <li>• Hormozi 2 caption template (Submagic)</li>
                    <li>• Smart scheduling: 9 AM, 12 PM, 3 PM, 6 PM, or 9 PM CDT</li>
                  </ul>
                </div>
              </div>

              {/* Guest Profiles */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Active Guest Profiles ({guestProfiles.length})</h4>
                <div className="space-y-3">
                  {guestProfiles.map((profile) => (
                    <div key={profile.id} className="bg-white border border-slate-200 rounded-lg p-4">
                      {editingProfile === profile.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-slate-600 font-medium">Name</label>
                              <input
                                type="text"
                                defaultValue={profile.name}
                                onBlur={(e) => {
                                  if (e.target.value !== profile.name) {
                                    updateGuestProfile(profile.id, { name: e.target.value });
                                  }
                                }}
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-600 font-medium">Title</label>
                              <input
                                type="text"
                                defaultValue={profile.title}
                                onBlur={(e) => {
                                  if (e.target.value !== profile.title) {
                                    updateGuestProfile(profile.id, { title: e.target.value });
                                  }
                                }}
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded mt-1"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-slate-600 font-medium">Avatar ID</label>
                              <input
                                type="text"
                                defaultValue={profile.avatar_id}
                                onBlur={(e) => {
                                  if (e.target.value !== profile.avatar_id) {
                                    updateGuestProfile(profile.id, { avatar_id: e.target.value });
                                  }
                                }}
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded font-mono mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-600 font-medium">Voice ID</label>
                              <input
                                type="text"
                                defaultValue={profile.voice_id}
                                onBlur={(e) => {
                                  if (e.target.value !== profile.voice_id) {
                                    updateGuestProfile(profile.id, { voice_id: e.target.value });
                                  }
                                }}
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded font-mono mt-1"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => setEditingProfile(null)}
                            className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900 text-sm">{profile.name}</div>
                            <div className="text-xs text-slate-600 mt-1">{profile.title}</div>
                            <div className="flex gap-4 mt-2 text-xs text-slate-500">
                              <div>
                                <span className="font-medium">Avatar:</span> <span className="font-mono">{profile.avatar_id.substring(0, 20)}...</span>
                              </div>
                              <div>
                                <span className="font-medium">Voice:</span> <span className="font-mono">{profile.voice_id.substring(0, 12)}...</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setEditingProfile(profile.id)}
                            className="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {guestProfiles.length === 0 && (
                    <div className="bg-slate-50 rounded-lg p-8 text-center border border-slate-200">
                      <div className="text-slate-500 text-sm font-medium">No guest profiles loaded</div>
                      <div className="text-xs text-slate-400 mt-1">Check Firestore configuration</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Podcast Workflow Logs */}
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
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getPodcastStatusColor(workflow.status)}`}>
                              {formatStatus(workflow.status)}
                            </span>
                            <button
                              onClick={() => deleteWorkflow(workflow.id, 'podcast')}
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
                        {(workflow.heygenVideoId || workflow.submagicProjectId || workflow.latePostId || workflow.metricoolPostId) && (
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
                            {(workflow.latePostId || workflow.metricoolPostId) && (
                              <div>
                                <div className="text-slate-500 mb-1">GetLate</div>
                                <div className="font-mono text-slate-700 truncate">{(workflow.latePostId || workflow.metricoolPostId)?.substring(0, 12)}...</div>
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

        {activeSubTab === 'analytics' && (
          <div className="space-y-6">
            {/* Overall Health */}
            {analytics && (
              <>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">System Health & Performance</h3>

                  {/* Health Badge */}
                  <div className="mb-6">
                    <div className={`inline-flex items-center px-6 py-3 rounded-full text-lg font-bold ${
                      analytics.overallHealth === 'excellent' ? 'bg-green-100 text-green-800' :
                      analytics.overallHealth === 'good' ? 'bg-blue-100 text-blue-800' :
                      analytics.overallHealth === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {analytics.overallHealth === 'excellent' ? '✅ Excellent' :
                       analytics.overallHealth === 'good' ? '👍 Good' :
                       analytics.overallHealth === 'fair' ? '⚠️ Fair' :
                       '🚨 Needs Attention'}
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-600">Total Videos</div>
                      <div className="text-2xl font-bold text-slate-900 mt-1">
                        {analytics.keyMetrics.totalVideosGenerated}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">all time</div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-600">Success Rate</div>
                      <div className={`text-2xl font-bold mt-1 ${
                        analytics.keyMetrics.successRate >= 90 ? 'text-green-600' :
                        analytics.keyMetrics.successRate >= 75 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {analytics.keyMetrics.successRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-slate-500 mt-1">completion rate</div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-600">Processing Time</div>
                      <div className="text-lg font-bold text-slate-900 mt-1">
                        {analytics.keyMetrics.averageProcessingTime}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">per video</div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-600">Content Quality</div>
                      <div className="text-sm font-bold text-slate-900 mt-1">
                        {analytics.keyMetrics.contentQuality}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">AI filtering</div>
                    </div>
                  </div>
                </div>

                {/* Brand Comparison */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Brand Performance Comparison</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Carz Analytics */}
                    <div className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">🚗</span>
                          <h4 className="font-semibold text-slate-900">Carz Inc</h4>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                          analytics.brands.carz.health === 'excellent' ? 'bg-green-100 text-green-700' :
                          analytics.brands.carz.health === 'good' ? 'bg-blue-100 text-blue-700' :
                          analytics.brands.carz.health === 'fair' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {analytics.brands.carz.health.toUpperCase()}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Success Rate:</span>
                          <span className="font-medium">{analytics.brands.carz.successRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Articles Ready:</span>
                          <span className="font-medium">{analytics.brands.carz.unprocessedArticles}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Videos Generated:</span>
                          <span className="font-medium">{analytics.brands.carz.videosGenerated}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Failed Workflows:</span>
                          <span className="font-medium text-red-600">{analytics.brands.carz.queueStats.failed}</span>
                        </div>
                      </div>
                    </div>

                    {/* OwnerFi Analytics */}
                    <div className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">🏠</span>
                          <h4 className="font-semibold text-slate-900">OwnerFi</h4>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                          analytics.brands.ownerfi.health === 'excellent' ? 'bg-green-100 text-green-700' :
                          analytics.brands.ownerfi.health === 'good' ? 'bg-blue-100 text-blue-700' :
                          analytics.brands.ownerfi.health === 'fair' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {analytics.brands.ownerfi.health.toUpperCase()}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Success Rate:</span>
                          <span className="font-medium">{analytics.brands.ownerfi.successRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Articles Ready:</span>
                          <span className="font-medium">{analytics.brands.ownerfi.unprocessedArticles}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Videos Generated:</span>
                          <span className="font-medium">{analytics.brands.ownerfi.videosGenerated}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Failed Workflows:</span>
                          <span className="font-medium text-red-600">{analytics.brands.ownerfi.queueStats.failed}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">AI Recommendations</h3>
                    <div className="text-sm text-slate-600">
                      {analytics.recommendations.length} insights
                    </div>
                  </div>

                  {analytics.recommendations.length === 0 ? (
                    <div className="bg-slate-50 rounded-lg p-8 text-center border border-slate-200">
                      <div className="text-slate-500 text-sm font-medium">No recommendations at this time</div>
                      <div className="text-xs text-slate-400 mt-1">Your system is running optimally!</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {analytics.recommendations.map((rec) => (
                        <div
                          key={rec.id}
                          className={`border-2 rounded-lg p-4 ${
                            rec.type === 'critical' ? 'border-red-300 bg-red-50' :
                            rec.type === 'warning' ? 'border-yellow-300 bg-yellow-50' :
                            rec.type === 'success' ? 'border-green-300 bg-green-50' :
                            'border-blue-300 bg-blue-50'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-2xl ${
                                  rec.type === 'critical' ? '🚨' :
                                  rec.type === 'warning' ? '⚠️' :
                                  rec.type === 'success' ? '✅' :
                                  '💡'
                                }`}></span>
                                <h4 className="font-semibold text-slate-900">{rec.title}</h4>
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  rec.impact === 'high' ? 'bg-red-200 text-red-800' :
                                  rec.impact === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                                  'bg-gray-200 text-gray-800'
                                }`}>
                                  {rec.impact.toUpperCase()} IMPACT
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 mb-2">{rec.description}</p>
                              <div className="text-xs text-slate-600 mb-3">
                                <span className="font-medium">Action:</span> {rec.action}
                              </div>

                              {/* Copy-Paste Section */}
                              <div className="bg-white border border-slate-300 rounded-lg p-3 mt-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-slate-700">Copy for Claude:</span>
                                  <button
                                    onClick={() => copyToClipboard(rec.copyPasteText, rec.id)}
                                    className={`text-xs px-3 py-1 rounded-lg font-medium transition-all ${
                                      copiedRecId === rec.id
                                        ? 'bg-green-600 text-white'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    }`}
                                  >
                                    {copiedRecId === rec.id ? '✓ Copied!' : '📋 Copy'}
                                  </button>
                                </div>
                                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 p-2 rounded border border-slate-200">
                                  {rec.copyPasteText}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Future Analytics Placeholder */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl shadow-sm p-6 border-2 border-dashed border-purple-300">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">🚀</span>
                    <h3 className="text-lg font-semibold text-slate-900">Coming Soon: Late.so Analytics Integration</h3>
                  </div>
                  <p className="text-sm text-slate-700 mb-4">
                    Once Late.so releases their analytics API, we'll automatically track:
                  </p>
                  <ul className="text-sm text-slate-700 space-y-2">
                    <li>• Real-time engagement metrics (views, likes, comments, shares)</li>
                    <li>• Platform-specific performance comparison</li>
                    <li>• Optimal posting time analysis</li>
                    <li>• Content type performance (trending vs evergreen)</li>
                    <li>• Audience retention heatmaps</li>
                    <li>• A/B testing results for captions and thumbnails</li>
                  </ul>
                  <div className="mt-4 text-xs text-slate-600">
                    For now, manually track engagement in your platform dashboards and use the recommendations above to optimize performance.
                  </div>
                </div>
              </>
            )}

            {!analytics && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="w-12 h-12 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <div className="text-lg font-medium text-gray-900">Loading analytics...</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* System Information */}
        <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">System Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-600">Cron Schedule</div>
              <div className="font-medium text-slate-900 mt-1">5x daily (9AM-9PM CDT)</div>
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
              <div className="font-medium text-slate-900 mt-1">GetLate API</div>
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
