'use client';

import { useState, useEffect } from 'react';

interface YouTubeVideo {
  videoId: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  engagement: number;
  duration: number;
  isShort: boolean;
  publishedAt: string;
  url: string;
}

interface BrandAnalytics {
  channel: {
    id: string;
    title: string;
    subscribers: number;
    totalViews: number;
    totalVideos: number;
  };
  performance: {
    avgViewsPerVideo: number;
    avgEngagementRate: number;
    totalRecentViews: number;
    totalRecentLikes: number;
    totalRecentComments: number;
  };
  topPerformers: {
    byViews: YouTubeVideo[];
    byEngagement: YouTubeVideo[];
  };
  patterns: {
    bestHooks: string[];
    bestPostingTimes: Array<{ hour: number; avgViews: number }>;
    avgDurationSeconds: number;
    shortsVsLongForm: {
      shorts: { count: number; avgViews: number };
      longForm: { count: number; avgViews: number };
    };
  };
  recentVideos: YouTubeVideo[];
  fetchedAt: number;
}

interface AnalysisResult {
  selectedCount: number;
  avgViews: number;
  avgEngagement: number;
  commonPatterns: {
    titlePatterns: string[];
    bestHours: number[];
    avgDuration: number;
  };
  recommendations: string[];
  promptSuggestions: string;
}

