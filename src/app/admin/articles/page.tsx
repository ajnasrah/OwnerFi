'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  const [fetching, setFetching] = useState(false);

  // Auth check
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth');
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
      const interval = setInterval(loadArticles, 60000); // Refresh every 60 seconds (reduced from 30s for better performance)
      return () => clearInterval(interval);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const formatDate = (timestamp: unknown) => {
    if (!timestamp) return 'N/A';
    // Handle Firestore timestamp with _seconds
    let finalTimestamp = timestamp;
    if (typeof timestamp === 'object' && timestamp !== null && '_seconds' in timestamp && typeof (timestamp as { _seconds: number })._seconds === 'number') {
      finalTimestamp = (timestamp as { _seconds: number })._seconds * 1000;
    }
    const date = new Date(finalTimestamp as string | number);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
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
    if (!score) return 'bg-slate-700 text-slate-300';
    if (score >= 80) return 'bg-green-900/50 text-green-300';
    if (score >= 70) return 'bg-yellow-900/50 text-yellow-300';
    return 'bg-red-900/50 text-red-300';
  };

  const fetchNewArticles = async () => {
    if (!confirm('Fetch new articles from all RSS feeds?\n\nThis will fetch the latest articles from all configured RSS feeds.')) {
      return;
    }

    setFetching(true);
    try {
      const response = await fetch('/api/articles/fetch-now', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Fetch complete!\n\n` +
          `• New articles: ${data.totalNewArticles}\n` +
          `• Feeds processed: ${data.feedsProcessed}\n` +
          (data.errors ? `\n⚠️ Errors:\n${data.errors.join('\n')}` : '')
        );
        await loadArticles(); // Refresh the list
      } else {
        alert(`Failed to fetch articles: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to fetch articles');
      console.error('Fetch error:', error);
    } finally {
      setFetching(false);
    }
  };

  const rateAllArticles = async () => {
    const unprocessedCount = allArticles.filter(a => !a.processed).length;
    if (!confirm(`Rate all ${unprocessedCount} unprocessed ${activeBrand} articles with AI?\n\nThis will:\n- Score all articles with OpenAI GPT-4o-mini\n- Keep top 100 articles (increased buffer)\n- Delete low-quality ones (score <65)\n\nThis may take 1-2 minutes.`)) {
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
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg font-medium text-white">Loading articles...</div>
        </div>
      </div>
    );
  }

  const allArticles = activeBrand === 'carz' ? articles?.articles.carz || [] : articles?.articles.ownerfi || [];


  // Article Queue: Unprocessed articles with scores >= 50, sorted by score DESC
  const queueArticles = allArticles
    .filter(a => !a.processed && a.qualityScore !== undefined && a.qualityScore >= 50)
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));

  // Unprocessed: All unprocessed articles (for rating)
  const unprocessedArticles = allArticles.filter(a => !a.processed);

  const displayArticles = activeView === 'queue' ? queueArticles : unprocessedArticles;

  return (
    <div className="h-screen overflow-hidden bg-slate-900 flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
        <Link href="/admin" className="text-emerald-400 hover:text-emerald-300 text-sm mb-4 inline-block">← Back to Admin</Link>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Article Management</h1>
          <p className="text-slate-400 mt-1">Manage articles for video generation</p>
        </div>

        {/* Brand Tabs */}
        <div className="flex space-x-2 mb-6">
          {[
            { key: 'carz', label: 'Carz Inc', icon: '🚗' },
            { key: 'ownerfi', label: 'OwnerFi', icon: '🏠' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveBrand(tab.key as 'carz' | 'ownerfi')}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeBrand === tab.key
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
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
            { key: 'queue', label: 'Video-Ready Queue (65+)', icon: '🎯', count: queueArticles.length },
            { key: 'unprocessed', label: 'Unprocessed Articles', icon: '📝', count: unprocessedArticles.length }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key as 'queue' | 'unprocessed')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeView === tab.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeView === tab.key ? 'bg-white/20' : 'bg-slate-700 text-slate-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Articles List */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {activeView === 'queue' ? `Video-Ready Articles (${queueArticles.length} with score ≥65)` : 'All Unprocessed Articles'}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchNewArticles}
                disabled={fetching}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  fetching
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
                }`}
              >
                {fetching ? '📡 Fetching...' : '📡 Fetch New Articles'}
              </button>
              {activeView === 'unprocessed' && (
                <button
                  onClick={rateAllArticles}
                  disabled={rating || unprocessedArticles.length === 0}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    rating || unprocessedArticles.length === 0
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
                  }`}
                >
                  {rating ? '🤖 Rating...' : '🤖 Rate All with AI'}
                </button>
              )}
              <button
                onClick={loadArticles}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-emerald-400 hover:bg-slate-600 border border-slate-600 transition-colors"
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
                  className="border border-slate-600 rounded-lg p-4 hover:border-emerald-500 transition-colors bg-slate-700/50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-900/50 text-emerald-400 font-semibold text-sm flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white text-base mb-1">
                            {decodeHTML(article.title)}
                          </h3>
                          <p className="text-sm text-slate-400 line-clamp-2 mb-2">
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
                        className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
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
                    <div className="mt-3 pt-3 border-t border-slate-600">
                      <div className="text-xs font-semibold text-slate-300 mb-1">🤖 AI Analysis:</div>
                      <div className="text-sm text-slate-400 italic">"{article.aiReasoning}"</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-700/50 rounded-lg p-12 text-center border border-slate-600">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-slate-400 text-sm font-medium">
                {activeView === 'queue' ? 'No video-ready articles (score ≥65)' : 'No unprocessed articles'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {activeView === 'queue'
                  ? 'Rate unprocessed articles to populate the queue with high-quality content'
                  : 'Articles will appear here when fetched from RSS feeds'}
              </div>
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-sm text-slate-400">Video-Ready Queue</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {queueArticles.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">Score ≥65</div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-sm text-slate-400">Total Unprocessed</div>
            <div className="text-2xl font-bold text-white mt-1">
              {unprocessedArticles.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">Needs rating</div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-sm text-slate-400">Avg Score (Queue)</div>
            <div className="text-2xl font-bold text-white mt-1">
              {queueArticles.length > 0
                ? Math.round(
                    queueArticles
                      .reduce((sum, a) => sum + (a.qualityScore || 0), 0) /
                    queueArticles.length
                  )
                : 'N/A'}
            </div>
            <div className="text-xs text-slate-500 mt-1">Quality rating</div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-sm text-slate-400">Total Articles</div>
            <div className="text-2xl font-bold text-white mt-1">
              {allArticles.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">In database</div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
