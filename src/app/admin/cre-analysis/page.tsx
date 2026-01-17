'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CREAnalysis } from '@/lib/cre/cre-models';

type TabType = 'analyze' | 'history';

export default function CREAnalysisPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('analyze');

  // Analysis state
  const [address, setAddress] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CREAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'cache' | 'fresh' | null>(null);

  // History state
  const [history, setHistory] = useState<CREAnalysis[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    } else if (status === 'authenticated' && (session?.user as { role?: string })?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  // Load history on tab switch
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/cre/history?limit=20');
      const data = await res.json();
      if (data.success) {
        setHistory(data.data);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const runAnalysis = async (forceRefresh = false) => {
    if (!address.trim()) {
      setError('Please enter an address');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setSource(null);

    try {
      const res = await fetch('/api/cre/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.trim(), forceRefresh }),
      });

      const data = await res.json();

      if (data.success) {
        setAnalysis(data.data);
        setSource(data.source);
      } else {
        setError(data.error || 'Analysis failed');
        if (data.data) {
          setAnalysis(data.data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadFromHistory = (item: CREAnalysis) => {
    setAddress(item.inputAddress);
    setAnalysis(item);
    setSource('cache');
    setError(null);
    setActiveTab('analyze');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <Link href="/admin" className="text-emerald-400 hover:text-emerald-300 text-sm mb-4 inline-block">
          ← Back to Admin
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Commercial RE Analysis</h1>
          <p className="text-slate-400">
            Enter an address to analyze market conditions, demographics, and investment potential
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('analyze')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'analyze'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            New Analysis
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            History
          </button>
        </div>

        {activeTab === 'analyze' ? (
          <>
            {/* Address Input */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Enter Address
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                  placeholder="123 Main St, Dallas, TX 75201"
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => runAnalysis()}
                  disabled={isAnalyzing || !address.trim()}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>
              {source === 'cache' && analysis && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-400">Loaded from cache</span>
                  <button
                    onClick={() => runAnalysis(true)}
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    Refresh
                  </button>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {/* Loading State */}
            {isAnalyzing && (
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
                <p className="text-slate-300">Analyzing address...</p>
                <p className="text-slate-500 text-sm mt-1">This may take 10-20 seconds</p>
              </div>
            )}

            {/* Results */}
            {analysis && !isAnalyzing && (
              <div className="space-y-6">
                {/* Location Header */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                  <h2 className="text-xl font-semibold text-white">{analysis.parsedAddress.formattedAddress}</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    {analysis.parsedAddress.county} County, {analysis.parsedAddress.state}
                  </p>
                </div>

                {/* Demographics & Business Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Demographics */}
                  <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span>📊</span> Demographics
                    </h3>
                    {analysis.demographics ? (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Population</span>
                          <span className="text-white font-medium">
                            {analysis.demographics.population.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Median Income</span>
                          <span className="text-white font-medium">
                            ${analysis.demographics.medianHouseholdIncome.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Median Age</span>
                          <span className="text-white font-medium">
                            {analysis.demographics.medianAge.toFixed(1)}
                          </span>
                        </div>
                        {analysis.demographics.unemploymentRate !== null && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Unemployment</span>
                            <span className="text-white font-medium">
                              {analysis.demographics.unemploymentRate.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {analysis.demographics.educationBachelorOrHigher !== null && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Bachelor&apos;s+</span>
                            <span className="text-white font-medium">
                              {analysis.demographics.educationBachelorOrHigher.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-slate-700">
                          <span className="text-xs text-slate-500">
                            Source: Census ACS {analysis.demographics.dataYear} ({analysis.demographics.geographyLevel})
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500">Demographics data unavailable</p>
                    )}
                  </div>

                  {/* Business Data */}
                  <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span>🏪</span> Business Data
                    </h3>
                    {analysis.businessData ? (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Establishments</span>
                          <span className="text-white font-medium">
                            {analysis.businessData.totalEstablishments.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Retail</span>
                          <span className="text-white font-medium">
                            {analysis.businessData.retailEstablishments.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Food Service</span>
                          <span className="text-white font-medium">
                            {analysis.businessData.foodServiceEstablishments.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Healthcare</span>
                          <span className="text-white font-medium">
                            {analysis.businessData.healthcareEstablishments.toLocaleString()}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-700">
                          <p className="text-xs text-slate-500 mb-2">Top Industries:</p>
                          {analysis.businessData.topIndustries.slice(0, 3).map((ind, i) => (
                            <div key={i} className="text-xs text-slate-400">
                              {i + 1}. {ind.name} ({ind.establishmentCount})
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500">Business data unavailable</p>
                    )}
                  </div>
                </div>

                {/* Highest & Best Use */}
                {analysis.highestBestUse && (
                  <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span>🎯</span> Highest & Best Use Recommendation
                    </h3>
                    <div className="flex items-center gap-4 mb-4">
                      <span className="px-4 py-2 bg-emerald-600 rounded-lg text-white font-bold uppercase">
                        {analysis.highestBestUse.recommendation}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        analysis.highestBestUse.confidence === 'high'
                          ? 'bg-green-500/20 text-green-400'
                          : analysis.highestBestUse.confidence === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {analysis.highestBestUse.confidence} confidence
                      </span>
                    </div>
                    <p className="text-slate-300 mb-4">{analysis.highestBestUse.reasoning}</p>

                    {analysis.highestBestUse.keyFactors.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-slate-400 mb-2">Key Factors:</p>
                        <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                          {analysis.highestBestUse.keyFactors.map((factor, i) => (
                            <li key={i}>{factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysis.highestBestUse.alternativeUses.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-slate-400 mb-2">Alternative Uses:</p>
                        <div className="flex flex-wrap gap-2">
                          {analysis.highestBestUse.alternativeUses.map((alt, i) => (
                            <span key={i} className="px-3 py-1 bg-slate-700 rounded text-slate-300 text-sm">
                              {alt.type} ({alt.viability})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.highestBestUse.risks.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-slate-400 mb-2">Risks to Consider:</p>
                        <ul className="list-disc list-inside text-slate-400 text-sm space-y-1">
                          {analysis.highestBestUse.risks.map((risk, i) => (
                            <li key={i}>{risk}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-700">
                      <span className="text-xs text-slate-500">
                        Generated by {analysis.highestBestUse.modelUsed} • API Cost: ${analysis.apiCosts.total.toFixed(3)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* History Tab */
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            {historyLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mx-auto"></div>
              </div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-400">No analyses yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Address</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Recommendation</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-sm text-white">
                        {item.parsedAddress.formattedAddress || item.inputAddress}
                      </td>
                      <td className="px-4 py-3">
                        {item.highestBestUse ? (
                          <span className="px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded text-xs uppercase">
                            {item.highestBestUse.recommendation}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.status === 'complete'
                            ? 'bg-green-500/20 text-green-400'
                            : item.status === 'failed'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => loadFromHistory(item)}
                          className="text-emerald-400 hover:text-emerald-300 text-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
