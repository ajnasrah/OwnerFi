'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import WorkflowRecoveryButtons from '@/components/WorkflowRecoveryButtons';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import YouTubeAnalyticsDashboard from '@/components/YouTubeAnalyticsDashboard';

interface SchedulerStatus {
  timestamp: string;
  scheduler: {
    running: boolean;
    config: {
      maxVideosPerDay: {
        carz: number;
        ownerfi: number;
        vassdistro?: number;
      };
    };
  };
  feeds: {
    total: number;
    carz: number;
    ownerfi: number;
    vassdistro?: number;
  };
  articles?: {
    carz: number;
    ownerfi: number;
    vassdistro?: number;
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
    vassdistro?: {
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
    vassdistro?: {
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
  brand: 'carz' | 'ownerfi' | 'vassdistro' | 'abdullah';
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
    vassdistro?: WorkflowLog[];
    abdullah?: WorkflowLog[];
  };
  timestamp: string;
}

interface PodcastWorkflowLog {
  id: string;
  episodeNumber: number;
  episodeTitle: string;
  guestName: string;
  topic: string;
  status: 'script_generation' | 'heygen_processing' | 'submagic_processing' | 'posting' | 'publishing' | 'completed' | 'failed'; // Support both 'posting' and 'publishing' for backwards compatibility
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

interface BenefitWorkflowLog {
  id: string;
  benefitId: string;
  audience: 'seller' | 'buyer';
  benefitTitle: string;
  status: 'heygen_processing' | 'submagic_processing' | 'video_processing' | 'posting' | 'completed' | 'failed';
  heygenVideoId?: string;
  submagicProjectId?: string;
  finalVideoUrl?: string;
  latePostId?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface BenefitWorkflowLogs {
  success: boolean;
  workflows: BenefitWorkflowLog[];
  timestamp: string;
}

interface PropertyWorkflowLog {
  id: string;
  propertyId: string;
  variant: '15sec' | '30sec';
  address: string;
  city: string;
  state: string;
  downPayment: number;
  monthlyPayment: number;
  status: 'queued' | 'heygen_processing' | 'submagic_processing' | 'posting' | 'completed' | 'failed';
  heygenVideoId?: string;
  submagicProjectId?: string;
  latePostId?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface PropertyWorkflowLogs {
  success: boolean;
  workflows: PropertyWorkflowLog[];
  timestamp: string;
}

interface PropertyQueueStats {
  total: number;
  queued: number;
  processing: number;
  nextProperty?: {
    address: string;
    city: string;
    state: string;
    videoCount: number;
  };
  rotationDays: number;
  videosToday: number;
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
    vassdistro?: BrandAnalytics;
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
  const [activeSubTab, setActiveSubTab] = useState<'carz' | 'ownerfi' | 'vassdistro' | 'ownerfi-benefits' | 'ownerfi-properties' | 'ownerfi-properties-spanish' | 'abdullah' | 'abdullah-podcast' | 'analytics' | 'youtube-analytics'>('carz');
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowLogs | null>(null);
  const [podcastWorkflows, setPodcastWorkflows] = useState<PodcastWorkflowLogs | null>(null);
  const [benefitWorkflows, setBenefitWorkflows] = useState<BenefitWorkflowLogs | null>(null);
  const [propertyWorkflows, setPropertyWorkflows] = useState<PropertyWorkflowLogs | null>(null);
  const [propertyStats, setPropertyStats] = useState<PropertyQueueStats | null>(null);
  const [spanishPropertyWorkflows, setSpanishPropertyWorkflows] = useState<PropertyWorkflowLogs | null>(null);
  const [spanishPropertyStats, setSpanishPropertyStats] = useState<PropertyQueueStats | null>(null);
  const [guestProfiles, setGuestProfiles] = useState<GuestProfile[]>([]);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringViral, setTriggeringViral] = useState(false);
  const [triggeringPodcast, setTriggeringPodcast] = useState(false);
  const [triggeringBenefit, setTriggeringBenefit] = useState(false);
  const [triggeringProperty, setTriggeringProperty] = useState(false);
  const [triggeringSpanishProperty, setTriggeringSpanishProperty] = useState(false);
  const [triggeringAbdullah, setTriggeringAbdullah] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [deletingWorkflow, setDeletingWorkflow] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [copiedRecId, setCopiedRecId] = useState<string | null>(null);
  const [refreshingAnalytics, setRefreshingAnalytics] = useState(false);
  const [abdullahQueueStats, setAbdullahQueueStats] = useState<any>(null);
  const [recentScripts, setRecentScripts] = useState<Array<{
    id: string;
    title: string;
    script: string;
    caption: string;
    theme: string;
    hook: string;
    status: string;
    createdAt: number;
    finalVideoUrl?: string;
  }>>([]);
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth');
    }

    if (authStatus === 'authenticated') {
      const userRole = (session?.user as { role?: string })?.role;
      if (userRole !== 'admin') {
        if (userRole === 'buyer') {
          router.push('/dashboard');
        } else if (userRole === 'realtor') {
          router.push('/realtor/dashboard');
        } else {
          router.push('/auth');
        }
      }
    }
  }, [authStatus, session, router]);

  useEffect(() => {
    if (authStatus === 'authenticated' && (session?.user as { role?: string })?.role === 'admin') {
      // PERFORMANCE FIX: Replace 7 concurrent intervals with single coordinated polling
      // OLD: 7 intervals = 14,000 API calls/day = $100/month + browser memory leaks
      // NEW: 1 interval with coordinated polling = 2,880 API calls/day = $20/month

      // Initial load
      loadStatus();
      loadWorkflows();
      loadPodcastWorkflows();
      loadBenefitWorkflows();
      loadPropertyWorkflows();
      loadPropertyStats();
      loadSpanishPropertyWorkflows();
      loadSpanishPropertyStats();
      loadGuestProfiles();
      loadAnalytics();
      loadAbdullahQueueStats();
      loadRecentScripts();

      let tickCount = 0;

      // Single coordinated interval (every 30 seconds)
      const coordinatedInterval = setInterval(() => {
        tickCount++;

        // Workflows: every 30s (tick 1, 2, 3, ...)
        loadWorkflows();
        loadPodcastWorkflows();
        loadBenefitWorkflows();
        loadPropertyWorkflows();
        loadSpanishPropertyWorkflows();
        loadAbdullahQueueStats();

        // Status & Stats: every 60s (tick 2, 4, 6, ...)
        if (tickCount % 2 === 0) {
          loadStatus();
          loadPropertyStats();
          loadSpanishPropertyStats();
          loadRecentScripts();
        }

        // Analytics: every 24 hours (tick 2880)
        if (tickCount % 2880 === 0) {
          loadAnalytics();
        }

        // Guest profiles: once at start, then only on manual refresh
        // (already loaded at initial mount)
      }, 30000); // 30 seconds

      return () => {
        clearInterval(coordinatedInterval);
      };
    }
    return undefined;
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

  const loadBenefitWorkflows = async () => {
    try {
      const url = showHistory ? '/api/benefit/workflow/logs?history=true' : '/api/benefit/workflow/logs';
      const response = await fetch(url);
      const data = await response.json();
      setBenefitWorkflows(data);
    } catch (error) {
      console.error('Failed to load benefit workflows:', error);
    }
  };

  const loadPropertyWorkflows = async () => {
    try {
      const url = showHistory ? '/api/property/workflows/logs?history=true' : '/api/property/workflows/logs';
      const response = await fetch(url);
      const data = await response.json();

      // Only set workflows if the response was successful and has workflows array
      if (data.success && Array.isArray(data.workflows)) {
        setPropertyWorkflows(data);
      } else {
        console.error('Property workflows API error:', data.error || 'Unknown error');
        setPropertyWorkflows({ success: false, workflows: [], timestamp: new Date().toISOString() });
      }
    } catch (error) {
      console.error('Failed to load property workflows:', error);
      setPropertyWorkflows({ success: false, workflows: [], timestamp: new Date().toISOString() });
    }
  };

  const loadPropertyStats = async () => {
    try {
      const response = await fetch('/api/property/populate-queue');
      const data = await response.json();
      if (data.success && data.stats) {
        setPropertyStats({
          total: data.stats.total || 0,
          queued: data.stats.queued || 0,
          processing: data.stats.processing || 0,
          nextProperty: data.stats.nextProperty,
          rotationDays: data.rotationDays || 0,
          videosToday: 0 // This will be calculated from workflows
        });
      }
    } catch (error) {
      console.error('Failed to load property stats:', error);
    }
  };

  const loadSpanishPropertyWorkflows = async () => {
    try {
      const url = showHistory ? '/api/property/workflows/logs-spanish?history=true' : '/api/property/workflows/logs-spanish';
      const response = await fetch(url);
      const data = await response.json();

      // Only set workflows if the response was successful and has workflows array
      if (data.success && Array.isArray(data.workflows)) {
        setSpanishPropertyWorkflows(data);
      } else {
        console.error('Spanish property workflows API error:', data.error || 'Unknown error');
        setSpanishPropertyWorkflows({ success: false, workflows: [], timestamp: new Date().toISOString() });
      }
    } catch (error) {
      console.error('Failed to load Spanish property workflows:', error);
      setSpanishPropertyWorkflows({ success: false, workflows: [], timestamp: new Date().toISOString() });
    }
  };

  const loadSpanishPropertyStats = async () => {
    try {
      const response = await fetch('/api/property/populate-queue-spanish');
      const data = await response.json();
      if (data.success && data.stats) {
        setSpanishPropertyStats({
          total: data.stats.total || 0,
          queued: data.stats.queued || 0,
          processing: data.stats.processing || 0,
          nextProperty: data.stats.nextProperty,
          rotationDays: data.rotationDays || 0,
          videosToday: 0 // This will be calculated from workflows
        });
      }
    } catch (error) {
      console.error('Failed to load Spanish property stats:', error);
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

  const loadAnalytics = async (manual = false) => {
    if (manual) setRefreshingAnalytics(true);
    try {
      // Add cache-busting timestamp to ensure fresh data
      const cacheBuster = `?_=${Date.now()}`;
      const response = await fetch(`/api/analytics/recommendations${cacheBuster}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      if (manual) setRefreshingAnalytics(false);
    }
  };

  const loadAbdullahQueueStats = async () => {
    try {
      const response = await fetch('/api/admin/abdullah-queue-stats');
      const data = await response.json();
      if (data.success) {
        setAbdullahQueueStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load Abdullah queue stats:', error);
    }
  };

  const loadRecentScripts = async () => {
    try {
      const response = await fetch('/api/admin/recent-scripts?limit=10');
      const data = await response.json();
      if (data.success) {
        setRecentScripts(data.scripts);
      }
    } catch (error) {
      console.error('Failed to load recent scripts:', error);
    }
  };

  const copyScriptToClipboard = async (script: typeof recentScripts[0]) => {
    const text = `TITLE: ${script.title}
THEME: ${script.theme}
HOOK: ${script.hook}

SCRIPT:
${script.script}

CAPTION:
${script.caption}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedScriptId(script.id);
      setTimeout(() => setCopiedScriptId(null), 2000);
    } catch (error) {
      console.error('Failed to copy script:', error);
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
      const brand = activeSubTab === 'carz' ? 'carz' : activeSubTab === 'vassdistro' ? 'vassdistro' : 'ownerfi';

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

  const triggerBenefitCron = async () => {
    setTriggeringBenefit(true);
    try {
      const response = await fetch('/api/benefit/cron?force=true', { method: 'POST' });
      const data = await response.json();
      alert(data.success ? 'Benefit video cron triggered successfully!' : `Error: ${data.error}`);
      if (data.success) {
        loadBenefitWorkflows();
      }
    } catch (error) {
      alert('Failed to trigger benefit cron');
    } finally {
      setTriggeringBenefit(false);
    }
  };

  const triggerPropertyCron = async () => {
    setTriggeringProperty(true);
    try {
      const response = await fetch('/api/property/video-cron', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        const message = data.generated > 0
          ? `Property video cron triggered successfully!\n\nProperty: ${data.property?.address || 'N/A'}\nWorkflow ID: ${data.property?.workflowId || 'N/A'}`
          : `Property cron ran but no video generated.\n\n${data.message || ''}`;
        alert(message);
        loadPropertyWorkflows();
        loadPropertyStats();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to trigger property cron');
    } finally {
      setTriggeringProperty(false);
    }
  };

  const triggerSpanishPropertyCron = async () => {
    setTriggeringSpanishProperty(true);
    try {
      const response = await fetch('/api/property/video-cron-spanish', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        const message = data.generated > 0
          ? `Spanish property video cron triggered successfully!\n\nProperty: ${data.property?.address || 'N/A'}\nWorkflow ID: ${data.property?.workflowId || 'N/A'}`
          : `Spanish property cron ran but no video generated.\n\n${data.message || ''}`;
        alert(message);
        loadSpanishPropertyWorkflows();
        loadSpanishPropertyStats();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to trigger Spanish property cron');
    } finally {
      setTriggeringSpanishProperty(false);
    }
  };

  const triggerAbdullahWorkflow = async () => {
    setTriggeringAbdullah(true);
    try {
      const response = await fetch('/api/workflow/complete-abdullah', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'],
          schedule: 'staggered' // Posts throughout the day
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Abdullah workflow failed:', response.status, errorText);
        alert(`Failed to start Abdullah workflow (${response.status}): ${errorText}`);
        return;
      }

      const data = await response.json();

      if (data.success) {
        const videosGenerated = data.videos?.length || 0;
        alert(`Abdullah workflow started!\n\n${videosGenerated} videos generating...\n\nThemes: Mindset, Business, Money, Freedom, Story/Lesson`);
        loadWorkflows();
      } else {
        alert(`Error: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Abdullah workflow error:', error);
      alert(`Failed to start Abdullah workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTriggeringAbdullah(false);
    }
  };

  const deleteWorkflow = async (workflowId: string, brand: 'carz' | 'ownerfi' | 'vassdistro' | 'podcast' | 'benefit' | 'property' | 'property-spanish' | 'abdullah') => {
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
        } else if (brand === 'benefit') {
          await loadBenefitWorkflows();
        } else if (brand === 'property') {
          await loadPropertyWorkflows();
        } else if (brand === 'property-spanish') {
          await loadSpanishPropertyWorkflows();
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

  const getBenefitStatusColor = (status: BenefitWorkflowLog['status']) => {
    switch (status) {
      case 'heygen_processing': return 'bg-blue-100 text-blue-700';
      case 'submagic_processing': return 'bg-purple-100 text-purple-700';
      case 'video_processing': return 'bg-indigo-100 text-indigo-700';
      case 'posting': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPropertyStatusColor = (status: PropertyWorkflowLog['status']) => {
    switch (status) {
      case 'heygen_processing': return 'bg-blue-100 text-blue-700';
      case 'submagic_processing': return 'bg-purple-100 text-purple-700';
      case 'queued': return 'bg-gray-100 text-gray-700';
      case 'posting': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatStatus = (status: WorkflowLog['status'] | PodcastWorkflowLog['status'] | BenefitWorkflowLog['status'] | PropertyWorkflowLog['status']) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatTimeAgo = (timestamp: number) => {
    // Validate timestamp
    if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
      return 'Just now';
    }

    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    // Handle invalid calculations
    if (isNaN(seconds) || seconds < 0) {
      return 'Just now';
    }

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
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
    <div className="h-screen overflow-hidden bg-slate-900 flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
        {/* Back to Hub */}
        <a href="/admin" className="text-emerald-400 hover:text-emerald-300 mb-4 inline-flex items-center gap-1">
          ← Back to Admin Hub
        </a>

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Social Media Automation</h1>
            <p className="text-slate-400 mt-1">Monitor and control viral video generation</p>
          </div>
          <a
            href="/admin/ab-tests"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
          >
            <span className="text-xl">🧪</span>
            <span>A/B Testing</span>
          </a>
        </div>

        {/* Sub-navigation Tabs - Scrollable on mobile */}
        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { key: 'carz', label: 'Carz Inc', icon: '🚗' },
            { key: 'ownerfi', label: 'OwnerFi', icon: '🏠', hasSubtabs: true },
            { key: 'vassdistro', label: 'Vass Distro', icon: '💨' },
            { key: 'abdullah', label: 'Abdullah', icon: '👤', hasSubtabs: true },
            { key: 'analytics', label: 'Analytics', icon: '📊' },
            { key: 'youtube-analytics', label: 'YouTube', icon: '📺' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                // Set default subtab when clicking main tab
                if (tab.key === 'ownerfi') {
                  setActiveSubTab('ownerfi' as any);
                } else if (tab.key === 'abdullah') {
                  setActiveSubTab('abdullah' as any);
                } else {
                  setActiveSubTab(tab.key as any);
                }
              }}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                (activeSubTab === tab.key ||
                 (tab.key === 'ownerfi' && activeSubTab.startsWith('ownerfi')) ||
                 (tab.key === 'abdullah' && (activeSubTab === 'abdullah' || activeSubTab === 'abdullah-podcast')))
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Sub-tabs for OwnerFi */}
        {(activeSubTab.startsWith('ownerfi')) && (
          <div className="flex space-x-2 mb-6 ml-0 md:ml-4 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveSubTab('ownerfi')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                activeSubTab === 'ownerfi'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Viral Videos
            </button>
            <button
              onClick={() => setActiveSubTab('ownerfi-benefits')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                activeSubTab === 'ownerfi-benefits'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              💎 Benefits
            </button>
            <button
              onClick={() => setActiveSubTab('ownerfi-properties')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                activeSubTab === 'ownerfi-properties'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              🏡 Properties
            </button>
            <button
              onClick={() => setActiveSubTab('ownerfi-properties-spanish')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                activeSubTab === 'ownerfi-properties-spanish'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              🏡 Spanish
            </button>
          </div>
        )}

        {/* Sub-tabs for Abdullah */}
        {(activeSubTab === 'abdullah' || activeSubTab === 'abdullah-podcast') && (
          <div className="flex space-x-2 mb-6 ml-0 md:ml-4 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveSubTab('abdullah')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                activeSubTab === 'abdullah'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Daily Content
            </button>
            <button
              onClick={() => setActiveSubTab('abdullah-podcast')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                activeSubTab === 'abdullah-podcast'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              🎙️ Podcast
            </button>
          </div>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-400">System Mode</div>
                <div className="text-lg font-bold text-white mt-1">
                  Serverless Cron
                </div>
                <div className="text-xs text-slate-500 mt-1">5x daily (9AM-9PM CDT)</div>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-900/30">
                <div className="w-6 h-6 rounded-full bg-blue-500"></div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-400">RSS Feeds</div>
                <div className="text-2xl font-bold text-white mt-1">
                  {status?.feeds?.total || 0}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {status?.feeds?.carz || 0} Carz • {status?.feeds?.ownerfi || 0} OwnerFi • {status?.feeds?.vassdistro || 0} Vass
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-900/30 rounded-full flex items-center justify-center">
                <span className="text-2xl">📰</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-400">Articles in Queue</div>
                <div className="text-2xl font-bold text-white mt-1">
                  {(status?.stats?.carz?.unprocessedArticles || 0) + (status?.stats?.ownerfi?.unprocessedArticles || 0)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {status?.stats?.carz?.unprocessedArticles || 0} Carz • {status?.stats?.ownerfi?.unprocessedArticles || 0} OwnerFi • {status?.stats?.vassdistro?.unprocessedArticles || 0} Vass
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-900/30 rounded-full flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
            </div>
          </div>
        </div>

        {/* Brand-Specific Content */}
        {activeSubTab === 'carz' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Carz Inc Status</h3>
                <button
                  onClick={triggerCron}
                  disabled={triggeringViral}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggeringViral ? 'Generating...' : 'Generate Video Now'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Daily Limit</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {status?.scheduler?.config?.maxVideosPerDay?.carz || 5}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">videos/day</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Available Articles</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {status?.stats?.carz?.unprocessedArticles || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">ready to process</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">In Queue</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {(status?.stats?.carz?.queuePending || 0) + (status?.stats?.carz?.queueProcessing || 0)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {status?.stats?.carz?.queueProcessing || 0} processing
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">RSS Feeds</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {status?.feeds?.carz || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">active sources</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-white mb-3">Publishing Platforms</h4>
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
                  <h4 className="text-sm font-semibold text-white">Workflows</h4>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-300 font-medium transition-colors"
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
                            <div className="font-medium text-white text-sm mb-1" dangerouslySetInnerHTML={{ __html: workflow.articleTitle }} />
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
                                <div className="font-mono text-slate-300 truncate">{workflow.heygenVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.submagicVideoId && (
                              <div>
                                <div className="text-slate-500 mb-1">Submagic</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.submagicVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {(workflow.latePostId || workflow.metricoolPostId) && (
                              <div>
                                <div className="text-slate-500 mb-1">GetLate</div>
                                <div className="font-mono text-slate-300 truncate">{(workflow.latePostId || workflow.metricoolPostId)?.substring(0, 12)}...</div>
                              </div>
                            )}
                          </div>
                        )}
                        {workflow.error && (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                              <span className="font-semibold">Error:</span> {workflow.error}
                            </div>
                            <WorkflowRecoveryButtons workflow={workflow} onSuccess={loadWorkflows} />
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
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">OwnerFi Status</h3>
                <button
                  onClick={triggerCron}
                  disabled={triggeringViral}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggeringViral ? 'Generating...' : 'Generate Video Now'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Daily Limit</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {status?.scheduler?.config?.maxVideosPerDay?.ownerfi || 5}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">videos/day</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Available Articles</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {status?.stats?.ownerfi?.unprocessedArticles || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">ready to process</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">In Queue</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {(status?.stats?.ownerfi?.queuePending || 0) + (status?.stats?.ownerfi?.queueProcessing || 0)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {status?.stats?.ownerfi?.queueProcessing || 0} processing
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">RSS Feeds</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {status?.feeds?.ownerfi || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">active sources</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-white mb-3">Publishing Platforms</h4>
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
                  <h4 className="text-sm font-semibold text-white">Workflows</h4>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-300 font-medium transition-colors"
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
                            <div className="font-medium text-white text-sm mb-1" dangerouslySetInnerHTML={{ __html: workflow.articleTitle }} />
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
                                <div className="font-mono text-slate-300 truncate">{workflow.heygenVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.submagicVideoId && (
                              <div>
                                <div className="text-slate-500 mb-1">Submagic</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.submagicVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {(workflow.latePostId || workflow.metricoolPostId) && (
                              <div>
                                <div className="text-slate-500 mb-1">GetLate</div>
                                <div className="font-mono text-slate-300 truncate">{(workflow.latePostId || workflow.metricoolPostId)?.substring(0, 12)}...</div>
                              </div>
                            )}
                          </div>
                        )}
                        {workflow.error && (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                              <span className="font-semibold">Error:</span> {workflow.error}
                            </div>
                            <WorkflowRecoveryButtons workflow={workflow} onSuccess={loadWorkflows} />
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

        {activeSubTab === 'vassdistro' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Vass Distro Status</h3>
                <button
                  onClick={triggerCron}
                  disabled={triggeringViral}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggeringViral ? 'Generating...' : 'Generate Video Now'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Daily Limit</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {status?.scheduler?.config?.maxVideosPerDay?.vassdistro || 1}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">videos/day</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Available Articles</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {status?.stats?.vassdistro?.unprocessedArticles || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">ready to process</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">In Queue</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {(status?.stats?.vassdistro?.queuePending || 0) + (status?.stats?.vassdistro?.queueProcessing || 0)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {status?.stats?.vassdistro?.queueProcessing || 0} processing
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">RSS Feeds</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {status?.feeds?.vassdistro || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">active sources</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-white mb-3">Publishing Platforms</h4>
                <div className="flex flex-wrap gap-2">
                  {['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Threads'].map((platform) => (
                    <span key={platform} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {platform}
                    </span>
                  ))}
                </div>
              </div>

              {/* Workflow Logs */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white">Workflows</h4>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-300 font-medium transition-colors"
                  >
                    {showHistory ? 'Active Only' : 'Show History'}
                  </button>
                </div>
                {workflows && workflows.workflows && workflows.workflows.vassdistro && workflows.workflows.vassdistro.length > 0 ? (
                  <div className="space-y-3">
                    {workflows.workflows.vassdistro.map((workflow) => (
                      <div key={workflow.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-medium text-white text-sm mb-1" dangerouslySetInnerHTML={{ __html: workflow.articleTitle }} />
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
                              onClick={() => deleteWorkflow(workflow.id, 'vassdistro')}
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
                                <div className="font-mono text-slate-300 truncate">{workflow.heygenVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.submagicVideoId && (
                              <div>
                                <div className="text-slate-500 mb-1">Submagic</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.submagicVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {(workflow.latePostId || workflow.metricoolPostId) && (
                              <div>
                                <div className="text-slate-500 mb-1">GetLate</div>
                                <div className="font-mono text-slate-300 truncate">{(workflow.latePostId || workflow.metricoolPostId)?.substring(0, 12)}...</div>
                              </div>
                            )}
                          </div>
                        )}
                        {workflow.error && (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                              <span className="font-semibold">Error:</span> {workflow.error}
                            </div>
                            <WorkflowRecoveryButtons workflow={workflow} onSuccess={loadWorkflows} />
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

        {activeSubTab === 'abdullah-podcast' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Podcast Status</h3>
                <button
                  onClick={triggerPodcastCron}
                  disabled={triggeringPodcast}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggeringPodcast ? 'Generating...' : 'Generate Episode Now'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Post Schedule</div>
                  <div className="text-lg font-bold text-white mt-1">
                    Smart Slots
                  </div>
                  <div className="text-xs text-slate-500 mt-1">9AM, 12PM, 3PM, 6PM, 9PM CDT</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Daily Limit</div>
                  <div className="text-lg font-bold text-white mt-1">
                    3 episodes
                  </div>
                  <div className="text-xs text-slate-500 mt-1">per day</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Duration</div>
                  <div className="text-lg font-bold text-white mt-1">
                    ~3-4 min
                  </div>
                  <div className="text-xs text-slate-500 mt-1">per episode</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Status</div>
                  <div className="text-lg font-bold text-green-600 mt-1">
                    Ready
                  </div>
                  <div className="text-xs text-slate-500 mt-1">operational</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-white mb-3">Publishing Platforms</h4>
                <div className="flex flex-wrap gap-2">
                  {['YouTube', 'Facebook', 'Instagram Reels', 'TikTok', 'LinkedIn', 'Twitter', 'Threads'].map((platform) => (
                    <span key={platform} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {platform}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-white mb-3">Episode Format</h4>
                <div className="bg-slate-50 rounded-lg p-4">
                  <ul className="text-sm text-slate-300 space-y-2">
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
                <h4 className="text-sm font-semibold text-white mb-3">Active Guest Profiles ({guestProfiles.length})</h4>
                <div className="space-y-3">
                  {guestProfiles.map((profile) => (
                    <div key={profile.id} className="bg-white border border-slate-200 rounded-lg p-4">
                      {editingProfile === profile.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-slate-400 font-medium">Name</label>
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
                              <label className="text-xs text-slate-400 font-medium">Title</label>
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
                              <label className="text-xs text-slate-400 font-medium">Avatar ID</label>
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
                              <label className="text-xs text-slate-400 font-medium">Voice ID</label>
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
                            <div className="font-medium text-white text-sm">{profile.name}</div>
                            <div className="text-xs text-slate-400 mt-1">{profile.title}</div>
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
                  <h4 className="text-sm font-semibold text-white">Workflows</h4>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-300 font-medium transition-colors"
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
                            <div className="font-medium text-white text-sm mb-1">
                              Episode #{workflow.episodeNumber}: {workflow.episodeTitle || 'Generating...'}
                            </div>
                            {workflow.guestName && (
                              <div className="text-xs text-slate-400 mb-1">Guest: {workflow.guestName}</div>
                            )}
                            {workflow.topic && (
                              <div className="text-xs text-slate-400 mb-1">Topic: {workflow.topic}</div>
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
                                <div className="font-mono text-slate-300 truncate">{workflow.heygenVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.submagicProjectId && (
                              <div>
                                <div className="text-slate-500 mb-1">Submagic</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.submagicProjectId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {(workflow.latePostId || workflow.metricoolPostId) && (
                              <div>
                                <div className="text-slate-500 mb-1">GetLate</div>
                                <div className="font-mono text-slate-300 truncate">{(workflow.latePostId || workflow.metricoolPostId)?.substring(0, 12)}...</div>
                              </div>
                            )}
                          </div>
                        )}
                        {workflow.error && (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                              <span className="font-semibold">Error:</span> {workflow.error}
                            </div>
                            <WorkflowRecoveryButtons workflow={workflow} onSuccess={loadWorkflows} />
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

        {activeSubTab === 'ownerfi-benefits' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Owner Financing Benefits</h3>
                <button
                  onClick={triggerBenefitCron}
                  disabled={triggeringBenefit}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggeringBenefit ? 'Generating...' : 'Generate Video Now'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Schedule</div>
                  <div className="text-lg font-bold text-white mt-1">
                    2x Daily
                  </div>
                  <div className="text-xs text-slate-500 mt-1">6 AM, 2 PM CDT</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Daily Target</div>
                  <div className="text-lg font-bold text-white mt-1">
                    2 videos
                  </div>
                  <div className="text-xs text-slate-500 mt-1">1 seller + 1 buyer</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Content Library</div>
                  <div className="text-lg font-bold text-white mt-1">
                    20 benefits
                  </div>
                  <div className="text-xs text-slate-500 mt-1">10 seller + 10 buyer</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Status</div>
                  <div className="text-lg font-bold text-green-600 mt-1">
                    Ready
                  </div>
                  <div className="text-xs text-slate-500 mt-1">operational</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-white mb-3">Publishing Platforms</h4>
                <div className="flex flex-wrap gap-2">
                  {['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Threads'].map((platform) => (
                    <span key={platform} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {platform}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-white mb-3">Video Format</h4>
                <div className="bg-slate-50 rounded-lg p-4">
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li>• <strong>Educational format</strong> - ONE benefit per video</li>
                    <li>• Rotating audience (alternates seller/buyer)</li>
                    <li>• Smart anti-repetition (avoids last 5 used benefits)</li>
                    <li>• Clear CTA: "Visit ownerfi.ai" in speech + captions</li>
                    <li>• HeyGen avatar + Submagic captions</li>
                    <li>• Mixed with podcast content on social media</li>
                  </ul>
                </div>
              </div>

              {/* Benefit Workflow Logs */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white">Workflows</h4>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-300 font-medium transition-colors"
                  >
                    {showHistory ? 'Active Only' : 'Show History'}
                  </button>
                </div>
                {benefitWorkflows && benefitWorkflows.workflows && benefitWorkflows.workflows.length > 0 ? (
                  <div className="space-y-3">
                    {benefitWorkflows.workflows.map((workflow) => (
                      <div key={workflow.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                workflow.audience === 'seller' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                              }`}>
                                {workflow.audience === 'seller' ? '💼 Seller' : '🏡 Buyer'}
                              </span>
                              <div className="font-medium text-white text-sm">{workflow.benefitTitle}</div>
                            </div>
                            <div className="text-xs text-slate-500">{formatTimeAgo(workflow.createdAt)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getBenefitStatusColor(workflow.status)}`}>
                              {formatStatus(workflow.status)}
                            </span>
                            <button
                              onClick={() => deleteWorkflow(workflow.id, 'benefit')}
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
                        {(workflow.heygenVideoId || workflow.submagicProjectId || workflow.latePostId) && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {workflow.heygenVideoId && (
                              <div>
                                <div className="text-slate-500 mb-1">HeyGen</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.heygenVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.submagicProjectId && (
                              <div>
                                <div className="text-slate-500 mb-1">Submagic</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.submagicProjectId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.latePostId && (
                              <div>
                                <div className="text-slate-500 mb-1">GetLate</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.latePostId.substring(0, 12)}...</div>
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
                    <div className="text-xs text-slate-400 mt-1">Benefit videos will appear here when being generated</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'ownerfi-properties' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Property Showcase Videos</h3>
                <button
                  onClick={triggerPropertyCron}
                  disabled={triggeringProperty}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggeringProperty ? 'Generating...' : 'Generate Property Video'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Rotation Queue Size</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {propertyStats?.total || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">properties</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Videos Today</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {propertyWorkflows?.workflows.filter(w => {
                      const today = new Date().setHours(0, 0, 0, 0);
                      return new Date(w.createdAt).setHours(0, 0, 0, 0) === today;
                    }).length || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">generated</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Next Property</div>
                  <div className="text-sm font-bold text-white mt-1">
                    {propertyStats?.nextProperty ? (
                      <>{propertyStats.nextProperty.address.substring(0, 20)}...</>
                    ) : (
                      'N/A'
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {propertyStats?.nextProperty && `${propertyStats.nextProperty.city}, ${propertyStats.nextProperty.state}`}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Rotation Days</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {propertyStats?.rotationDays || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">days per cycle</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-white mb-3">Publishing Platforms</h4>
                <div className="flex flex-wrap gap-2">
                  {['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Threads'].map((platform) => (
                    <span key={platform} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      {platform}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-white mb-3">Video Format</h4>
                <div className="bg-slate-50 rounded-lg p-4">
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li>• <strong>Property showcase format</strong> - 15-second videos</li>
                    <li>• Rotating queue of active properties with &lt;$15k down</li>
                    <li>• Smart rotation (each property shown every {propertyStats?.rotationDays || 0} days)</li>
                    <li>• Features: address, city, down payment, monthly payment</li>
                    <li>• HeyGen avatar + Submagic captions</li>
                    <li>• Automatic queue management and analytics tracking</li>
                  </ul>
                </div>
              </div>

              {/* Property Workflow Logs */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white">Workflows</h4>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-300 font-medium transition-colors"
                  >
                    {showHistory ? 'Active Only' : 'Show History'}
                  </button>
                </div>
                {propertyWorkflows && propertyWorkflows.workflows && propertyWorkflows.workflows.length > 0 ? (
                  <div className="space-y-3">
                    {propertyWorkflows.workflows.map((workflow) => (
                      <div key={workflow.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                {workflow.variant}
                              </span>
                              <div className="font-medium text-white text-sm">{workflow.address}</div>
                            </div>
                            <div className="text-xs text-slate-400 mb-1">
                              {workflow.city}, {workflow.state} • Down: ${workflow.downPayment.toLocaleString()} • Monthly: ${workflow.monthlyPayment.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500">{formatTimeAgo(workflow.createdAt)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getPropertyStatusColor(workflow.status)}`}>
                              {formatStatus(workflow.status)}
                            </span>
                            <button
                              onClick={() => deleteWorkflow(workflow.id, 'property')}
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
                        {(workflow.heygenVideoId || workflow.submagicProjectId || workflow.latePostId) && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {workflow.heygenVideoId && (
                              <div>
                                <div className="text-slate-500 mb-1">HeyGen</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.heygenVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.submagicProjectId && (
                              <div>
                                <div className="text-slate-500 mb-1">Submagic</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.submagicProjectId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.latePostId && (
                              <div>
                                <div className="text-slate-500 mb-1">GetLate</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.latePostId.substring(0, 12)}...</div>
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
                    <div className="text-xs text-slate-400 mt-1">Property videos will appear here when being generated</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'ownerfi-properties-spanish' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Property Showcase Videos (Spanish)</h3>
                <button
                  onClick={triggerSpanishPropertyCron}
                  disabled={triggeringSpanishProperty}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggeringSpanishProperty ? 'Generating...' : 'Generate Spanish Property Video'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Rotation Queue Size</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {spanishPropertyStats?.total || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">properties</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Videos Today</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {spanishPropertyWorkflows?.workflows.filter(w => {
                      const today = new Date().setHours(0, 0, 0, 0);
                      return new Date(w.createdAt).setHours(0, 0, 0, 0) === today;
                    }).length || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">generated</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Next Property</div>
                  <div className="text-sm font-bold text-white mt-1">
                    {spanishPropertyStats?.nextProperty ? (
                      <>{spanishPropertyStats.nextProperty.address.substring(0, 20)}...</>
                    ) : (
                      'N/A'
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {spanishPropertyStats?.nextProperty && `${spanishPropertyStats.nextProperty.city}, ${spanishPropertyStats.nextProperty.state}`}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Rotation Days</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {spanishPropertyStats?.rotationDays || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">days per cycle</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-white mb-3">Publishing Platforms</h4>
                <div className="flex flex-wrap gap-2">
                  {['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Threads'].map((platform) => (
                    <span key={platform} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      {platform}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-white mb-3">Video Format</h4>
                <div className="bg-slate-50 rounded-lg p-4">
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li>• <strong>Property showcase format (Spanish)</strong> - 15-second videos</li>
                    <li>• Rotating queue of active properties with &lt;$15k down</li>
                    <li>• Smart rotation (each property shown every {spanishPropertyStats?.rotationDays || 0} days)</li>
                    <li>• Features: address, city, down payment, monthly payment</li>
                    <li>• HeyGen avatar + Submagic captions (Spanish language)</li>
                    <li>• Automatic queue management and analytics tracking</li>
                  </ul>
                </div>
              </div>

              {/* Spanish Property Workflow Logs */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white">Workflows</h4>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-300 font-medium transition-colors"
                  >
                    {showHistory ? 'Active Only' : 'Show History'}
                  </button>
                </div>
                {spanishPropertyWorkflows && spanishPropertyWorkflows.workflows && spanishPropertyWorkflows.workflows.length > 0 ? (
                  <div className="space-y-3">
                    {spanishPropertyWorkflows.workflows.map((workflow) => (
                      <div key={workflow.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                {workflow.variant}
                              </span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                ES
                              </span>
                              <div className="font-medium text-white text-sm">{workflow.address}</div>
                            </div>
                            <div className="text-xs text-slate-400 mb-1">
                              {workflow.city}, {workflow.state} • Down: ${workflow.downPayment.toLocaleString()} • Monthly: ${workflow.monthlyPayment.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500">{formatTimeAgo(workflow.createdAt)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getPropertyStatusColor(workflow.status)}`}>
                              {formatStatus(workflow.status)}
                            </span>
                            <button
                              onClick={() => deleteWorkflow(workflow.id, 'property-spanish')}
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
                        {(workflow.heygenVideoId || workflow.submagicProjectId || workflow.latePostId) && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {workflow.heygenVideoId && (
                              <div>
                                <div className="text-slate-500 mb-1">HeyGen</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.heygenVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.submagicProjectId && (
                              <div>
                                <div className="text-slate-500 mb-1">Submagic</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.submagicProjectId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.latePostId && (
                              <div>
                                <div className="text-slate-500 mb-1">GetLate</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.latePostId.substring(0, 12)}...</div>
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
                    <div className="text-xs text-slate-400 mt-1">Spanish property videos will appear here when being generated</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'abdullah' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Abdullah Personal Brand</h3>
                <button
                  onClick={() => triggerAbdullahWorkflow()}
                  disabled={triggeringAbdullah}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggeringAbdullah ? 'Generating...' : 'Generate 5 Videos Now'}
                </button>
              </div>

              {/* Queue Stats */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-white mb-3">Daily Content Queue</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="text-sm text-blue-600 font-medium">Pending</div>
                    <div className="text-2xl font-bold text-blue-900 mt-1">
                      {abdullahQueueStats?.queue?.pending || 0}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">in queue</div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <div className="text-sm text-yellow-600 font-medium">Generating</div>
                    <div className="text-2xl font-bold text-yellow-900 mt-1">
                      {abdullahQueueStats?.queue?.generating || 0}
                    </div>
                    <div className="text-xs text-yellow-600 mt-1">processing now</div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="text-sm text-green-600 font-medium">Today</div>
                    <div className="text-2xl font-bold text-green-900 mt-1">
                      {abdullahQueueStats?.queue?.completedToday || 0}
                    </div>
                    <div className="text-xs text-green-600 mt-1">completed</div>
                  </div>

                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <div className="text-sm text-red-600 font-medium">Failed</div>
                    <div className="text-2xl font-bold text-red-900 mt-1">
                      {abdullahQueueStats?.queue?.failed || 0}
                    </div>
                    <div className="text-xs text-red-600 mt-1">need retry</div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <div className="text-sm text-purple-600 font-medium">Total</div>
                    <div className="text-2xl font-bold text-purple-900 mt-1">
                      {abdullahQueueStats?.queue?.total || 0}
                    </div>
                    <div className="text-xs text-purple-600 mt-1">all items</div>
                  </div>
                </div>
              </div>

              {/* Next Scheduled Items */}
              {abdullahQueueStats?.nextItems && abdullahQueueStats.nextItems.length > 0 && (
                <div className="mb-6 pb-6 border-b border-slate-200">
                  <h4 className="text-sm font-semibold text-white mb-3">Upcoming Videos</h4>
                  <div className="space-y-2">
                    {abdullahQueueStats.nextItems.map((item: any, index: number) => (
                      <div key={item.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium text-white text-sm">{item.title}</div>
                            <div className="text-xs text-slate-500 capitalize">{item.theme}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400">
                            Generate: {new Date(item.scheduledGenerationTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })} CST
                          </div>
                          <div className="text-xs text-slate-500">
                            Post: {new Date(item.scheduledPostTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })} CST
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* System Info */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Daily Videos</div>
                  <div className="text-2xl font-bold text-white mt-1">5</div>
                  <div className="text-xs text-slate-500 mt-1">videos/day</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Content Type</div>
                  <div className="text-sm font-bold text-white mt-1">AI Generated</div>
                  <div className="text-xs text-slate-500 mt-1">queue system</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Schedule</div>
                  <div className="text-sm font-bold text-white mt-1">11 AM CST</div>
                  <div className="text-xs text-slate-500 mt-1">daily scripts</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-white mb-3">Daily Themes</h4>
                <div className="flex flex-wrap gap-2">
                  {['Mindset', 'Business', 'Money', 'Freedom', 'Story/Lesson'].map((theme) => (
                    <span key={theme} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {theme}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-white mb-3">Publishing Platforms</h4>
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
                  <h4 className="text-sm font-semibold text-white">Workflows</h4>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-300 font-medium transition-colors"
                  >
                    {showHistory ? 'Active Only' : 'Show History'}
                  </button>
                </div>
                {workflows && workflows.workflows && workflows.workflows.abdullah && workflows.workflows.abdullah.length > 0 ? (
                  <div className="space-y-3">
                    {workflows.workflows.abdullah.map((workflow) => (
                      <div key={workflow.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-medium text-white text-sm mb-1" dangerouslySetInnerHTML={{ __html: workflow.articleTitle }} />
                            <div className="flex items-center gap-2 mt-1">
                              <div className="text-xs text-slate-500">{formatTimeAgo(workflow.createdAt)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(workflow.status)}`}>
                              {formatStatus(workflow.status)}
                            </span>
                            <button
                              onClick={() => deleteWorkflow(workflow.id, 'abdullah')}
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
                                <div className="font-mono text-slate-300 truncate">{workflow.heygenVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {workflow.submagicVideoId && (
                              <div>
                                <div className="text-slate-500 mb-1">Submagic</div>
                                <div className="font-mono text-slate-300 truncate">{workflow.submagicVideoId.substring(0, 12)}...</div>
                              </div>
                            )}
                            {(workflow.latePostId || workflow.metricoolPostId) && (
                              <div>
                                <div className="text-slate-500 mb-1">GetLate</div>
                                <div className="font-mono text-slate-300 truncate">{(workflow.latePostId || workflow.metricoolPostId)?.substring(0, 12)}...</div>
                              </div>
                            )}
                          </div>
                        )}
                        {workflow.error && (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                              <span className="font-semibold">Error:</span> {workflow.error}
                            </div>
                            <WorkflowRecoveryButtons workflow={workflow} onSuccess={loadWorkflows} />
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

              {/* Recent ChatGPT Scripts - For Prompt Improvement */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white">Recent ChatGPT Scripts</h4>
                  <span className="text-xs text-slate-500">Copy to improve prompts</span>
                </div>
                {recentScripts.length > 0 ? (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {recentScripts.map((script) => (
                      <div key={script.id} className="bg-gradient-to-r from-slate-50 to-purple-50 border border-slate-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-white text-sm">{script.title}</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 capitalize">
                                {script.theme}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                script.status === 'completed' ? 'bg-green-100 text-green-700' :
                                script.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {script.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">
                              {script.createdAt ? new Date(script.createdAt).toLocaleString() : 'N/A'}
                            </div>
                          </div>
                          <button
                            onClick={() => copyScriptToClipboard(script)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              copiedScriptId === script.id
                                ? 'bg-green-100 text-green-700'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            }`}
                          >
                            {copiedScriptId === script.id ? (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                              </>
                            )}
                          </button>
                        </div>

                        {/* Hook */}
                        {script.hook && (
                          <div className="mb-2">
                            <div className="text-xs font-medium text-purple-600 mb-1">Hook:</div>
                            <div className="text-xs text-slate-300 bg-purple-50 rounded px-2 py-1 italic">
                              "{script.hook}"
                            </div>
                          </div>
                        )}

                        {/* Script */}
                        <div className="mb-2">
                          <div className="text-xs font-medium text-slate-400 mb-1">Script:</div>
                          <div className="text-xs text-slate-300 bg-white rounded px-2 py-1.5 border border-slate-200 max-h-20 overflow-y-auto">
                            {script.script}
                          </div>
                        </div>

                        {/* Caption */}
                        <div>
                          <div className="text-xs font-medium text-slate-400 mb-1">Caption:</div>
                          <div className="text-xs text-slate-400 bg-slate-100 rounded px-2 py-1.5 max-h-16 overflow-y-auto">
                            {script.caption}
                          </div>
                        </div>

                        {/* Video Link */}
                        {script.finalVideoUrl && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <a
                              href={script.finalVideoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Watch Video
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-lg p-8 text-center border border-slate-200">
                    <div className="text-slate-500 text-sm font-medium">No scripts available yet</div>
                    <div className="text-xs text-slate-400 mt-1">Scripts will appear here after the next video generation</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'analytics' && (
          <AnalyticsDashboard />
        )}

        {activeSubTab === 'youtube-analytics' && (
          <YouTubeAnalyticsDashboard />
        )}

        {activeSubTab === 'old_analytics_backup' && (
          <div className="space-y-6">
            {/* Overall Health */}
            {analytics && (
              <>
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">System Health & Performance</h3>

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
                      <div className="text-sm text-slate-400">Total Videos</div>
                      <div className="text-2xl font-bold text-white mt-1">
                        {analytics.keyMetrics.totalVideosGenerated}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">all time</div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-400">Success Rate</div>
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
                      <div className="text-sm text-slate-400">Processing Time</div>
                      <div className="text-lg font-bold text-white mt-1">
                        {analytics.keyMetrics.averageProcessingTime}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">per video</div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-400">Content Quality</div>
                      <div className="text-sm font-bold text-white mt-1">
                        {analytics.keyMetrics.contentQuality}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">AI filtering</div>
                    </div>
                  </div>
                </div>

                {/* Brand Comparison */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Brand Performance Comparison</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Carz Analytics */}
                    <div className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">🚗</span>
                          <h4 className="font-semibold text-white">Carz Inc</h4>
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
                          <span className="text-slate-400">Success Rate:</span>
                          <span className="font-medium">{analytics.brands.carz.successRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Articles Ready:</span>
                          <span className="font-medium">{analytics.brands.carz.unprocessedArticles}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Videos Generated:</span>
                          <span className="font-medium">{analytics.brands.carz.videosGenerated}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Failed Workflows:</span>
                          <span className="font-medium text-red-600">{analytics.brands.carz.queueStats.failed}</span>
                        </div>
                      </div>
                    </div>

                    {/* OwnerFi Analytics */}
                    <div className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">🏠</span>
                          <h4 className="font-semibold text-white">OwnerFi</h4>
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
                          <span className="text-slate-400">Success Rate:</span>
                          <span className="font-medium">{analytics.brands.ownerfi.successRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Articles Ready:</span>
                          <span className="font-medium">{analytics.brands.ownerfi.unprocessedArticles}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Videos Generated:</span>
                          <span className="font-medium">{analytics.brands.ownerfi.videosGenerated}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Failed Workflows:</span>
                          <span className="font-medium text-red-600">{analytics.brands.ownerfi.queueStats.failed}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">AI Recommendations</h3>
                      <div className="text-xs text-slate-500 mt-1">
                        Last updated: {new Date(analytics.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-slate-400">
                        {analytics.recommendations.length} insights
                      </div>
                      <button
                        onClick={() => loadAnalytics(true)}
                        disabled={refreshingAnalytics}
                        className="px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                      >
                        {refreshingAnalytics ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Refreshing...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Refresh</span>
                          </>
                        )}
                      </button>
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
                                <h4 className="font-semibold text-white">{rec.title}</h4>
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  rec.impact === 'high' ? 'bg-red-200 text-red-800' :
                                  rec.impact === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                                  'bg-gray-200 text-gray-800'
                                }`}>
                                  {rec.impact.toUpperCase()} IMPACT
                                </span>
                              </div>
                              <p className="text-sm text-slate-300 mb-2">{rec.description}</p>
                              <div className="text-xs text-slate-400 mb-3">
                                <span className="font-medium">Action:</span> {rec.action}
                              </div>

                              {/* Copy-Paste Section */}
                              <div className="bg-white border border-slate-300 rounded-lg p-3 mt-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-slate-300">Copy for Claude:</span>
                                  <button
                                    onClick={() => copyToClipboard(rec.copyPasteText, rec.id)}
                                    className={`text-xs px-3 py-1 rounded-lg font-medium transition-all ${
                                      copiedRecId === rec.id
                                        ? 'bg-green-600 text-white'
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    }`}
                                  >
                                    {copiedRecId === rec.id ? '✓ Copied!' : '📋 Copy'}
                                  </button>
                                </div>
                                <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-slate-50 p-2 rounded border border-slate-200">
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
                    <h3 className="text-lg font-semibold text-white">Coming Soon: Late.so Analytics Integration</h3>
                  </div>
                  <p className="text-sm text-slate-300 mb-4">
                    Once Late.so releases their analytics API, we'll automatically track:
                  </p>
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li>• Real-time engagement metrics (views, likes, comments, shares)</li>
                    <li>• Platform-specific performance comparison</li>
                    <li>• Optimal posting time analysis</li>
                    <li>• Content type performance (trending vs evergreen)</li>
                    <li>• Audience retention heatmaps</li>
                    <li>• A/B testing results for captions and thumbnails</li>
                  </ul>
                  <div className="mt-4 text-xs text-slate-400">
                    For now, manually track engagement in your platform dashboards and use the recommendations above to optimize performance.
                  </div>
                </div>
              </>
            )}

            {!analytics && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
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
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mt-6">
          <h3 className="text-lg font-semibold text-white mb-4">System Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-400">Cron Schedule</div>
              <div className="font-medium text-white mt-1">5x daily (9AM-9PM CDT)</div>
            </div>
            <div>
              <div className="text-slate-400">Video Generation</div>
              <div className="font-medium text-white mt-1">HeyGen + Submagic</div>
            </div>
            <div>
              <div className="text-slate-400">Storage</div>
              <div className="font-medium text-white mt-1">Cloudflare R2</div>
            </div>
            <div>
              <div className="text-slate-400">Publishing</div>
              <div className="font-medium text-white mt-1">GetLate API</div>
            </div>
            <div>
              <div className="text-slate-400">Last Updated</div>
              <div className="font-medium text-white mt-1">
                {status?.timestamp ? new Date(status.timestamp).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Cost per Video</div>
              <div className="font-medium text-white mt-1">~$1.05</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
