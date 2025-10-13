'use client';

import { useState, useEffect } from 'react';

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
  articles: {
    carz: number;
    ownerfi: number;
  };
  queue: {
    carz: number;
    ownerfi: number;
  };
  results?: Array<{
    brand: string;
    success: boolean;
    article?: string;
    videoId?: string;
    error?: string;
  }>;
}

export default function SocialMediaDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'carz' | 'ownerfi' | 'podcast'>('carz');
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

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
    setTriggering(true);
    try {
      const response = await fetch('/api/cron/viral-video', { method: 'POST' });
      const data = await response.json();
      alert(data.success ? 'Cron triggered successfully!' : `Error: ${data.error}`);
      loadStatus();
    } catch (error) {
      alert('Failed to trigger cron');
    } finally {
      setTriggering(false);
    }
  };

  const triggerPodcastCron = async () => {
    setTriggering(true);
    try {
      const response = await fetch('/api/podcast/cron', { method: 'POST' });
      const data = await response.json();
      alert(data.success ? 'Podcast cron triggered successfully!' : `Error: ${data.error}`);
    } catch (error) {
      alert('Failed to trigger podcast cron');
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
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
                <div className="text-sm font-medium text-slate-600">Scheduler Status</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {status?.scheduler.running ? 'Running' : 'Stopped'}
                </div>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                status?.scheduler.running ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <div className={`w-6 h-6 rounded-full ${
                  status?.scheduler.running ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-600">RSS Feeds</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {status?.feeds.total || 0}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {status?.feeds.carz || 0} Carz • {status?.feeds.ownerfi || 0} OwnerFi
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
                  {(status?.articles.carz || 0) + (status?.articles.ownerfi || 0)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {status?.articles.carz || 0} Carz • {status?.articles.ownerfi || 0} OwnerFi
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
                  disabled={triggering}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggering ? 'Generating...' : 'Generate Video Now'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Daily Limit</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.scheduler.config.maxVideosPerDay.carz || 5}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">videos/day</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Available Articles</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.articles.carz || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">ready to process</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">In Queue</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.queue.carz || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">pending videos</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">RSS Feeds</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.feeds.carz || 0}
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
                  disabled={triggering}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggering ? 'Generating...' : 'Generate Video Now'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Daily Limit</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.scheduler.config.maxVideosPerDay.ownerfi || 5}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">videos/day</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">Available Articles</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.articles.ownerfi || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">ready to process</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">In Queue</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.queue.ownerfi || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">pending videos</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600">RSS Feeds</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {status?.feeds.ownerfi || 0}
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
                  disabled={triggering}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                >
                  {triggering ? 'Generating...' : 'Generate Episode Now'}
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
