/**
 * Real-Time Cost Dashboard Component
 *
 * Displays:
 * - Today's spend vs daily budget
 * - Month-to-date spend vs monthly budget
 * - Cost breakdown by service (HeyGen, Submagic, OpenAI, Late, R2)
 * - Cost breakdown by brand
 * - HeyGen account quota remaining
 * - Recent activity log
 * - Budget alerts and warnings
 */

'use client';

import { useEffect, useState } from 'react';

interface CostDashboardData {
  summary: {
    todaySpend: number;
    monthSpend: number;
    monthBudget: number;
    monthPercentage: number;
    daysLeftInMonth: number;
    projectedMonthlySpend: number;
  };
  breakdown: {
    byService: {
      [service: string]: { units: number; costUSD: number };
    };
    byBrand: {
      [brand: string]: any;
    };
    total: number;
  };
  budgets: {
    heygen: any;
    submagic: any;
    openai: any;
  };
  recentActivity: Array<{
    brand: string;
    service: string;
    operation: string;
    costUSD: number;
    timestamp: number;
  }>;
  config: any;
}

export default function CostDashboard() {
  const [data, setData] = useState<CostDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch cost data
  const fetchData = async () => {
    try {
      const response = await fetch('/api/costs/dashboard');
      if (!response.ok) throw new Error('Failed to fetch cost data');

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Loading cost data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500 rounded">
        <p className="text-red-400">Error: {error || 'No data available'}</p>
        <button
          onClick={fetchData}
          className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, breakdown, budgets, recentActivity, config } = data;

  // Calculate status colors
  const getStatusColor = (percentage: number) => {
    if (percentage >= config.alertThresholds.critical) return 'text-red-500';
    if (percentage >= config.alertThresholds.warning) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getBarColor = (percentage: number) => {
    if (percentage >= config.alertThresholds.critical) return 'bg-red-500';
    if (percentage >= config.alertThresholds.warning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">💰 Cost Dashboard</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Today's Spend */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">Today's Spend</div>
          <div className="text-3xl font-bold text-white mb-1">
            ${summary.todaySpend.toFixed(2)}
          </div>
          <div className="text-sm text-gray-500">
            of ${config.dailyLimits.heygen + config.dailyLimits.submagic + config.dailyLimits.openai} daily budget
          </div>
        </div>

        {/* Month-to-Date */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">Month-to-Date</div>
          <div className="text-3xl font-bold text-white mb-1">
            ${summary.monthSpend.toFixed(2)}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={getStatusColor(summary.monthPercentage)}>
              {summary.monthPercentage.toFixed(1)}%
            </span>
            <span className="text-gray-500">
              of ${summary.monthBudget}
            </span>
          </div>
        </div>

        {/* Projected Monthly */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">Projected Monthly</div>
          <div className="text-3xl font-bold text-white mb-1">
            ${summary.projectedMonthlySpend.toFixed(2)}
          </div>
          <div className="text-sm">
            {summary.projectedMonthlySpend > summary.monthBudget ? (
              <span className="text-red-500">⚠️ Over budget</span>
            ) : (
              <span className="text-green-500">✓ Within budget</span>
            )}
          </div>
        </div>

        {/* Days Left */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">Days Left</div>
          <div className="text-3xl font-bold text-white mb-1">
            {summary.daysLeftInMonth}
          </div>
          <div className="text-sm text-gray-500">
            days remaining in month
          </div>
        </div>
      </div>

      {/* Budget Status by Service */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Service Budgets (Daily)</h3>
        <div className="space-y-4">
          {/* HeyGen */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-white font-medium">🎬 HeyGen</span>
              <span className={getStatusColor(budgets.heygen.percentage)}>
                {budgets.heygen.used}/{budgets.heygen.limit} credits ({budgets.heygen.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getBarColor(budgets.heygen.percentage)}`}
                style={{ width: `${Math.min(budgets.heygen.percentage, 100)}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Account Quota: {budgets.heygen.accountQuota.remaining}/660 credits ({budgets.heygen.accountQuota.percentage.toFixed(1)}%)
            </div>
          </div>

          {/* Submagic */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-white font-medium">📝 Submagic</span>
              <span className={getStatusColor(budgets.submagic.percentage)}>
                {budgets.submagic.used}/{budgets.submagic.limit} credits ({budgets.submagic.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getBarColor(budgets.submagic.percentage)}`}
                style={{ width: `${Math.min(budgets.submagic.percentage, 100)}%` }}
              />
            </div>
          </div>

          {/* OpenAI */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-white font-medium">🤖 OpenAI</span>
              <span className={getStatusColor(budgets.openai.percentage)}>
                {budgets.openai.used}/{budgets.openai.limit} calls ({budgets.openai.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getBarColor(budgets.openai.percentage)}`}
                style={{ width: `${Math.min(budgets.openai.percentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Service */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Monthly Cost by Service</h3>
          <div className="space-y-3">
            {Object.entries(breakdown.byService).map(([service, data]: [string, any]) => (
              <div key={service} className="flex justify-between items-center">
                <span className="text-gray-300 capitalize">{service}</span>
                <div className="text-right">
                  <div className="text-white font-medium">${data.costUSD.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{data.units} units</div>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-700 flex justify-between">
              <span className="text-white font-bold">Total</span>
              <span className="text-white font-bold">${breakdown.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* By Brand */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Monthly Cost by Brand</h3>
          <div className="space-y-3">
            {Object.entries(breakdown.byBrand).map(([brand, data]: [string, any]) => (
              <div key={brand} className="flex justify-between items-center">
                <span className="text-gray-300 capitalize">{brand}</span>
                <div className="text-white font-medium">${data.total.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2">Time</th>
                <th className="pb-2">Brand</th>
                <th className="pb-2">Service</th>
                <th className="pb-2">Operation</th>
                <th className="pb-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((entry, idx) => (
                <tr key={idx} className="border-b border-gray-700/50">
                  <td className="py-2 text-gray-400">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 text-gray-300 capitalize">{entry.brand}</td>
                  <td className="py-2 text-gray-300 capitalize">{entry.service}</td>
                  <td className="py-2 text-gray-400">{entry.operation}</td>
                  <td className="py-2 text-right text-white font-medium">
                    ${entry.costUSD.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts */}
      {(budgets.heygen.nearLimit || budgets.submagic.nearLimit || budgets.openai.nearLimit) && (
        <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
          <h3 className="text-yellow-500 font-semibold mb-2">⚠️ Budget Warnings</h3>
          <ul className="space-y-1 text-sm text-yellow-400">
            {budgets.heygen.nearLimit && (
              <li>HeyGen budget at {budgets.heygen.percentage.toFixed(1)}% - approaching limit</li>
            )}
            {budgets.submagic.nearLimit && (
              <li>Submagic budget at {budgets.submagic.percentage.toFixed(1)}% - approaching limit</li>
            )}
            {budgets.openai.nearLimit && (
              <li>OpenAI budget at {budgets.openai.percentage.toFixed(1)}% - approaching limit</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
