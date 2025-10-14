'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Article {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: number;
  processed: boolean;
  qualityScore?: number;
  aiReasoning?: string;
  feedId: string;
  categories: string[];
  author?: string;
}

interface ArticlesData {
  success: boolean;
  articles: {
    carz: Article[];
    ownerfi: Article[];
  };
  timestamp: string;
}

export default function ArticlesPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [activeBrand, setActiveBrand] = useState<'carz' | 'ownerfi'>('carz');
  const [activeView, setActiveView] = useState<'queue' | 'unprocessed'>('queue');
  const [articles, setArticles] = useState<ArticlesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(false);

  // Auth check
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }

    if (authStatus === 'authenticated') {
      const userRole = (session?.user as { role?: string })?.role;
      if (userRole !== 'admin') {
        router.push('/');
      }
    }
  }, [authStatus, session, router]);

  useEffect(() => {
    if (authStatus === 'authenticated' && (session?.user as { role?: string })?.role === 'admin') {
      loadArticles();
      const interval = setInterval(loadArticles, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [authStatus, session]);

  const loadArticles = async () => {
    try {
      const response = await fetch('/api/articles/queue');
      const data = await response.json();
      setArticles(data);
    } catch (error) {
      console.error('Failed to load articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const decodeHTML = (html: string) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  const deleteArticle = async (articleId: string, brand: 'carz' | 'ownerfi') => {
    if (!confirm('Are you sure you want to delete this article? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/articles/delete?articleId=${articleId}&brand=${brand}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (data.success) {
        await loadArticles();
      } else {
        alert(`Failed to delete article: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to delete article');
      console.error('Delete error:', error);
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-700';
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 70) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const rateAllArticles = async () => {
    const unprocessedCount = allArticles.filter(a => !a.processed).length;
    if (!confirm(`Rate all ${unprocessedCount} unprocessed ${activeBrand} articles with AI?\n\nThis will:\n- Score all articles with OpenAI GPT-4o-mini\n- Keep top 10 articles\n- Delete low-quality ones\n\nThis may take 1-2 minutes.`)) {
      return;
    }

    setRating(true);
    try {
      const response = await fetch('/api/articles/rate-all-async', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brand: activeBrand,
          keepTopN: 10
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Rating complete!\n\n` +
          `• Rated: ${data.rated} articles\n` +
          `• Kept: ${data.kept} top articles\n` +
          `• Deleted: ${data.deleted} low-quality articles\n` +
          `• Duration: ${data.duration} seconds\n\n` +
          `Top scores: ${data.topScores?.join(', ') || 'N/A'}`
        );
        await loadArticles(); // Refresh the list
      } else {
        alert(`Failed to rate articles: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to rate articles');
      console.error('Rating error:', error);
    } finally {
      setRating(false);
    }
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg font-medium text-gray-900">Loading articles...</div>
        </div>
      </div>
    );
  }

  const allArticles = activeBrand === 'carz' ? articles?.articles.carz || [] : articles?.articles.ownerfi || [];

  // Debug logging
  console.log(`[${activeBrand}] Total articles:`, allArticles.length);
  console.log(`[${activeBrand}] Processed count:`, allArticles.filter(a => a.processed).length);
  console.log(`[${activeBrand}] Unprocessed count:`, allArticles.filter(a => !a.processed).length);
  console.log(`[${activeBrand}] With scores:`, allArticles.filter(a => a.qualityScore !== undefined).length);

  // Top 10 Queue: Unprocessed articles with scores, sorted by score DESC, limit 10
  const queueArticles = allArticles
    .filter(a => !a.processed && a.qualityScore !== undefined)
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
    .slice(0, 10);

  // Unprocessed: All unprocessed articles (for rating)
  const unprocessedArticles = allArticles.filter(a => !a.processed);

  const displayArticles = activeView === 'queue' ? queueArticles : unprocessedArticles;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Article Management</h1>
          <p className="text-slate-600 mt-1">Manage articles for video generation</p>
        </div>

        {/* Brand Tabs */}
        <div className="flex space-x-2 mb-6">
          {[
            { key: 'carz', label: 'Carz Inc', icon: '🚗' },
            { key: 'ownerfi', label: 'OwnerFi', icon: '🏠' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveBrand(tab.key as any)}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeBrand === tab.key
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* View Tabs */}
        <div className="flex space-x-2 mb-6">
          {[
            { key: 'queue', label: 'Top 10 Queue', icon: '🎯', count: queueArticles.length },
            { key: 'unprocessed', label: 'Unprocessed Articles', icon: '📝', count: unprocessedArticles.length }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeView === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeView === tab.key ? 'bg-white/20' : 'bg-slate-200'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Articles List */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {activeView === 'queue' ? 'Top 10 Rated Articles' : 'All Unprocessed Articles'}
            </h2>
            <div className="flex items-center gap-2">
              {activeView === 'unprocessed' && (
                <button
                  onClick={rateAllArticles}
                  disabled={rating || unprocessedArticles.length === 0}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    rating || unprocessedArticles.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
                  }`}
                >
                  {rating ? '🤖 Rating...' : '🤖 Rate All with AI'}
                </button>
              )}
              <button
                onClick={loadArticles}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {displayArticles.length > 0 ? (
            <div className="space-y-4">
              {displayArticles.map((article, index) => (
                <div
                  key={article.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-semibold text-sm flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 text-base mb-1">
                            {decodeHTML(article.title)}
                          </h3>
                          <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                            {decodeHTML(article.description)}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>📅 {formatDate(article.pubDate)}</span>
                            {article.author && <span>✍️ {decodeHTML(article.author)}</span>}
                            {article.categories.length > 0 && (
                              <span>🏷️ {article.categories.slice(0, 2).map(c => decodeHTML(c)).join(', ')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {article.qualityScore && (
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getScoreColor(article.qualityScore)}`}>
                          Score: {article.qualityScore}
                        </div>
                      )}
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        View Article →
                      </a>
                      <button
                        onClick={() => deleteArticle(article.id, activeBrand)}
                        className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                        title="Delete article"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>

                  {article.aiReasoning && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-xs font-semibold text-slate-700 mb-1">🤖 AI Analysis:</div>
                      <div className="text-sm text-slate-600 italic">"{article.aiReasoning}"</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg p-12 text-center border border-slate-200">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-slate-500 text-sm font-medium">
                {activeView === 'queue' ? 'No articles in top 10 queue' : 'No unprocessed articles'}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {activeView === 'queue'
                  ? 'Rate unprocessed articles to populate the queue'
                  : 'Articles will appear here when fetched from RSS feeds'}
              </div>
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-slate-600">Top 10 Queue</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {queueArticles.length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-slate-600">Unprocessed</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {unprocessedArticles.length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-slate-600">Avg Score (Top 10)</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {queueArticles.length > 0
                ? Math.round(
                    queueArticles
                      .reduce((sum, a) => sum + (a.qualityScore || 0), 0) /
                    queueArticles.length
                  )
                : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