export default function YouTubeAnalyticsDashboard() {
  const [brands, setBrands] = useState<Record<string, BrandAnalytics>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>('abdullah');
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);

  const BRANDS = ['abdullah', 'ownerfi', 'carz'];

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const results: Record<string, BrandAnalytics> = {};

      for (const brand of BRANDS) {
        const response = await fetch(`/api/analytics/youtube?brand=${brand}${refresh ? '&refresh=true' : ''}`);
        const data = await response.json();

        if (data.success) {
          results[brand] = {
            channel: data.channel,
            performance: data.performance,
            topPerformers: data.topPerformers,
            patterns: data.patterns,
            recentVideos: data.recentVideos || [],
            fetchedAt: data.fetchedAt,
          };
        }
      }

      setBrands(results);
    } catch (error) {
      console.error('Error loading YouTube analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleVideoSelection = (videoId: string) => {
    const newSelection = new Set(selectedVideos);
    if (newSelection.has(videoId)) {
      newSelection.delete(videoId);
    } else {
      newSelection.add(videoId);
    }
    setSelectedVideos(newSelection);
    setAnalysisResult(null);
  };

  const selectAllVideos = () => {
    const currentBrandData = brands[selectedBrand];
    if (!currentBrandData) return;

    const allVideoIds = currentBrandData.recentVideos.map(v => v.videoId);
    setSelectedVideos(new Set(allVideoIds));
    setAnalysisResult(null);
  };

  const clearSelection = () => {
    setSelectedVideos(new Set());
    setAnalysisResult(null);
  };

  const analyzeSelectedVideos = () => {
    const currentBrandData = brands[selectedBrand];
    if (!currentBrandData || selectedVideos.size === 0) return;

    const selectedVideosList = currentBrandData.recentVideos.filter(v =>
      selectedVideos.has(v.videoId)
    );

    // Calculate averages
    const totalViews = selectedVideosList.reduce((sum, v) => sum + v.views, 0);
    const totalEngagement = selectedVideosList.reduce((sum, v) => sum + v.engagement, 0);
    const totalDuration = selectedVideosList.reduce((sum, v) => sum + v.duration, 0);

    const avgViews = totalViews / selectedVideosList.length;
    const avgEngagement = totalEngagement / selectedVideosList.length;
    const avgDuration = totalDuration / selectedVideosList.length;

    // Extract title patterns (first few words)
    const titlePatterns = selectedVideosList
      .map(v => v.title.replace('#Shorts ', '').substring(0, 30))
      .slice(0, 5);

    // Extract posting hours
    const hours = selectedVideosList.map(v => new Date(v.publishedAt).getHours());
    const hourCounts = hours.reduce((acc, h) => {
      acc[h] = (acc[h] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    const bestHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h]) => parseInt(h));

    // Generate recommendations
    const recommendations: string[] = [];

    if (avgViews > currentBrandData.performance.avgViewsPerVideo * 1.5) {
      recommendations.push(`These videos perform ${((avgViews / currentBrandData.performance.avgViewsPerVideo - 1) * 100).toFixed(0)}% better than your average!`);
    }

    if (avgDuration < 30) {
      recommendations.push(`Keep videos short (avg ${avgDuration.toFixed(0)}s works well)`);
    }

    if (bestHours.length > 0) {
      recommendations.push(`Post at ${bestHours.map(h => `${h}:00`).join(', ')} for best results`);
    }

    // Generate prompt suggestions
    const promptSuggestions = `
## Prompt Optimization Based on Top Performers

### Title Patterns That Work:
${titlePatterns.map((t, i) => `${i + 1}. "${t}..."`).join('\n')}

### Optimal Settings:
- Script Length: ${avgDuration < 30 ? '30-40 words (20-25 seconds)' : '40-60 words (30-45 seconds)'}
- Best Posting Times: ${bestHours.map(h => `${h}:00`).join(', ')}
- Avg Engagement: ${avgEngagement.toFixed(2)}%

### Hook Formulas (from top performers):
${titlePatterns.slice(0, 3).map((t, i) => `- "${t}..."`).join('\n')}

### Recommended Prompt Updates:
\`\`\`
TOP PERFORMING HOOK FORMULAS:
${titlePatterns.slice(0, 5).map(t => `- "${t}..."`).join('\n')}

SCRIPT REQUIREMENTS:
- Length: ${avgDuration < 30 ? '30-40' : '40-50'} words
- Post at: ${bestHours.map(h => `${h}:00`).join(', ')}
\`\`\`
    `.trim();

    setAnalysisResult({
      selectedCount: selectedVideosList.length,
      avgViews,
      avgEngagement,
      commonPatterns: {
        titlePatterns,
        bestHours,
        avgDuration,
      },
      recommendations,
      promptSuggestions,
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        <p className="mt-4 text-gray-600">Loading YouTube analytics...</p>
      </div>
    );
  }

  const currentBrandData = brands[selectedBrand];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">📺 YouTube Analytics Dashboard</h1>
          <div className="flex gap-2">
            <button
              onClick={() => loadAnalytics(true)}
              disabled={refreshing}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {/* Brand Selector */}
        <div className="flex gap-2">
          {BRANDS.map(brand => (
            <button
              key={brand}
              onClick={() => {
                setSelectedBrand(brand);
                setSelectedVideos(new Set());
                setAnalysisResult(null);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedBrand === brand
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {brand.charAt(0).toUpperCase() + brand.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Channel Stats */}
      {currentBrandData && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Channel</p>
            <p className="text-lg font-bold text-gray-900">{currentBrandData.channel.title}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Subscribers</p>
            <p className="text-2xl font-bold text-red-600">{currentBrandData.channel.subscribers.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total Views</p>
            <p className="text-2xl font-bold text-blue-600">{currentBrandData.channel.totalViews.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Avg Views/Video</p>
            <p className="text-2xl font-bold text-green-600">{currentBrandData.performance.avgViewsPerVideo.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Avg Engagement</p>
            <p className="text-2xl font-bold text-purple-600">{currentBrandData.performance.avgEngagementRate}%</p>
          </div>
        </div>
      )}

      {/* Selection Controls */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              <strong>{selectedVideos.size}</strong> videos selected
            </span>
            <button
              onClick={selectAllVideos}
              className="text-blue-600 hover:underline text-sm"
            >
              Select All
            </button>
            <button
              onClick={clearSelection}
              className="text-gray-500 hover:underline text-sm"
            >
              Clear
            </button>
          </div>
          <button
            onClick={analyzeSelectedVideos}
            disabled={selectedVideos.size === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            🔍 Analyze Selected ({selectedVideos.size})
          </button>
        </div>
      </div>

      {/* Analysis Results */}
      {analysisResult && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Analysis of {analysisResult.selectedCount} Selected Videos</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-500">Avg Views</p>
              <p className="text-2xl font-bold text-blue-600">{analysisResult.avgViews.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-500">Avg Engagement</p>
              <p className="text-2xl font-bold text-green-600">{analysisResult.avgEngagement.toFixed(2)}%</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-500">Avg Duration</p>
              <p className="text-2xl font-bold text-purple-600">{analysisResult.commonPatterns.avgDuration.toFixed(0)}s</p>
            </div>
          </div>

          {/* Recommendations */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Key Insights:</h3>
            <ul className="list-disc list-inside space-y-1">
              {analysisResult.recommendations.map((rec, i) => (
                <li key={i} className="text-gray-700">{rec}</li>
              ))}
            </ul>
          </div>

          {/* Prompt Suggestions */}
          <div className="bg-gray-900 rounded-lg p-4 relative">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-white">Prompt Recommendations (Copy & Use):</h3>
              <button
                onClick={() => copyToClipboard(analysisResult.promptSuggestions)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
            <pre className="text-green-400 text-sm overflow-x-auto whitespace-pre-wrap">
              {analysisResult.promptSuggestions}
            </pre>
          </div>
        </div>
      )}

      {/* Video List */}
      {currentBrandData && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold text-gray-900">Recent Videos ({currentBrandData.recentVideos.length})</h2>
            <p className="text-sm text-gray-500">Select videos to analyze patterns and generate prompt recommendations</p>
          </div>

          <div className="divide-y max-h-[600px] overflow-y-auto">
            {currentBrandData.recentVideos.map(video => (
              <div
                key={video.videoId}
                className={`p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer ${
                  selectedVideos.has(video.videoId) ? 'bg-blue-50' : ''
                }`}
                onClick={() => toggleVideoSelection(video.videoId)}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedVideos.has(video.videoId)}
                  onChange={() => toggleVideoSelection(video.videoId)}
                  className="w-5 h-5 text-blue-600 rounded"
                  onClick={e => e.stopPropagation()}
                />

                {/* Video Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{video.title}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(video.publishedAt).toLocaleDateString()} • {video.duration}s
                  </p>
                </div>

                {/* Stats */}
                <div className="flex gap-6 text-sm">
                  <div className="text-center">
                    <p className="font-bold text-blue-600">{video.views.toLocaleString()}</p>
                    <p className="text-gray-500">views</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-red-600">{video.likes.toLocaleString()}</p>
                    <p className="text-gray-500">likes</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-green-600">{video.engagement.toFixed(2)}%</p>
                    <p className="text-gray-500">engagement</p>
                  </div>
                </div>

                {/* Link */}
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                  onClick={e => e.stopPropagation()}
                >
                  View →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best Posting Times */}
      {currentBrandData && currentBrandData.patterns && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">⏰ Best Posting Times</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {currentBrandData.patterns.bestPostingTimes.slice(0, 5).map((time, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{time.hour}:00</p>
                <p className="text-sm text-gray-500">{time.avgViews.toLocaleString(undefined, { maximumFractionDigits: 0 })} avg views</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
