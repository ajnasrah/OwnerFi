'use client';

import { useState, useEffect } from 'react';

interface PlatformPerformance {
  platform: string;
  totalPosts: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgSaves: number;
  avgEngagementRate: number;
  peakHours: Array<{
    hour: number;
    avgViews: number;
    avgEngagement: number;
    postCount: number;
  }>;
  peakDays: Array<{
    dayOfWeek: number;
    dayName: string;
    avgViews: number;
    avgEngagement: number;
    postCount: number;
  }>;
  trend: 'up' | 'down' | 'stable';
  weekOverWeekGrowth: number;
}

interface PlatformRecommendations {
  date: string;
  brand: string;
  platforms: {
    [key: string]: {
      optimalTimes: string[];
      bestDays: string[];
      avgEngagement: string;
      trend: string;
      weekOverWeekGrowth: string;
      recommendations: string[];
    };
  };
  overall: {
    topPlatform: string;
    bestTimeSlot: string;
    actionItems: string[];
  };
}

export default function PlatformAnalyticsDashboard() {
  const [platforms, setPlatforms] = useState<PlatformPerformance[]>([]);
  const [recommendations, setRecommendations] = useState<PlatformRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string>('ownerfi');
  const [days, setDays] = useState<number>(7);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [selectedBrand, days]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('brand', selectedBrand);
      params.append('days', days.toString());

      const response = await fetch(`/api/analytics/platforms?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setPlatforms(result.data.platforms || []);
        setRecommendations(result.data.recommendations);
      } else {
        console.error('Failed to load analytics:', result.error);
        setPlatforms([]);
        setRecommendations(null);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      setPlatforms([]);
      setRecommendations(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading platform analytics...</p>
      </div>
    );
  }

  if (platforms.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-3xl mx-auto">
          <p className="text-2xl font-semibold text-blue-900 mb-3">📊 No Platform Data Available</p>
          <p className="text-gray-700 mb-4">
            Run the platform analytics sync script to collect data:
          </p>
          <code className="bg-gray-900 text-green-400 px-4 py-2 rounded block mb-4">
            npx tsx scripts/sync-platform-analytics.ts
          </code>
          <p className="text-sm text-gray-600">
            This will fetch analytics from Late API and store platform-specific metrics for analysis.
          </p>
        </div>
      </div>
    );
  }

  const selectedPlatformData = selectedPlatform
    ? platforms.find(p => p.platform === selectedPlatform)
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header with Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">📱 Platform-Specific Analytics</h1>
          <button
            onClick={loadAnalytics}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
          >
            🔄 Refresh
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
              <option value="ownerfi">OwnerFi</option>
              <option value="carz">Carz Inc</option>
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

      {/* Platform Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((platform, index) => (
          <div
            key={platform.platform}
            onClick={() => setSelectedPlatform(platform.platform)}
            className={`bg-white border-2 rounded-lg p-6 cursor-pointer transition-all ${
              selectedPlatform === platform.platform
                ? 'border-blue-500 shadow-lg'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg capitalize">{platform.platform}</h3>
              <div className="flex items-center gap-2">
                {index === 0 && <span className="text-2xl">👑</span>}
                {platform.trend === 'up' && <span className="text-green-600">📈</span>}
                {platform.trend === 'down' && <span className="text-red-600">📉</span>}
                {platform.trend === 'stable' && <span className="text-gray-600">➡️</span>}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-3xl font-bold text-blue-600">
                  {Math.round(platform.avgViews).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">avg views per post</p>
              </div>

              <div>
                <p className="text-2xl font-bold text-green-600">
                  {platform.avgEngagementRate.toFixed(2)}%
                </p>
                <p className="text-sm text-gray-500">engagement rate</p>
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-between text-sm">
                <div>
                  <p className="text-gray-600">{platform.totalPosts} posts</p>
                </div>
                <div className={platform.weekOverWeekGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {platform.weekOverWeekGrowth >= 0 ? '+' : ''}
                  {platform.weekOverWeekGrowth.toFixed(0)}% WoW
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Platform Deep-Dive */}
      {selectedPlatformData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 capitalize">
            {selectedPlatformData.platform} Deep Dive
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Peak Hours */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">⏰ Best Posting Hours</h3>
              <div className="space-y-2">
                {selectedPlatformData.peakHours.slice(0, 5).map((hour, index) => (
                  <div key={hour.hour} className="flex items-center justify-between bg-gray-50 rounded p-3">
                    <div className="flex items-center gap-3">
                      {index === 0 && <span className="text-lg">🏆</span>}
                      {index === 1 && <span className="text-lg">🥈</span>}
                      {index === 2 && <span className="text-lg">🥉</span>}
                      {index > 2 && <span className="text-lg">  </span>}
                      <span className="font-medium">
                        {hour.hour.toString().padStart(2, '0')}:00
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-blue-600">
                        {Math.round(hour.avgViews).toLocaleString()} views
                      </p>
                      <p className="text-xs text-gray-500">
                        {hour.avgEngagement.toFixed(1)}% engagement
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Peak Days */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">📅 Best Posting Days</h3>
              <div className="space-y-2">
                {selectedPlatformData.peakDays.map((day, index) => (
                  <div key={day.dayOfWeek} className="flex items-center justify-between bg-gray-50 rounded p-3">
                    <div className="flex items-center gap-3">
                      {index === 0 && <span className="text-lg">🏆</span>}
                      {index === 1 && <span className="text-lg">🥈</span>}
                      {index === 2 && <span className="text-lg">🥉</span>}
                      <span className="font-medium">{day.dayName}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-blue-600">
                        {Math.round(day.avgViews).toLocaleString()} views
                      </p>
                      <p className="text-xs text-gray-500">
                        {day.avgEngagement.toFixed(1)}% engagement
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Engagement Breakdown */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded p-4">
              <p className="text-sm text-gray-600 mb-1">Avg Likes</p>
              <p className="text-2xl font-bold text-blue-900">
                {Math.round(selectedPlatformData.avgLikes).toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 rounded p-4">
              <p className="text-sm text-gray-600 mb-1">Avg Comments</p>
              <p className="text-2xl font-bold text-green-900">
                {Math.round(selectedPlatformData.avgComments).toLocaleString()}
              </p>
            </div>
            <div className="bg-purple-50 rounded p-4">
              <p className="text-sm text-gray-600 mb-1">Avg Shares</p>
              <p className="text-2xl font-bold text-purple-900">
                {Math.round(selectedPlatformData.avgShares).toLocaleString()}
              </p>
            </div>
            <div className="bg-pink-50 rounded p-4">
              <p className="text-sm text-gray-600 mb-1">Avg Saves</p>
              <p className="text-2xl font-bold text-pink-900">
                {Math.round(selectedPlatformData.avgSaves).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🎯 AI-Powered Recommendations</h2>

          <div className="space-y-4">
            {/* Overall Recommendations */}
            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">🏆 Top Priorities</h3>
              <div className="space-y-2">
                {recommendations.overall.actionItems.map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">{index + 1}.</span>
                    <p className="text-gray-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform-Specific Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(recommendations.platforms).map(([platform, rec]) => (
                <div key={platform} className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold capitalize mb-2">{platform}</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Best times:</span>
                      <span className="ml-2 font-medium text-blue-600">
                        {rec.optimalTimes.join(', ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Best days:</span>
                      <span className="ml-2 font-medium text-green-600">
                        {rec.bestDays.join(', ')}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      {rec.recommendations.slice(0, 2).map((r, idx) => (
                        <p key={idx} className="text-xs text-gray-600 mb-1">• {r}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Heatmap Visualization */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">🔥 Posting Time Heatmap</h2>
        <p className="text-sm text-gray-600 mb-4">
          Shows average views by hour across all platforms. Darker = better performance.
        </p>

        <div className="overflow-x-auto">
          <HeatmapVisualization platforms={platforms} />
        </div>
      </div>
    </div>
  );
}

// Heatmap Component
function HeatmapVisualization({ platforms }: { platforms: PlatformPerformance[] }) {
  // Build hour-to-views map across all platforms
  const hourData = new Map<number, number>();

  platforms.forEach(platform => {
    platform.peakHours.forEach(hour => {
      const existing = hourData.get(hour.hour) || 0;
      hourData.set(hour.hour, existing + hour.avgViews);
    });
  });

  const maxViews = Math.max(...Array.from(hourData.values()));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="flex gap-1">
      {hours.map(hour => {
        const views = hourData.get(hour) || 0;
        const intensity = maxViews > 0 ? (views / maxViews) : 0;
        const bgColor = intensity > 0.7 ? 'bg-green-600' :
                       intensity > 0.4 ? 'bg-green-400' :
                       intensity > 0.2 ? 'bg-yellow-400' :
                       intensity > 0 ? 'bg-gray-300' : 'bg-gray-100';

        return (
          <div key={hour} className="flex-1 text-center">
            <div
              className={`${bgColor} rounded p-4 mb-1 transition-all hover:scale-110`}
              title={`${hour.toString().padStart(2, '0')}:00 - ${Math.round(views).toLocaleString()} views`}
            />
            <p className="text-xs text-gray-600">{hour}</p>
          </div>
        );
      })}
    </div>
  );
}
