'use client';

import { useState, useEffect } from 'react';

interface PerformanceData {
  timeSeries: Array<{
    date: string;
    views: number;
    engagement: number;
    posts: number;
  }>;
  timeSlots: Array<{
    slot: string;
    avgViews: number;
    avgEngagement: number;
    totalPosts: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  dayOfWeek: Array<{
    day: string;
    avgViews: number;
    avgEngagement: number;
    totalPosts: number;
  }>;
  contentTypes: Array<{
    type: string;
    avgViews: number;
    avgEngagement: number;
    totalPosts: number;
    bestTimeSlot: string;
  }>;
  hooks: Array<{
    type: string;
    avgViews: number;
    avgEngagement: number;
    totalPosts: number;
    examples: string[];
  }>;
  platforms: Array<{
    platform: string;
    avgViews: number;
    avgEngagement: number;
    totalPosts: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  topPerformers: {
    commonTraits: {
      mostCommonTimeSlot: string;
      mostCommonHook: string;
      mostCommonContentType: string;
      avgVideoLength: string;
      bestPlatform: string;
    };
    posts: Array<{
      id: string;
      views: number;
      engagement: number;
      timeSlot: string;
      contentType: string;
      hook: string;
      platforms: string[];
    }>;
  };
  overall: {
    totalPosts: number;
    totalViews: number;
    avgEngagement: number;
    growthRate: number;
  };
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [days, setDays] = useState<number>(7);
  const [activeTab, setActiveTab] = useState<'overview' | 'timing' | 'content' | 'platforms'>('overview');

  useEffect(() => {
    loadAnalytics();
  }, [selectedBrand, days]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBrand !== 'all') {
        params.append('brand', selectedBrand);
      }
      params.append('days', days.toString());

      const response = await fetch(`/api/analytics/performance?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        // Only log to console if it's not a "no data" error (404)
        if (response.status !== 404) {
          console.error('Failed to load analytics:', result.error);
        }
        // For 404, we'll just show the UI prompt to sync data
        setData(null);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: selectedBrand !== 'all' ? selectedBrand : undefined,
          days
        })
      });

      const result = await response.json();
      if (result.success) {
        // Reload analytics after sync
        await loadAnalytics();
      }
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading analytics data...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-3xl mx-auto">
          <p className="text-2xl font-semibold text-blue-900 mb-3">📊 Analytics System Information</p>

          <div className="bg-white rounded-lg p-5 mb-4 text-left">
            <h3 className="font-bold text-gray-900 mb-2">⚠️ Important: Late.dev API Limitation</h3>
            <p className="text-gray-700 mb-3">
              Late.dev's API <strong>does not provide analytics metrics</strong> (views, likes, engagement).
              They only handle post scheduling and publishing.
            </p>
            <p className="text-gray-700 mb-3">
              To get real analytics data, you need to integrate with platform-specific APIs:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li><strong>Instagram:</strong> Meta Graph API (Instagram Insights)</li>
              <li><strong>TikTok:</strong> TikTok Content Posting API</li>
              <li><strong>YouTube:</strong> YouTube Analytics API</li>
              <li><strong>Twitter/X:</strong> Twitter API v2 (Tweet Metrics)</li>
              <li><strong>LinkedIn:</strong> LinkedIn Marketing API</li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-left">
            <h3 className="font-bold text-gray-900 mb-2">📈 What You CAN Track</h3>
            <p className="text-gray-700">
              Your system currently tracks: posting schedule, content types, platforms, and workflow completion.
              Check the Social Dashboard for workflow status and posting activity.
            </p>
          </div>

          <div className="mt-4">
            <a
              href="/admin/social-dashboard"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 inline-block"
            >
              View Social Media Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">📊 Performance Analytics</h1>
          <button
            onClick={syncData}
            disabled={syncing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm"
          >
            {syncing ? '⏳ Syncing...' : '🔄 Sync Data'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 bg-white"
            >
              <option value="all">All Brands</option>
              <option value="carz">Carz Inc</option>
              <option value="ownerfi">OwnerFi</option>
              <option value="podcast">Podcast</option>
              <option value="vassdistro">VassDistro</option>
              <option value="abdullah">Abdullah</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="border border-gray-300 rounded-lg px-4 py-2 bg-white"
            >
              <option value={7}>Last 7 Days</option>
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">Total Posts</p>
          <p className="text-3xl font-bold text-gray-900">{data.overall.totalPosts}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">Total Views</p>
          <p className="text-3xl font-bold text-gray-900">{data.overall.totalViews.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">Avg Engagement</p>
          <p className="text-3xl font-bold text-gray-900">{data.overall.avgEngagement.toFixed(2)}%</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">Growth Rate</p>
          <p className={`text-3xl font-bold ${data.overall.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.overall.growthRate >= 0 ? '+' : ''}{data.overall.growthRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 px-6" aria-label="Tabs">
            {[
              { id: 'overview', label: '📈 Overview', emoji: '📈' },
              { id: 'timing', label: '⏰ Timing', emoji: '⏰' },
              { id: 'content', label: '🎬 Content', emoji: '🎬' },
              { id: 'platforms', label: '📱 Platforms', emoji: '📱' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-3 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab data={data} />}
          {activeTab === 'timing' && <TimingTab data={data} />}
          {activeTab === 'content' && <ContentTab data={data} />}
          {activeTab === 'platforms' && <PlatformsTab data={data} />}
        </div>
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({ data }: { data: PerformanceData }) {
  return (
    <div className="space-y-6">
      {/* Time Series Chart */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Views Over Time</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-end justify-between h-48 gap-2">
            {data.timeSeries.map((point, index) => {
              const maxViews = Math.max(...data.timeSeries.map(p => p.views));
              const height = (point.views / maxViews) * 100;

              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-500 rounded-t-lg hover:bg-blue-600 cursor-pointer transition-all"
                    style={{ height: `${height}%` }}
                    title={`${new Date(point.date).toLocaleDateString()}: ${point.views} views`}
                  ></div>
                  <p className="text-xs text-gray-600 mt-2 transform -rotate-45 origin-top-left">
                    {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Performer Common Traits */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🏆 Top Performers - Common Traits</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">⏰ Best Time Slot</p>
            <p className="text-lg font-bold text-blue-900">{data.topPerformers.commonTraits.mostCommonTimeSlot}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">🎯 Best Hook Type</p>
            <p className="text-lg font-bold text-green-900">{data.topPerformers.commonTraits.mostCommonHook}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">🎬 Best Content Type</p>
            <p className="text-lg font-bold text-purple-900">{data.topPerformers.commonTraits.mostCommonContentType}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">⏱️ Avg Video Length</p>
            <p className="text-lg font-bold text-yellow-900">{data.topPerformers.commonTraits.avgVideoLength}</p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">📱 Best Platform</p>
            <p className="text-lg font-bold text-pink-900">{data.topPerformers.commonTraits.bestPlatform}</p>
          </div>
        </div>
      </div>

      {/* Top 10 Posts */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🌟 Top 10 Performing Posts</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Views</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engagement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time Slot</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hook</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.topPerformers.posts.map((post, index) => (
                <tr key={post.id} className={index < 3 ? 'bg-yellow-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {index === 0 && '🥇'}
                    {index === 1 && '🥈'}
                    {index === 2 && '🥉'}
                    {index > 2 && `#${index + 1}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {post.views.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {post.engagement.toFixed(2)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {post.timeSlot}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {post.contentType}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {post.hook}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Timing Tab
function TimingTab({ data }: { data: PerformanceData }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">⏰ Best Time Slots</h3>
        <div className="space-y-3">
          {data.timeSlots.map((slot, index) => (
            <div key={slot.slot} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{slot.slot}</p>
                <p className="text-sm text-gray-600">{slot.totalPosts} posts</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-blue-600">{Math.round(slot.avgViews).toLocaleString()}</p>
                <p className="text-xs text-gray-500">avg views</p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-xl font-bold text-green-600">{slot.avgEngagement.toFixed(2)}%</p>
                <p className="text-xs text-gray-500">engagement</p>
              </div>
              <div className="ml-4">
                {index === 0 && <span className="text-2xl">🏆</span>}
                {index === 1 && <span className="text-2xl">🥈</span>}
                {index === 2 && <span className="text-2xl">🥉</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📅 Day of Week Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.dayOfWeek.map(day => (
            <div key={day.day} className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="font-medium text-gray-900 mb-2">{day.day}</p>
              <p className="text-2xl font-bold text-blue-600 mb-1">{Math.round(day.avgViews).toLocaleString()}</p>
              <p className="text-sm text-gray-600">{day.avgEngagement.toFixed(2)}% engagement</p>
              <p className="text-xs text-gray-500 mt-2">{day.totalPosts} posts</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Content Tab
function ContentTab({ data }: { data: PerformanceData }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🎬 Content Type Performance</h3>
        <div className="space-y-3">
          {data.contentTypes.map(type => (
            <div key={type.type} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-900 capitalize">{type.type}</p>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Best: {type.bestTimeSlot}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{Math.round(type.avgViews).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">avg views</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{type.avgEngagement.toFixed(2)}%</p>
                  <p className="text-xs text-gray-500">engagement</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-600">{type.totalPosts}</p>
                  <p className="text-xs text-gray-500">posts</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Hook Type Performance</h3>
        <div className="space-y-4">
          {data.hooks.map(hook => (
            <div key={hook.type} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-gray-900">{hook.type}</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-blue-600 font-semibold">{Math.round(hook.avgViews).toLocaleString()} views</span>
                  <span className="text-green-600 font-semibold">{hook.avgEngagement.toFixed(2)}% engagement</span>
                </div>
              </div>
              {hook.examples.length > 0 && (
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-500 mb-2">Example hooks:</p>
                  {hook.examples.map((example, idx) => (
                    <p key={idx} className="text-sm text-gray-700 italic mb-1">"{example}"</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Platforms Tab
function PlatformsTab({ data }: { data: PerformanceData }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📱 Platform Performance Comparison</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.platforms.map((platform, index) => (
            <div key={platform.platform} className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-blue-400 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-gray-900 text-lg capitalize">{platform.platform}</p>
                {index === 0 && <span className="text-2xl">👑</span>}
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-bold text-blue-600">{Math.round(platform.avgViews).toLocaleString()}</p>
                  <p className="text-sm text-gray-500">avg views per post</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{platform.avgEngagement.toFixed(2)}%</p>
                  <p className="text-sm text-gray-500">engagement rate</p>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-sm text-gray-600">{platform.totalPosts} total posts</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Platform Insights</h4>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• Focus on top 3 platforms for maximum ROI</li>
          <li>• Consider reducing posts on underperforming platforms</li>
          <li>• Test platform-specific content strategies</li>
          <li>• Monitor engagement rate trends over time</li>
        </ul>
      </div>
    </div>
  );
}
