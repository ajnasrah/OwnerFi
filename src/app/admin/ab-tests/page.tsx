'use client';

import React, { useState, useEffect } from 'react';

interface ABTest {
  id: string;
  name: string;
  description: string;
  type: string;
  brand: string;
  variants: {
    id: string;
    name: string;
    description: string;
  }[];
  trafficSplit: number[];
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate: number;
  endDate?: number;
  winningVariant?: string;
  confidenceLevel?: number;
  createdAt: number;
}

interface VariantStats {
  variantId: string;
  sampleSize: number;
  engagementRate: number;
  totalViews: number;
  totalEngagements: number;
  isWinner: boolean;
}

interface TestResults {
  winningVariant: string;
  confidenceLevel: number;
  variants: VariantStats[];
}

export default function ABTestsPage() {
  const [selectedBrand, setSelectedBrand] = useState<'carz' | 'ownerfi' | 'podcast'>('carz');
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPreset, setCreatePreset] = useState<'hook' | 'caption' | 'posting_time'>('hook');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchTests();
  }, [selectedBrand]);

  useEffect(() => {
    if (selectedTest) {
      fetchTestResults(selectedTest.id);
    }
  }, [selectedTest]);

  async function fetchTests() {
    setLoading(true);
    try {
      const response = await fetch(`/api/ab-tests/list?brand=${selectedBrand}`);
      const data = await response.json();
      setTests(data.tests || []);

      // Auto-select first active test
      const activeTest = data.tests?.find((t: ABTest) => t.status === 'active');
      if (activeTest && !selectedTest) {
        setSelectedTest(activeTest);
      }
    } catch (error) {
      console.error('Error fetching tests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTestResults(testId: string) {
    try {
      const response = await fetch(`/api/ab-tests/results?testId=${testId}`);
      const data = await response.json();
      setTestResults(data.analysis || null);
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  }

  async function createTest() {
    setCreating(true);
    try {
      const response = await fetch('/api/ab-tests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset: createPreset,
          brand: selectedBrand
        })
      });

      const data = await response.json();

      if (data.success) {
        setShowCreateModal(false);
        fetchTests();
        alert(`✅ A/B test created successfully!\n\nTest ID: ${data.testId}`);
      } else {
        alert(`❌ Failed to create test: ${data.error}`);
      }
    } catch (error) {
      console.error('Error creating test:', error);
      alert('❌ Error creating test');
    } finally {
      setCreating(false);
    }
  }

  async function completeTest(testId: string) {
    if (!confirm('Complete this test and declare a winner?')) return;

    try {
      const response = await fetch('/api/ab-tests/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId })
      });

      const data = await response.json();

      if (data.success) {
        fetchTests();
        alert('✅ Test completed!');
      } else {
        alert(`❌ Failed to complete test: ${data.error}`);
      }
    } catch (error) {
      console.error('Error completing test:', error);
      alert('❌ Error completing test');
    }
  }

  const activeTests = tests.filter(t => t.status === 'active');
  const completedTests = tests.filter(t => t.status === 'completed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">A/B Testing Dashboard</h1>
          <p className="text-slate-600">Track and optimize video performance across different variations</p>
        </div>

        {/* Brand Selector */}
        <div className="flex gap-2 mb-6">
          {(['carz', 'ownerfi', 'podcast'] as const).map((brand) => (
            <button
              key={brand}
              onClick={() => setSelectedBrand(brand)}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                selectedBrand === brand
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {brand === 'carz' ? 'Carz Inc' : brand === 'ownerfi' ? 'OwnerFi' : 'Podcast'}
            </button>
          ))}
        </div>

        {/* Create Test Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-all shadow-lg"
          >
            + Create New Test
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Test List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Active Tests */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Active Tests ({activeTests.length})
              </h2>

              {loading ? (
                <div className="text-center py-8 text-slate-500">Loading...</div>
              ) : activeTests.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No active tests. Create one to get started!
                </div>
              ) : (
                <div className="space-y-3">
                  {activeTests.map((test) => (
                    <button
                      key={test.id}
                      onClick={() => setSelectedTest(test)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedTest?.id === test.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-slate-900">{test.name}</div>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 mb-2">{test.description}</div>
                      <div className="flex gap-2 text-xs text-slate-500">
                        <span className="bg-slate-100 px-2 py-1 rounded">{test.type}</span>
                        <span className="bg-slate-100 px-2 py-1 rounded">
                          {test.variants.length} variants
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Completed Tests */}
            {completedTests.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">
                  Completed Tests ({completedTests.length})
                </h2>
                <div className="space-y-3">
                  {completedTests.map((test) => (
                    <button
                      key={test.id}
                      onClick={() => setSelectedTest(test)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedTest?.id === test.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-slate-900">{test.name}</div>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          Completed
                        </span>
                      </div>
                      {test.winningVariant && (
                        <div className="text-sm text-green-600 font-medium">
                          Winner: Variant {test.winningVariant} ({test.confidenceLevel}% confidence)
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Test Details & Results */}
          <div className="lg:col-span-2">
            {selectedTest ? (
              <div className="space-y-6">
                {/* Test Info Card */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 mb-2">{selectedTest.name}</h2>
                      <p className="text-slate-600">{selectedTest.description}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedTest.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : selectedTest.status === 'completed'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedTest.status.charAt(0).toUpperCase() + selectedTest.status.slice(1)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-slate-500">Test Type</div>
                      <div className="font-medium text-slate-900">{selectedTest.type}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Started</div>
                      <div className="font-medium text-slate-900">
                        {(() => {
                          const ts = selectedTest.startDate as any;
                          if (!ts) return 'N/A';
                          if (typeof ts === 'object' && typeof ts._seconds === 'number') return new Date(ts._seconds * 1000).toLocaleDateString();
                          const date = new Date(ts);
                          return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Variants */}
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-slate-700 mb-2">Variants</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedTest.variants.map((variant, idx) => (
                        <div key={variant.id} className="border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-900">
                              Variant {variant.id}: {variant.name}
                            </span>
                            <span className="text-sm text-slate-500">
                              {selectedTest.trafficSplit[idx]}%
                            </span>
                          </div>
                          <div className="text-sm text-slate-600">{variant.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  {selectedTest.status === 'active' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => completeTest(selectedTest.id)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-all"
                      >
                        Complete Test
                      </button>
                    </div>
                  )}
                </div>

                {/* Results Card */}
                {testResults && (
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Performance Results</h3>

                    {testResults.variants.length > 0 ? (
                      <>
                        {/* Winner Badge */}
                        {testResults.confidenceLevel >= 70 && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl">🏆</span>
                              <span className="font-bold text-green-900">
                                Winner: Variant {testResults.winningVariant}
                              </span>
                            </div>
                            <div className="text-sm text-green-700">
                              Confidence: {testResults.confidenceLevel}%
                              {testResults.confidenceLevel >= 80 ? ' (High)' : ' (Moderate)'}
                            </div>
                          </div>
                        )}

                        {/* Variant Stats */}
                        <div className="space-y-4">
                          {testResults.variants.map((variant) => (
                            <div
                              key={variant.variantId}
                              className={`border-2 rounded-lg p-4 ${
                                variant.isWinner
                                  ? 'border-green-300 bg-green-50'
                                  : 'border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-bold text-lg text-slate-900">
                                  Variant {variant.variantId}
                                  {variant.isWinner && (
                                    <span className="ml-2 text-green-600">👑</span>
                                  )}
                                </span>
                                <span className="text-2xl font-bold text-blue-600">
                                  {variant.engagementRate.toFixed(2)}%
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <div className="text-xs text-slate-500">Sample Size</div>
                                  <div className="font-semibold text-slate-900">
                                    {variant.sampleSize} videos
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-500">Total Views</div>
                                  <div className="font-semibold text-slate-900">
                                    {variant.totalViews.toLocaleString()}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-500">Engagements</div>
                                  <div className="font-semibold text-slate-900">
                                    {variant.totalEngagements.toLocaleString()}
                                  </div>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="mt-3">
                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      variant.isWinner ? 'bg-green-500' : 'bg-blue-500'
                                    }`}
                                    style={{
                                      width: `${Math.min(
                                        (variant.engagementRate / Math.max(...testResults.variants.map(v => v.engagementRate))) * 100,
                                        100
                                      )}%`
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Statistical Significance Warning */}
                        {testResults.variants[0]?.sampleSize < 30 && (
                          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-600">⚠️</span>
                              <div>
                                <div className="font-semibold text-yellow-900">
                                  Not enough data yet
                                </div>
                                <div className="text-sm text-yellow-700">
                                  Need at least 30 samples per variant for statistical significance.
                                  Current: {testResults.variants[0]?.sampleSize || 0} samples.
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        No results yet. Generate some videos to see data!
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Select a Test</h3>
                <p className="text-slate-600">
                  Choose a test from the left to view detailed results and performance metrics.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Test Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Create New A/B Test</h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Test Type
              </label>
              <div className="space-y-3">
                <button
                  onClick={() => setCreatePreset('hook')}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    createPreset === 'hook'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900 mb-1">Hook Style Test</div>
                  <div className="text-sm text-slate-600">
                    Test question-based vs statement-based video openings
                  </div>
                </button>

                <button
                  onClick={() => setCreatePreset('caption')}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    createPreset === 'caption'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900 mb-1">Caption Style Test</div>
                  <div className="text-sm text-slate-600">
                    Test short punchy vs detailed informative captions
                  </div>
                </button>

                <button
                  onClick={() => setCreatePreset('posting_time')}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    createPreset === 'posting_time'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900 mb-1">Posting Time Test</div>
                  <div className="text-sm text-slate-600">
                    Test morning (9 AM) vs evening (7 PM) posting times
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={createTest}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
