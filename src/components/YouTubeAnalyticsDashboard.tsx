'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

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

interface AIAnalysisResult {
  uniquePatterns: {
    hooks: string[];
    topics: string[];
    emotionalTriggers: string[];
    structuralElements: string[];
  };
  keyDifferentiators: string[];
  recommendations: string[];
  promptTemplate: string;
  confidence: 'high' | 'medium' | 'low';
}

interface AnalysisResult {
  selectedCount: number;
  avgViews: number;
  avgEngagement: number;
  avgDuration: number;
  performanceMultiplier: number | null;
  aiAnalysis: AIAnalysisResult;
}

export default function YouTubeAnalyticsDashboard() {
  const [brands, setBrands] = useState<Record<string, BrandAnalytics>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>('abdullah');
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'views' | 'likes' | 'engagement'>('recent');

  const BRANDS = ['abdullah', 'ownerfi', 'carz'];

  // Load only the selected brand (lazy loading for performance)
  useEffect(() => {
    loadBrandAnalytics(selectedBrand);
  }, [selectedBrand]);

  const loadBrandAnalytics = useCallback(async (brand: string, refresh = false) => {
    // Skip if already loaded and not refreshing
    if (!refresh && brands[brand]) {
      return;
    }

    if (refresh) setRefreshing(true);
    else if (!brands[brand]) setLoading(true);

    try {
      const response = await fetch(`/api/analytics/youtube?brand=${brand}${refresh ? '&refresh=true' : ''}`);
      const data = await response.json();

      if (data.success) {
        setBrands(prev => ({
          ...prev,
          [brand]: {
            channel: data.channel,
            performance: data.performance,
            topPerformers: data.topPerformers,
            patterns: data.patterns,
            recentVideos: data.recentVideos || [],
            fetchedAt: data.fetchedAt,
          },
        }));
      }
    } catch (error) {
      console.error(`Error loading YouTube analytics for ${brand}:`, error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [brands]);

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

  const analyzeSelectedVideos = async () => {
    const currentBrandData = brands[selectedBrand];
    if (!currentBrandData || selectedVideos.size === 0) return;

    setAnalyzing(true);
    setAnalysisResult(null);

    try {
      const selectedVideosList = currentBrandData.recentVideos.filter(v =>
        selectedVideos.has(v.videoId)
      );

      // Call AI analysis API
      const response = await fetch('/api/analytics/youtube/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedVideos: selectedVideosList,
          allVideos: currentBrandData.recentVideos,
          brandAvgViews: currentBrandData.performance.avgViewsPerVideo,
          brandAvgEngagement: currentBrandData.performance.avgEngagementRate,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        console.error('Analysis failed:', data.error);
        return;
      }

      setAnalysisResult({
        selectedCount: data.stats.selectedCount,
        avgViews: data.stats.selectedAvgViews,
        avgEngagement: data.stats.selectedAvgEngagement,
        avgDuration: data.stats.selectedAvgDuration,
        performanceMultiplier: data.stats.performanceMultiplier,
        aiAnalysis: data.analysis,
      });
    } catch (error) {
      console.error('Error analyzing videos:', error);
    } finally {
      setAnalyzing(false);
    }
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

  const currentBrandData = brands[selectedBrand];

  // Memoized sorted videos - only recompute when videos or sortBy changes
  const sortedVideos = useMemo(() => {
    const videos = currentBrandData?.recentVideos || [];
    const sorted = [...videos];
    switch (sortBy) {
      case 'views':
        return sorted.sort((a, b) => b.views - a.views);
      case 'likes':
        return sorted.sort((a, b) => b.likes - a.likes);
      case 'engagement':
        return sorted.sort((a, b) => b.engagement - a.engagement);
      case 'recent':
      default:
        return sorted.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    }
  }, [currentBrandData?.recentVideos, sortBy]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        <p className="mt-4 text-gray-600">Loading YouTube analytics...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">📺 YouTube Analytics Dashboard</h1>
          <div className="flex gap-2">
            <button
              onClick={() => loadBrandAnalytics(selectedBrand, true)}
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
            disabled={selectedVideos.size === 0 || analyzing}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            {analyzing ? (
              <>
                <span className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                Analyzing with AI...
              </>
            ) : (
              <>🔍 Analyze Selected ({selectedVideos.size})</>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Results */}
      {analysisResult && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg shadow p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">🧠 AI Analysis of {analysisResult.selectedCount} Selected Videos</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              analysisResult.aiAnalysis.confidence === 'high' ? 'bg-green-100 text-green-800' :
              analysisResult.aiAnalysis.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {analysisResult.aiAnalysis.confidence.toUpperCase()} confidence
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-500">Avg Views</p>
              <p className="text-2xl font-bold text-blue-600">{analysisResult.avgViews.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-500">Avg Engagement</p>
              <p className="text-2xl font-bold text-green-600">{analysisResult.avgEngagement.toFixed(2)}%</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-500">Avg Duration</p>
              <p className="text-2xl font-bold text-purple-600">{analysisResult.avgDuration}s</p>
            </div>
            {analysisResult.performanceMultiplier && (
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-gray-500">vs Other Videos</p>
                <p className="text-2xl font-bold text-orange-600">{analysisResult.performanceMultiplier}x better</p>
              </div>
            )}
          </div>

          {/* Key Differentiators */}
          <div className="bg-white rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-lg">🎯</span> What Makes These Videos Different
            </h3>
            <ul className="space-y-2">
              {analysisResult.aiAnalysis.keyDifferentiators.map((diff, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-700">{diff}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Patterns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hooks */}
            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-lg">🪝</span> Hook Patterns
              </h3>
              <ul className="space-y-1">
                {analysisResult.aiAnalysis.uniquePatterns.hooks.map((hook, i) => (
                  <li key={i} className="text-gray-700 text-sm">• {hook}</li>
                ))}
              </ul>
            </div>

            {/* Topics */}
            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-lg">📌</span> Topics That Work
              </h3>
              <ul className="space-y-1">
                {analysisResult.aiAnalysis.uniquePatterns.topics.map((topic, i) => (
                  <li key={i} className="text-gray-700 text-sm">• {topic}</li>
                ))}
              </ul>
            </div>

            {/* Emotional Triggers */}
            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-lg">💡</span> Emotional Triggers
              </h3>
              <ul className="space-y-1">
                {analysisResult.aiAnalysis.uniquePatterns.emotionalTriggers.map((trigger, i) => (
                  <li key={i} className="text-gray-700 text-sm">• {trigger}</li>
                ))}
              </ul>
            </div>

            {/* Structural Elements */}
            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-lg">🏗️</span> Structural Elements
              </h3>
              <ul className="space-y-1">
                {analysisResult.aiAnalysis.uniquePatterns.structuralElements.map((elem, i) => (
                  <li key={i} className="text-gray-700 text-sm">• {elem}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-lg">📋</span> Actionable Recommendations
            </h3>
            <ul className="space-y-2">
              {analysisResult.aiAnalysis.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">{i + 1}</span>
                  <span className="text-gray-700">{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Prompt Template */}
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <span className="text-lg">🚀</span> AI-Generated Prompt Template
              </h3>
              <button
                onClick={() => copyToClipboard(analysisResult.aiAnalysis.promptTemplate)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied ? '✓ Copied!' : '📋 Copy Template'}
              </button>
            </div>
            <pre className="text-green-400 text-sm overflow-x-auto whitespace-pre-wrap bg-gray-800 rounded-lg p-4">
              {analysisResult.aiAnalysis.promptTemplate}
            </pre>
          </div>
        </div>
      )}

      {/* Video List */}
      {currentBrandData && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-900">Videos ({currentBrandData.recentVideos.length})</h2>
              {/* Sort Controls */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Sort by:</span>
                {(['recent', 'views', 'likes', 'engagement'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => setSortBy(option)}
                    className={`px-3 py-1 text-sm rounded-lg font-medium transition-colors ${
                      sortBy === option
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option === 'recent' ? '📅 Recent' :
                     option === 'views' ? '👁️ Views' :
                     option === 'likes' ? '❤️ Likes' : '📊 Engagement'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm text-gray-500">Select videos to analyze patterns and generate prompt recommendations</p>
          </div>

          <div className="divide-y max-h-[600px] overflow-y-auto">
            {sortedVideos.map(video => (
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
